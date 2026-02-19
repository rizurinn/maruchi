import { Browsers } from "baileys";
import { log } from "../../lib/log.js";

export function createConnection(baileysVersion, auth, msgRetryCounterCache, baileyLogger, store) {
    return {
        version: baileysVersion,
        logger: baileyLogger,
        browser: Browsers.macOS("Safari"),
        auth: auth.state,
        msgRetryCounterCache,
        cachedGroupMetadata: (jid) => store.getGroupMetadata(jid),
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        printQRInTerminal: false,
        shouldIgnoreJid: (jid) => {
            if (!jid) return true;
            return jid.endsWith("@broadcast") || jid.startsWith("status@broadcast");
        },
    };
}

export const URL_PATTERNS = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/|youtu\.be\/|music\.youtube\.com\/|youtube\.com\/live\/)[\w\-_]+/i,
  mediafire: /^(https?:\/\/)?(www\.)?mediafire\.com\/(file|view|download)\/[\w\d]+/i,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/[\w\-_]+/i,
  tiktok: /^(https?:\/\/)?(www\.)?(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)\/[\w\-_@]+/i,
  twitter: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[\w]+\/status\/[\d]+/i,
  facebook: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/[\w\-._]+/i,
  pinterest: /^(https?:\/\/)?([\w]+\.)?pinterest\.(com|co\.uk|ca|fr|de|it|es|id|ph|au|nz|jp|kr|mx|br|cl|ar)\/pin\/[\w\-]+\/?|^(https?:\/\/)?(www\.)?pin\.it\/[\w\-]+\/?/i,
  spotify: /^(https?:\/\/)?(www\.)?open\.spotify\.com\/(track|album|playlist|episode)\/[\w]+/i,
  soundcloud: /^(https?:\/\/)?(www\.)?soundcloud\.com\/[\w\-_]+\/[\w\-_]+/i,
  gdrive: /^(https?:\/\/)?(drive|docs)\.google\.com\/(file\/d\/|open\?id=|uc\?id=)[\w\-_]+/i,
  mega: /^(https?:\/\/)?(www\.)?mega\.(nz|co\.nz|io)\/(file|folder|#!)\/[\w\-_!#]+/i,
  zippyshare: /^(https?:\/\/)?(www\d+\.)?zippyshare\.com\/v\/[\w]+\/file\.html/i,
  terabox: /^(https?:\/\/)?(www\.)?(terabox\.com|teraboxapp\.com|1024terabox\.com)\/s\/[\w\-_]+/i,
  github: /^(https?:\/\/)?(www\.)?github\.com\/[\w\-_]+\/[\w\-_]+/i,
  twitch: /^(https?:\/\/)?(www\.)?twitch\.tv\/(videos\/[\d]+|[\w\-_]+)/i,
  reddit: /^(https?:\/\/)?(www\.)?reddit\.com\/r\/[\w]+\/comments\/[\w]+/i,
  imgur: /^(https?:\/\/)?(www\.)?(imgur\.com|i\.imgur\.com)\/(a\/|gallery\/)?[\w]+/i,
  capcut: /^(https?:\/\/)?(www\.)?capcut\.com\/(t|template|video)\/[\w\-_]+/i,
  wikipedia: /^(https?:\/\/)?([\w-]+\.)?(m\.)?wikipedia\.org\/wiki\/[\w\-_.()%:#\u0080-\uFFFF]+/i,
};

export function extractUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}

export function getUrlFromMessage(m) {
  if (m.body) {
    const url = extractUrl(m.body);
    if (url) return url;
  }
  
  if (m.quoted) {
    const quotedText = m.quoted?.body || m.quoted[m.quoted?.type]?.caption || '';
    const url = extractUrl(quotedText);
    if (url) return url;
  }
  
  return null;
}

export function validateUrl(url, regex) {
  if (!url || !regex) return false;
  return regex.test(url);
}

export async function printMessage(conn, m) {
  if (conn.user?.noprint) return;
  if (!conn || !m.sender) return;
  
  const sender = m.sender?.split('@')[0] || m.sender;
  const chat = m.isGroup ? (m.metadata?.subject || m.chat) : 'Private';
  const body = m.body?.length > 60 ? m.body.slice(0, 60) + '...' : m.body;
  
  log.info(`\x1b[1m[PESAN]\x1b[0m \x1b[33m${m.pushName || 'Unknown'}\x1b[0m \x1b[90m${sender}\x1b[0m ${m.type}`);
  log.info(`\x1b[32m${chat}\x1b[0m`);
  if (m.body) {
    log.info(`\x1b[2m  ↳ ${body}\x1b[0m`);
  }
}
