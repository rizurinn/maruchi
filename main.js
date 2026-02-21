import './global.js';
import makeWASocket, { fetchLatestBaileysVersion } from 'baileys';
import pino from 'pino';
import path from 'path';
import NodeCache from '@cacheable/node-cache';

import { log } from './lib/log.js';
import { createAuth } from './src/core/auth.js'; 
import { clientBot } from './src/core/client.js';
import { createConnection, printMessage } from './src/core/helper.js';
import serializeM from './src/core/serialize.js';
import { ConnectionManager } from './src/core/connection.js';
import { UnifiedStore } from './src/core/store.js';
import PluginLoader from './src/plugin/loader.js';
import { shutdownManager, signalHandler } from './src/core/shutdown.js';


const resources = {
  connectionManager: null,
  msgRetryCounterCache: null,
  store: null,
  pluginLoader: null,
  authStore: null,
  conn: null,
  baileyLogger: null,
};

function initializeResources() {
  resources.connectionManager = new ConnectionManager();
  shutdownManager.register(
    'connection-manager',
    resources.connectionManager,
    () => resources.connectionManager.cleanup(),
    { priority: 100 }
  );

  resources.msgRetryCounterCache = new NodeCache({
    stdTTL: 300,
    checkperiod: 60,
    useClones: false,
  });
  shutdownManager.register(
    'msg-retry-cache',
    resources.msgRetryCounterCache,
    () => resources.msgRetryCounterCache.flushAll(),
    { priority: 50 }
  );

  resources.store = new UnifiedStore();
  shutdownManager.register(
    'store',
    resources.store,
    async () => {
      if (typeof resources.store.cleanup === 'function') {
        await resources.store.cleanup();
      }
    },
    { priority: 80 }
  );

  const pluginDir = path.join(process.cwd(), 'plugin');
  resources.pluginLoader = new PluginLoader(pluginDir, {
    maxModules: 500,
    reloadDebounce: 300,
  });
  shutdownManager.register(
    'plugin-loader',
    resources.pluginLoader,
    () => resources.pluginLoader.destroy(),
    { priority: 70 }
  );

  resources.baileyLogger = pino({
    level: Bun.env.BAILEYS_LOG_LEVEL || 'silent',
    base: { module: 'BAILEYS' },
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: Bun.env.LOG_TIME_FORMAT,
        ignore: Bun.env.LOG_IGNORE,
      },
    },
  });
}

let isPairingRequesting = false;
async function setupPairingCode(conn) {
  if (conn.authState.creds.registered || isPairingRequesting) {
    return;
  }

  let phone = global.config.pairing;
  if (!phone) {
    log.debug('Nomor pairing tidak ditemukan');
    return;
  }
  phone = phone.replace(/\D/g, '');

  if (!phone.startsWith('62') && !phone.startsWith('31')) {
    log.warn({ phone }, 'Format nomor pairing tidak valid');
    return;
  }

  isPairingRequesting = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 4000));

    log.info({ phone: phone.substring(0, 5) + '***' }, 'Meminta kode pairng...');
    let code = await conn.requestPairingCode(phone);
    code = code?.match(/.{1,4}/g)?.join('-');

    log.info(`\x1b[32mKODE PAIRING: ${code}\x1b[0m`);
  } catch (e) {
    log.error({ err: e.message, stack: e.stack }, 'Kode pairing gagal diminta');
  } finally {
    isPairingRequesting = false;
  }
}

async function handleMessageUpsert(events, conn, authStore) {
  const { messages, type } = events['messages.upsert'];
  const { handler } = await import('./src/plugin/handler.js');

  for (const raw of messages) {
    if (type === 'append') continue;
    if (!raw.message) continue;
    const messageId = raw.key.id;
    if (messageId && resources.msgRetryCounterCache.get(messageId)) {
      log.trace({ messageId }, 'Melewati pesan duplikat.');
      continue;
    }
    if (messageId) {
      resources.msgRetryCounterCache.set(messageId, true);
    }

    try {
      const m = await serializeM(conn, raw, resources.store);
      if (!m) continue;

      await printMessage(conn, m);

      await handler(conn, m, resources.pluginLoader, resources.store);
    } catch (err) {
      log.error(
        {
          err: err.message,
          stack: err.stack,
          messageId,
          from: raw.key.remoteJid,
        },
        'Message handler error'
      );
    }
  }
}

async function maruchi() {
  let authStore;
  let conn;

  try {
    if (!resources.authStore) {
      authStore = await createAuth();
      resources.authStore = authStore;
    } else {
      authStore = resources.authStore;
    }

    const { version } = await fetchLatestBaileysVersion();
    log.info({ version: version.join('.') }, 'Versi WhatsApp Web dimuat');

    await resources.store.init();

    const connection = createConnection(
      version,
      authStore,
      resources.msgRetryCounterCache,
      resources.baileyLogger,
      resources.store
    );

    conn = makeWASocket(connection);

    conn.auth = authStore;
    resources.conn = conn;

    resources.store.bind(conn);

    shutdownManager.register(
      'wa-socket',
      conn,
      async () => {
        try {
          if (conn && typeof conn.end === 'function') {
            await conn.end();
          }
        } catch (e) {
          log.debug({ err: e.message }, 'Socket end tidak valid (mungkin sudah berhasil ditutup)');
        }
      },
      { priority: 95 }
    );

    await clientBot(conn);

    conn.ev.process(async (events) => {
      try {
        if (events['creds.update']) {
          await authStore.saveCredentials();
        }

        if (events['connection.update']) {
          await resources.connectionManager.handleConnectionUpdate(events['connection.update'], {
            conn,
            authStore,
            setupPairingCode,
            pluginLoader: resources.pluginLoader,
            store: resources.store,
            reconnectCallback: async () => {
              log.info('Reconnection callback terpicu');
              await maruchi();
            },
          });
        }

        if (events['messages.upsert']) {
          await handleMessageUpsert(events, conn, authStore);
        }
      } catch (err) {
        log.error(
          {
            err: err.message,
            stack: err.stack,
          },
          'Event processing error'
        );
      }
    });

    return conn;
  } catch (err) {
    log.error(
      {
        err: err.message,
        stack: err.stack,
      },
      'Inisialisasi maruchi error'
    );
    throw err;
  }
}

async function startup() {
  try {
    initializeResources();
    signalHandler.register();
    await maruchi();
  } catch (err) {
    log.fatal(
      {
        err: err.message,
        stack: err.stack,
      },
      'Startup gagal'
    );

    try {
      await shutdownManager.shutdown('startup_error');
    } catch (shutdownErr) {
      log.fatal({ err: shutdownErr.message }, 'Shutdown setelah kesalahan startup gagal');
    }

    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  log.error(
    {
      error: err.message,
      stack: err.stack,
    },
    'Uncaught Exception'
  );
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(
    {
      reason: reason?.message || String(reason),
      stack: reason?.stack,
    },
    'Unhandled Rejection'
  );
});

startup().catch((err) => {
  log.fatal(
    {
      error: err.message,
      stack: err.stack,
    },
    'Fatal startup'
  );
  process.exit(1);
});
