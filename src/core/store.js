import { Database } from 'bun:sqlite';
import { Mutex } from 'async-mutex';
import path from 'path';
import fs from 'fs/promises';
import { jidNormalizedUser, isJidNewsletter } from 'baileys';
import pino from 'pino';

const logger = pino({
  level: Bun.env.LOG_LEVEL || 'silent',
  base: { module: 'STORE' },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: Bun.env.LOG_TIME_FORMAT,
      ignore: Bun.env.LOG_IGNORE,
    },
  },
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_PATH = './data/storage/store.db';

const CONFIG = {
  db: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    temp_store: 'MEMORY',
    cache_size: -32768,   // 32 MB
    mmap_size: 67108864,  // 64 MB
    page_size: 4096,
    auto_vacuum: 'INCREMENTAL',
    busy_timeout: 5000,
  },

  cache: {
    chats:         { maxSize: 500,  defaultTTL: 3600000  }, // 1 h
    contacts:      { maxSize: 2000, defaultTTL: 7200000  }, // 2 h
    members:       { maxSize: 5000, defaultTTL: 1800000  }, // 30 min
    groupMetadata: { maxSize: 300,  defaultTTL: 3600000  }, // 1 h
  },

  buffer: {
    flushIntervalMs: 5000,
  },

  changeDetection: {
    // Fields that change too often and should NOT trigger a DB write on their own
    ignoreFields: ['lastMessageTimestamp', 'unreadCount', 'conversationTimestamp', 't'],
  },

  settings: {
    self: false,
    autoread: false,
    prefix: '.',
  },
};

const DEFAULT_CHAT_DATA = {
  mute: false,
  logmcserver: false,
};

const DEFAULT_MEMBER_DATA = {
  afk: -1,
  afkReason: '',
  blacklist: -1,
};

// ============================================================================
// UTILITIES
// ============================================================================

function isEqual(a, b, ignoreFields = []) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;

  const keysA = Object.keys(a).filter((k) => !ignoreFields.includes(k));
  const keysB = Object.keys(b).filter((k) => !ignoreFields.includes(k));
  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!isEqual(a[k], b[k], ignoreFields)) return false;
  }
  return true;
}

/**
 * Strip high-frequency / non-meaningful fields before change comparison.
 * Also strips `metadata` — that is compared separately in updateGroupMetadata.
 */
function significantChatFields(data) {
  if (!data || typeof data !== 'object') return data;
  const copy = { ...data };
  for (const f of CONFIG.changeDetection.ignoreFields) delete copy[f];
  delete copy.metadata;
  return copy;
}

// ============================================================================
// LRU CACHE  (leak-safe: cleanup timers are always unref'd)
// ============================================================================

class LRUCache {
  constructor(maxSize = 1000, defaultTTL = 600_000) {
    this.cache      = new Map();
    this.maxSize    = maxSize;
    this.defaultTTL = defaultTTL;
    this._timer     = null;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (LRU refresh)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value, ttl) {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, { value, expiresAt });
  }

  delete(key) { return this.cache.delete(key); }
  clear()     { this.cache.clear(); }
  get size()  { return this.cache.size; }

  _runCleanup() {
    const now = Date.now();
    for (const [k, e] of this.cache) {
      if (now > e.expiresAt) this.cache.delete(k);
    }
  }

  startAutoCleanup(intervalMs = 60_000) {
    this.stopAutoCleanup();
    this._timer = setInterval(() => this._runCleanup(), intervalMs);
    this._timer?.unref?.();
  }

  stopAutoCleanup() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

// ============================================================================
// WRITE BUFFER  (no timers, no memory leaks — pure Map snapshot)
// ============================================================================

class WriteBuffer {
  constructor() {
    this.chats    = new Map(); // jid → chatObj
    this.contacts = new Map(); // jid → contactObj
    this.members  = new Map(); // `chatJid:userJid` → { chatJid, userJid, data }
    this.settings = null;
  }

  addChat(jid, data)                { this.chats.set(jid, data); }
  addContact(jid, data)             { this.contacts.set(jid, data); }
  addMember(chatJid, userJid, data) { this.members.set(`${chatJid}:${userJid}`, { chatJid, userJid, data }); }
  setSettings(data)                 { this.settings = data; }

  hasChanges() {
    return this.chats.size > 0 || this.contacts.size > 0 ||
           this.members.size > 0 || this.settings !== null;
  }

  /**
   * Atomically snapshot and reset the buffer.
   * Any writes that arrive DURING a slow flush are captured in the fresh
   * Maps and will be picked up by the next flush — data is never lost.
   */
  snapshot() {
    const snap = {
      chats:    Array.from(this.chats.entries()),
      contacts: Array.from(this.contacts.entries()),
      members:  Array.from(this.members.values()),
      settings: this.settings,
    };
    // Replace with fresh Maps immediately so concurrent writers are never blocked
    this.chats    = new Map();
    this.contacts = new Map();
    this.members  = new Map();
    this.settings = null;
    return snap;
  }
}

// ============================================================================
// UNIFIED STORE
// ============================================================================

export class UnifiedStore {
  constructor() {
    this.conn = null;
    this.db   = null;
    this.stmts = {};

    this.chatsCache         = new LRUCache(CONFIG.cache.chats.maxSize,         CONFIG.cache.chats.defaultTTL);
    this.contactsCache      = new LRUCache(CONFIG.cache.contacts.maxSize,      CONFIG.cache.contacts.defaultTTL);
    this.membersCache       = new LRUCache(CONFIG.cache.members.maxSize,       CONFIG.cache.members.defaultTTL);
    this.groupMetadataCache = new LRUCache(CONFIG.cache.groupMetadata.maxSize, CONFIG.cache.groupMetadata.defaultTTL);

    this.botSettings = { ...CONFIG.settings };
    this.botData     = {};
    this.botJid      = null;

    this.writeBuffer    = new WriteBuffer();
    this.writeMutex     = new Mutex();
    this.flushTimer     = null;
    this.isShuttingDown = false;
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async init() {
    try {
      await this._ensureDirectory();

      this.db = new Database(DB_PATH, { create: true, readwrite: true, strict: true });

      for (const [pragma, value] of Object.entries(CONFIG.db)) {
        this.db.exec(`PRAGMA ${pragma} = ${value}`);
      }

      logger.info({ journalMode: this.db.prepare('PRAGMA journal_mode').get() }, 'DB initialised');

      this._createTables();
      this._prepareStatements();
      await this._loadBotSettings();
      await this._preloadData();

      this.chatsCache.startAutoCleanup(60_000);
      this.contactsCache.startAutoCleanup(60_000);
      this.membersCache.startAutoCleanup(60_000);
      this.groupMetadataCache.startAutoCleanup(60_000);

      this._startPersistenceLoop();
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, 'Store init failed');
      throw err;
    }
  }

  async _ensureDirectory() {
    try {
      await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create DB directory');
    }
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        jid        TEXT    PRIMARY KEY,
        data       TEXT    NOT NULL,
        metadata   TEXT,
        updated_at INTEGER DEFAULT (unixepoch())
      ) WITHOUT ROWID
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at)');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        jid        TEXT    PRIMARY KEY,
        lid        TEXT,
        data       TEXT    NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      ) WITHOUT ROWID
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_contacts_lid     ON contacts(lid) WHERE lid IS NOT NULL');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_contacts_updated ON contacts(updated_at)');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        chat_jid   TEXT    NOT NULL,
        user_jid   TEXT    NOT NULL,
        data       TEXT    NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (chat_jid, user_jid)
      ) WITHOUT ROWID
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_members_chat ON members(chat_jid)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_jid)');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        data       TEXT    NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    const row = this.db.prepare('SELECT COUNT(*) AS c FROM bot_settings WHERE id = 1').get();
    if (row.c === 0) {
      this.db.prepare('INSERT INTO bot_settings (id, data) VALUES (1, ?)').run(JSON.stringify(CONFIG.settings));
    }

    this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');
  }

  _prepareStatements() {
    this.stmts.getChat = this.db.prepare(
      'SELECT data, metadata FROM chats WHERE jid = ?'
    );

    this.stmts.upsertChat = this.db.prepare(`
      INSERT INTO chats (jid, data, metadata, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(jid) DO UPDATE SET
        data       = excluded.data,
        metadata   = excluded.metadata,
        updated_at = unixepoch()
    `);

    this.stmts.getAllChats = this.db.prepare(
      'SELECT jid, data, metadata FROM chats ORDER BY updated_at DESC'
    );

    this.stmts.getContact = this.db.prepare(
      'SELECT data, lid FROM contacts WHERE jid = ?'
    );

    this.stmts.upsertContact = this.db.prepare(`
      INSERT INTO contacts (jid, lid, data, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(jid) DO UPDATE SET
        lid        = excluded.lid,
        data       = excluded.data,
        updated_at = unixepoch()
    `);

    this.stmts.getMember = this.db.prepare(
      'SELECT data FROM members WHERE chat_jid = ? AND user_jid = ?'
    );

    this.stmts.upsertMember = this.db.prepare(`
      INSERT INTO members (chat_jid, user_jid, data, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(chat_jid, user_jid) DO UPDATE SET
        data       = excluded.data,
        updated_at = unixepoch()
    `);

    this.stmts.getChatMembers = this.db.prepare(
      'SELECT user_jid, data FROM members WHERE chat_jid = ?'
    );

    this.stmts.deleteMember = this.db.prepare(
      'DELETE FROM members WHERE chat_jid = ? AND user_jid = ?'
    );

    this.stmts.updateBotSettings = this.db.prepare(
      'UPDATE bot_settings SET data = ?, updated_at = unixepoch() WHERE id = 1'
    );

    // Batch transaction used by the flush loop
    this.txBatch = this.db.transaction((chats, contacts, members, settings) => {
      for (const [jid, chat] of chats) {
        try {
          const { metadata, ...data } = chat;
          this.stmts.upsertChat.run(
            jid,
            JSON.stringify(data),
            metadata ? JSON.stringify(metadata) : null
          );
        } catch (e) {
          logger.error({ err: e.message, jid }, 'txBatch: chat write failed');
        }
      }

      for (const [jid, contact] of contacts) {
        try {
          const { lid, ...data } = contact;
          this.stmts.upsertContact.run(jid, lid ?? null, JSON.stringify(data));
        } catch (e) {
          logger.error({ err: e.message, jid }, 'txBatch: contact write failed');
        }
      }

      for (const { chatJid, userJid, data } of members) {
        try {
          this.stmts.upsertMember.run(chatJid, userJid, JSON.stringify(data));
        } catch (e) {
          logger.error({ err: e.message, chatJid, userJid }, 'txBatch: member write failed');
        }
      }

      if (settings !== null) {
        try {
          this.stmts.updateBotSettings.run(JSON.stringify(settings));
        } catch (e) {
          logger.error({ err: e.message }, 'txBatch: settings write failed');
        }
      }
    });

    logger.debug('Prepared statements ready');
  }

  async _loadBotSettings() {
    try {
      const row = this.db.prepare('SELECT data FROM bot_settings WHERE id = 1').get();
      if (row) this.botSettings = JSON.parse(row.data);
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to load bot settings');
    }
  }

  async _preloadData() {
    try {
      let contacts = 0;
      for (const row of this.db.prepare('SELECT jid, lid, data FROM contacts').all()) {
        try {
          if (isJidNewsletter(row.jid)) continue;
          const contact = { ...JSON.parse(row.data), jid: row.jid, lid: row.lid ?? null };
          this.contactsCache.set(row.jid, contact);
          if (row.lid && row.lid !== row.jid) this.contactsCache.set(row.lid, contact);
          contacts++;
        } catch (e) {
          logger.error({ err: e.message, jid: row.jid }, 'preload: bad contact row');
        }
      }

      let chats = 0;
      for (const row of this.stmts.getAllChats.all()) {
        try {
          const data     = JSON.parse(row.data);
          const metadata = row.metadata ? JSON.parse(row.metadata) : null;
          const chat     = { ...DEFAULT_CHAT_DATA, ...data, metadata };
          this.chatsCache.set(row.jid, chat);
          if (metadata) this.groupMetadataCache.set(row.jid, metadata);
          chats++;
        } catch (e) {
          logger.error({ err: e.message, jid: row.jid }, 'preload: bad chat row');
        }
      }

      logger.info(`Preloaded ${contacts} contacts and ${chats} chats`);
    } catch (err) {
      logger.error({ err: err.message }, 'Preload failed');
    }
  }

  // ==========================================================================
  // PERSISTENCE LOOP
  // ==========================================================================

  _startPersistenceLoop() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.flush().catch((e) => logger.error({ err: e.message }, 'Persistence loop error'));
      }
    }, CONFIG.buffer.flushIntervalMs);
    this.flushTimer?.unref?.();
  }

  /**
   * Flush the write buffer to SQLite.
   *
   * Mutex is the sole concurrency guard — no isFlushing flag needed.
   * snapshot() replaces the buffer Maps atomically so writes that arrive
   * during a slow flush land in fresh Maps and are picked up next cycle.
   */
  async flush() {
    if (this.isShuttingDown) return;

    await this.writeMutex.runExclusive(() => {
      if (!this.writeBuffer.hasChanges()) return;

      const { chats, contacts, members, settings } = this.writeBuffer.snapshot();
      if (!chats.length && !contacts.length && !members.length && settings === null) return;

      try {
        this.txBatch(chats, contacts, members, settings);
        this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');
        logger.trace({ chats: chats.length, contacts: contacts.length, members: members.length }, 'Flush OK');
      } catch (err) {
        logger.error({ err: err.message }, 'Flush failed');
        throw err;
      }
    });
  }

  /**
   * Write a single chat row to DB right now, bypassing the flush queue.
   * Called from upsertChat({ immediate: true }) for critical settings changes.
   */
  _writeChatNow(jid, chat) {
    try {
      const { metadata, ...data } = chat;
      this.stmts.upsertChat.run(
        jid,
        JSON.stringify(data),
        metadata ? JSON.stringify(metadata) : null
      );
      this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');
      logger.debug({ jid }, 'Immediate DB write OK');
    } catch (err) {
      logger.error({ err: err.message, jid }, 'Immediate DB write failed — queuing for next flush');
      // Fallback: queue normally so data is not silently lost
      this.writeBuffer.addChat(jid, chat);
    }
  }

  // ==========================================================================
  // CHAT MANAGEMENT
  // ==========================================================================

  /**
   * Get a chat by JID.
   *
   * ALWAYS returns an object (never null) so callers can safely mutate it
   * (e.g. `store.getChat(id).logmcserver = true`). Brand-new chats receive
   * DEFAULT_CHAT_DATA and are registered in the cache immediately.
   */
  getChat(jid) {
    if (!jid) return { ...DEFAULT_CHAT_DATA };

    const normalized = jidNormalizedUser(jid);

    // 1. Cache hit
    const cached = this.chatsCache.get(normalized);
    if (cached) return cached;

    // 2. DB hit
    try {
      const row = this.stmts.getChat.get(normalized);
      if (row) {
        const chat = {
          ...DEFAULT_CHAT_DATA,
          ...JSON.parse(row.data),
          metadata: row.metadata ? JSON.parse(row.metadata) : null,
        };
        this.chatsCache.set(normalized, chat);
        return chat;
      }
    } catch (err) {
      logger.error({ err: err.message, jid: normalized }, 'getChat DB error');
    }

    // 3. Brand-new chat — register so mutations are visible
    const fresh = { ...DEFAULT_CHAT_DATA };
    this.chatsCache.set(normalized, fresh);
    return fresh;
  }

  /**
   * Persist chat data — merge `updates` into the existing chat record.
   *
   * @param {string}  jid
   * @param {Object}  updates
   * @param {Object}  [opts]
   * @param {boolean} [opts.immediate=false]
   *   When true, writes to SQLite right now without waiting for the flush cycle.
   *   Use this for explicit user-triggered settings changes (e.g. mclog on/off)
   *   so the data survives a crash/restart before the next 5 s flush.
   * @returns {Object} Updated chat object.
   */
  upsertChat(jid, updates = {}, { immediate = false } = {}) {
    if (!jid) {
      logger.warn('upsertChat: empty jid');
      return null;
    }

    try {
      const normalized  = jidNormalizedUser(jid);
      const existing    = this.getChat(normalized); // always returns an object
      const updatedChat = { ...existing, ...updates };

      // For batched (non-immediate) writes, skip DB roundtrip when nothing
      // significant changed. Immediate writes always go through so the caller
      // gets the guarantee they asked for.
      if (!immediate) {
        const oldSig = significantChatFields(existing);
        const newSig = significantChatFields(updatedChat);
        if (isEqual(oldSig, newSig)) {
          logger.trace({ jid: normalized }, 'upsertChat: no significant change, skipping');
          return existing;
        }
      }

      // Update caches
      this.chatsCache.set(normalized, updatedChat);
      if (updatedChat.metadata) this.groupMetadataCache.set(normalized, updatedChat.metadata);

      if (immediate) {
        this._writeChatNow(normalized, updatedChat);
      } else {
        this.writeBuffer.addChat(normalized, updatedChat);
      }

      logger.debug({ jid: normalized, immediate, keys: Object.keys(updates) }, 'upsertChat OK');
      return updatedChat;
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack, jid }, 'upsertChat failed');
      return null;
    }
  }

  /**
   * Return all chats from the database as an array.
   * Pagination via `limit` / `offset` for very large datasets.
   * Processes in chunks and yields between them to keep the event loop responsive.
   *
   * @param {Object}  [opts]
   * @param {number}  [opts.limit=0]   0 = no limit
   * @param {number}  [opts.offset=0]
   * @returns {Promise<Array<Object>>}
   */
  async getAllChats({ limit = 0, offset = 0 } = {}) {
    if (!this.db) {
      logger.warn('getAllChats: DB not initialised');
      return [];
    }

    try {
      const rows = limit > 0
        ? this.db.prepare('SELECT jid, data, metadata FROM chats ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset)
        : this.stmts.getAllChats.all();

      const result = [];
      const CHUNK  = 200;

      for (let i = 0; i < rows.length; i += CHUNK) {
        for (const row of rows.slice(i, i + CHUNK)) {
          try {
            const data     = JSON.parse(row.data);
            const metadata = row.metadata ? JSON.parse(row.metadata) : null;
            const chat     = { ...DEFAULT_CHAT_DATA, ...data, jid: row.jid, metadata };

            // Cache warm-up as a side-effect
            this.chatsCache.set(row.jid, chat);
            if (metadata) this.groupMetadataCache.set(row.jid, metadata);

            result.push(chat);
          } catch (e) {
            logger.error({ err: e.message, jid: row.jid }, 'getAllChats: parse error, row skipped');
          }
        }

        // Yield between chunks to avoid starving message handlers
        if (i + CHUNK < rows.length) {
          await new Promise((r) => setImmediate(r));
        }
      }

      logger.debug({ total: result.length, limit, offset }, 'getAllChats OK');
      return result;
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, 'getAllChats failed');
      return [];
    }
  }

  /**
   * Alias for backwards-compatibility.
   * mclog.js calls `botStore.getAllChat()` — this resolves the name mismatch.
   */
  getAllChat(opts) { return this.getAllChats(opts); }

  // ==========================================================================
  // CONTACT MANAGEMENT
  // ==========================================================================

  getContact(jid) {
    if (!jid) return null;
    const normalized = jidNormalizedUser(jid);

    const cached = this.contactsCache.get(normalized);
    if (cached) return cached;

    try {
      const row = this.stmts.getContact.get(normalized);
      if (row) {
        const contact = { ...JSON.parse(row.data), jid: normalized, lid: row.lid ?? null };
        this.contactsCache.set(normalized, contact);
        if (row.lid && row.lid !== normalized) this.contactsCache.set(row.lid, contact);
        return contact;
      }
    } catch (err) {
      logger.error({ err: err.message, jid: normalized }, 'getContact failed');
    }

    return null;
  }

  upsertContact(jid, updates) {
    if (!jid) return null;
    const normalized = jidNormalizedUser(jid);

    if (this.isBotNumber(normalized)) return null;

    const existing = this.contactsCache.get(normalized) ?? { jid: normalized };
    const isNew    = !this.contactsCache.get(normalized);
    const updated  = { ...existing, ...updates };

    if (!isNew && isEqual(existing, updated, CONFIG.changeDetection.ignoreFields)) {
      return existing;
    }

    this.contactsCache.set(normalized, updated);
    if (updated.lid && updated.lid !== normalized) this.contactsCache.set(updated.lid, updated);
    this.writeBuffer.addContact(normalized, updated);

    return updated;
  }

  enrichUserData(arg1, arg2, pushName) {
    try {
      if (!arg1 && !arg2) return;

      const isLid = (id) => typeof id === 'string' && id.endsWith('@lid');
      const isJidS = (id) => typeof id === 'string' && id.endsWith('@s.whatsapp.net');

      let targetJid = null;
      let targetLid = null;

      if (isJidS(arg1)) targetJid = arg1; else if (isLid(arg1)) targetLid = arg1;
      if (isJidS(arg2)) targetJid = arg2; else if (isLid(arg2)) targetLid = arg2;

      if ((targetJid && this.isBotNumber(targetJid)) || (targetLid && this.isBotNumber(targetLid))) return;

      const id = targetJid ?? targetLid;
      if (!id) return;

      const upd = {};
      if (pushName)  upd.name = pushName;
      if (targetJid) upd.jid  = targetJid;
      if (targetLid) upd.lid  = targetLid;

      this.upsertContact(id, upd);

      if (targetJid && targetLid && targetJid !== targetLid) {
        const c = this.contactsCache.get(id);
        if (c) {
          this.contactsCache.set(targetJid, c);
          this.contactsCache.set(targetLid, c);
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'enrichUserData failed');
    }
  }

  // ==========================================================================
  // MEMBER MANAGEMENT
  // ==========================================================================

  getMember(chatJid, userJid) {
    const cj  = jidNormalizedUser(chatJid);
    const uj  = jidNormalizedUser(userJid);
    const key = `${cj}:${uj}`;

    const cached = this.membersCache.get(key);
    if (cached) return cached;

    try {
      const row = this.stmts.getMember.get(cj, uj);
      if (row) {
        const member = JSON.parse(row.data);
        this.membersCache.set(key, member);
        return member;
      }
    } catch (err) {
      logger.error({ err: err.message, chatJid, userJid }, 'getMember failed');
    }

    return { ...DEFAULT_MEMBER_DATA };
  }

  upsertMember(chatJid, userJid, updates) {
    const cj  = jidNormalizedUser(chatJid);
    const uj  = jidNormalizedUser(userJid);
    const key = `${cj}:${uj}`;

    const existing = this.membersCache.get(key) ?? { ...DEFAULT_MEMBER_DATA };
    const updated  = { ...existing, ...updates };

    if (isEqual(existing, updated)) return existing;

    this.membersCache.set(key, updated);
    this.writeBuffer.addMember(cj, uj, updated);
    return updated;
  }

  getChatMembers(chatJid) {
    const cj = jidNormalizedUser(chatJid);
    try {
      const result = {};
      for (const row of this.stmts.getChatMembers.all(cj)) {
        try {
          result[row.user_jid] = JSON.parse(row.data);
          this.membersCache.set(`${cj}:${row.user_jid}`, result[row.user_jid]);
        } catch (e) {
          logger.error({ err: e.message, userJid: row.user_jid }, 'getChatMembers: parse error');
        }
      }
      return result;
    } catch (err) {
      logger.error({ err: err.message, chatJid }, 'getChatMembers failed');
      return {};
    }
  }

  deleteMember(chatJid, userJid) {
    const cj = jidNormalizedUser(chatJid);
    const uj = jidNormalizedUser(userJid);
    this.membersCache.delete(`${cj}:${uj}`);
    try {
      this.stmts.deleteMember.run(cj, uj);
    } catch (err) {
      logger.error({ err: err.message, chatJid, userJid }, 'deleteMember failed');
    }
  }

  // ==========================================================================
  // GROUP METADATA
  // ==========================================================================

  getGroupMetadata(jid) {
    const normalized = jidNormalizedUser(jid);
    const meta = this.groupMetadataCache.get(normalized);
    if (meta) return meta;

    const chat = this.chatsCache.get(normalized);
    if (chat?.metadata) {
      this.groupMetadataCache.set(normalized, chat.metadata);
      return chat.metadata;
    }

    return null;
  }

  async updateGroupMetadata(jid, metadata) {
    try {
      const normalized = jidNormalizedUser(jid);
      this.groupMetadataCache.set(normalized, metadata);

      // getChat() selalu fallback ke DB jika cache miss.
      // Mencegah field seperti logmcserver tertimpa DEFAULT_CHAT_DATA
      // setelah TTL cache 1 jam expire dan Baileys mengirim groups event.
      const chat = this.getChat(normalized);

      // Skip write when metadata hasn't changed (it can be large)
      if (chat.metadata && isEqual(chat.metadata, metadata)) {
        logger.trace({ jid: normalized }, 'Metadata unchanged, skipping write');
        return;
      }

      chat.metadata = metadata;
      this.chatsCache.set(normalized, chat);
      this.writeBuffer.addChat(normalized, chat);

      logger.debug({ jid: normalized, participants: metadata.participants?.length }, 'Group metadata updated');
    } catch (err) {
      logger.error({ err: err.message, jid }, 'updateGroupMetadata failed');
    }
  }

  async fetchGroupMetadata(jid) {
    if (!this.conn) {
      logger.warn('fetchGroupMetadata: no connection');
      return null;
    }
    try {
      const normalized = jidNormalizedUser(jid);
      const metadata   = await this.conn.groupMetadata(normalized);
      if (metadata) {
        await this.updateGroupMetadata(normalized, metadata);
        return metadata;
      }
    } catch (err) {
      logger.error({ err: err.message, jid }, 'fetchGroupMetadata failed');
    }
    return null;
  }

  getCachedGroupMetadata() {
    return async (jid) => this.getGroupMetadata(jid) ?? await this.fetchGroupMetadata(jid);
  }

  // ==========================================================================
  // GROUP PARTICIPANT EVENTS
  // ==========================================================================

  async handleGroupParticipantsUpdate(update) {
    try {
      const { id, participants, action } = update;
      const normalized = jidNormalizedUser(id);
      logger.info({ group: normalized, action, participants: participants?.length }, 'Group participants update');
      const meta = await this.fetchGroupMetadata(normalized);
      if (!meta) logger.warn({ group: normalized }, 'Could not fetch metadata after participants update');
    } catch (err) {
      logger.error({ err: err.message, update }, 'handleGroupParticipantsUpdate failed');
    }
  }

  // ==========================================================================
  // BOT SETTINGS
  // ==========================================================================

  updateBotSettings(updates) {
    Object.assign(this.botSettings, updates);
    this.writeBuffer.setSettings(this.botSettings);
  }

  // ==========================================================================
  // BAILEYS INTEGRATION
  // ==========================================================================

  bind(conn) {
    this.conn = conn;
    if (conn.user?.id) this.botJid = conn.user.id;

    conn.ev.on('connection.update', ({ connection }) => {
      if (connection === 'open' && conn.user?.id) {
        this.botJid = conn.user.id;
        logger.debug({ botJid: this.botJid }, 'Bot JID cached');
      }
    });

    conn.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) if (c.id) this.upsertContact(c.id, c);
    });

    conn.ev.on('contacts.update', (updates) => {
      for (const u of updates) if (u.id) this.upsertContact(u.id, u);
    });

    conn.ev.on('group-participants.update', async (update) => {
      await this.handleGroupParticipantsUpdate(update);
    });

    conn.ev.on('groups.update', async (updates) => {
      for (const u of updates) {
        if (u.id) {
          logger.debug({ group: u.id }, 'groups.update event');
          await this.fetchGroupMetadata(u.id);
        }
      }
    });

    conn.ev.on('groups.upsert', async (groups) => {
      for (const g of groups) {
        if (g.id) {
          logger.info({ group: g.id }, 'New group detected');
          await this.fetchGroupMetadata(g.id);
        }
      }
    });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  isBotNumber(jid) {
    if (!jid || !this.botJid) return false;
    return jidNormalizedUser(jid) === jidNormalizedUser(this.botJid);
  }

  async reloadData() {
    try {
      logger.info('Reloading data from DB');
      this.chatsCache.clear();
      this.contactsCache.clear();
      this.membersCache.clear();
      this.groupMetadataCache.clear();
      await this._preloadData();
      logger.info('Data reloaded');
    } catch (err) {
      logger.error({ err: err.message }, 'reloadData failed');
    }
  }

  // ==========================================================================
  // CLEANUP / SHUTDOWN
  // ==========================================================================

  async cleanup() {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.chatsCache.stopAutoCleanup();
    this.contactsCache.stopAutoCleanup();
    this.membersCache.stopAutoCleanup();
    this.groupMetadataCache.stopAutoCleanup();

    // Final flush — temporarily re-enable so flush() doesn't bail out early
    logger.info('Final flush before shutdown...');
    this.isShuttingDown = false;
    await this.flush();
    this.isShuttingDown = true;

    if (this.db) {
      try {
        this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        this.db.exec('PRAGMA optimize');
        for (const stmt of Object.values(this.stmts)) {
          try { stmt?.finalize?.(); } catch (_) { /* ignore */ }
        }
        this.db.close();
        logger.info('Store closed');
      } catch (err) {
        logger.error({ err: err.message }, 'Error closing DB');
      }
    }

    this.chatsCache.clear();
    this.contactsCache.clear();
    this.membersCache.clear();
    this.groupMetadataCache.clear();

    logger.info('Store shutdown complete');
  }

  async shutdown() { await this.cleanup(); }
}

export default UnifiedStore;
