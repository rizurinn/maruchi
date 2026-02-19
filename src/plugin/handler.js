import { log } from "../../lib/log.js";
import Func from "../../lib/funcc.js";
import Uploader from "../../lib/uploader.js";

// Static Regex to avoid recreation
const CMD_PREFIX_RE = /^[/!.|•√§∆%✓&?]/;

// WeakMaps for automatic GC when message objects are lost
const executionContext = new WeakMap();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safe executor wrapper
 */
const safe = async (fn) => {
  try { return await fn(); } 
  catch (e) { 
      log.error({ err: e.message }, 'Safe execution failed');
      return null; 
  }
};

export async function handler(conn, m, pluginLoader, store) {
  try {
    if (!m || !m.body) return;
    const loader = pluginLoader;
    
    // Auto-load trigger
    if ((!loader.plugins || loader.plugins.size === 0) && !loader.___loading) {
        loader.___loading = true;
        loader.loadAll().finally(() => loader.___loading = false);
        return;
    }

    const senderLid = m.sender ? m.sender.split("@")[0] : "";
    const regOwners = global.config.owner.map((id) => id.toString().split("@")[0]);
    const isOwner = m.fromMe || regOwners.includes(senderLid);

    const settings = store.botSettings;
    const chats = store.getChat(m.chat);
    const member = store.getMember(m.chat, m.sender);

    if (member?.blacklist !== -1 && !isOwner) return false;
    if (settings.self && !isOwner) return false;
    if (m.isGroup && chats.mute && !m.isAdmin && !isOwner) return false;
    if (settings.autoread) safe(() => conn.readMessages?.([m.key]));
  
    const body = m.body.trim();
    
    // 2. Queue & Prefix Check Logic (Simplified)
    const prefixResult = parsePrefix(body, store);
    const isCmd = !!prefixResult;
    
    // Jika bukan command dan tidak ada before handler, skip
    if (!isCmd && (!loader.router.before || loader.router.before.length === 0)) {
        return;
    }

    // 3. Execution Context
    const context = {
        conn, m, isOwner, loader, store,
        executed: false
    };
    executionContext.set(m, context);

    // 4. Run 'Before' Handlers
    // Gunakan for...of loop standar agar bisa di-break (return true)
    const beforeHandlers = loader.getBeforeHandlers();
    if (beforeHandlers.length > 0) {
        for (const { fn, filename } of beforeHandlers) {
            try {
                // Gunakan .call untuk memastikan 'this' adalah conn
                const stop = await fn.call(conn, m, { ...context, ___filename: filename });
                if (stop) {
                    executionContext.delete(m); // Cleanup WeakMap key
                    return;
                }
            } catch (err) {
                log.error({ err: err.message, plugin: filename }, 'Before handler error');
            }
        }
    }

    // 5. Command Processing
    if (isCmd) {
        const { command, args, text, usedPrefix } = prefixResult;
        
        // Coba cari command
        const plugins = loader.findByCommand(command);
        let executed = false;

        if (plugins.length > 0) {
            for (const plugData of plugins) {
                if (await executePlugin(conn, m, plugData, {
                    ...context,
                    args, text, usedPrefix, command
                })) {
                    executed = true;
                    break;
                }
            }
        }

        // Jika tidak ketemu command, cek regex & custom matcher
        if (!executed) {
            // Regex
            for (const plugData of loader.router.regex) {
                 const match = body.match(plugData.regex);
                 if (match) {
                     if (await executePlugin(conn, m, plugData, {
                         ...context, args, text, match
                     })) break;
                 }
            }
            
            // Custom Prefix
            const customs = loader.findByCustomPrefix(body);
            for (const plugData of customs) {
                 if (await executePlugin(conn, m, plugData, { ...context })) break;
            }
        }
    }

    // 6. Run 'All' Handlers (Fire and Forget)
    // Gunakan setImmediate agar tidak memblokir respon utama
    const allHandlers = loader.getAllHandlers();
    if (allHandlers.length > 0) {
        setImmediate(() => {
            allHandlers.forEach(({ fn, filename }) => {
                safe(() => fn.call(conn, m, { ...context, ___filename: filename }));
            });
        });
    }

  } catch (err) {
    log.error({ err: err.message }, 'Handler fatal error');
  }
}

// ---- Helpers ----

function parsePrefix(body, store) {
    const rawPrefix = store.botSettings.prefix || '.';
    const prefixes = Array.isArray(rawPrefix) ? rawPrefix : [rawPrefix];
    const pattern = prefixes.map(escapeRegex).join('|');
    const CMD_PREFIX_RE = new RegExp(`^(${pattern})`);

    const match = CMD_PREFIX_RE.exec(body);
    if (match) {
       const usedPrefix = match[0];
       const noPrefix = body.slice(usedPrefix.length);

       const [commandRaw, ...rest] = noPrefix.trimStart().split(/\s+/);
       const command = commandRaw.toLowerCase();

       const args = rest;

       const text = noPrefix
        .trimStart()
        .slice(commandRaw.length)
        .trimStart();

       return { usedPrefix, command, args, text };
    }
}

const checkRestrictions = (plugin, m, isOwner) => {
  const restrict = plugin?.restrict ?? plugin?.restriction ?? null;
  if (!restrict) return { allowed: true };
  
  if (restrict.ownerOnly && !isOwner) return { allowed: false, message: "🍬 *Perintah hanya dapat digunakan oleh pemilik bot saja.*" };
  if (restrict.groupOnly && !m.isGroup) return { allowed: false, message: "🍕 *Perintah ini hanya dapat digunakan di dalam grup.*" };
  if (restrict.privateOnly && m.isGroup) return { allowed: false, message: "🍡 *Perintah ini hanya dapat digunakan pada pesan pribadi.*" };
  if (restrict.botAdminOnly && !m.isBotAdmin) return { allowed: false, message: "🍫 *Bot ini harus menjadi admin dalam grup untuk menggunakan perintah ini.*" };
  if (restrict.adminOnly && !m.isAdmin && !isOwner) return { allowed: false, message: "🧃 *Perintah ini hanya dapat digunakan oleh admin grup saja.*" };
  
  return { allowed: true };
};

async function executePlugin(conn, m, { plugin, fn, filename }, extra) {
    try {
        if (plugin.disabled) return m.reply('🍓 *Perintah ini tidak dapat digunakan untuk saat ini.*');

        // Restriction Checks
        const access = checkRestrictions(plugin, m, extra.isOwner);
        if (!access.allowed) {
           safe(() => m.reply(access.message));
           return false;
        }

        const loading = async (back = false) => {
        if (back) {
             await conn.sendPresenceUpdate("paused", m.chat);
             await Bun.sleep(800);
             await conn.sendPresenceUpdate("available", m.chat);
           } else {
             await conn.sendPresenceUpdate("composing", m.chat);
           }
        };

        await fn.call(conn, m, {
            ...extra,
            ___filename: filename,
            loading,
            Func, Uploader // Inject utils
        });
        return true;
    } catch (e) {
        log.error({ err: e.message, plugin: filename }, 'Plugin execution failed');
        const cutErr = e.stack?.length > 100 ? e.stack?.substring(0, 200) + '...' : e?.stack || e.message;
        m.reply(`🍓 *Error: ${filename}*\n\n\`\`\`${cutErr.trim()}\`\`\``);
        return true;
    }
}
