import { getUrlFromMessage, URL_PATTERNS, validateUrl } from './src/core/helper.js';
import PluginLoader from './src/plugin/loader.js';
import { log } from './lib/log.js';

const initializeConfig = () => {
    const ownersEnv = (Bun.env.OWNERS || "").trim();
    let owners = [];

    if (ownersEnv) {
        try {
            const parsed = JSON.parse(ownersEnv);
            if (Array.isArray(parsed)) {
                owners = parsed.filter((o) => typeof o === "string" && o.trim());
            }
        } catch {
            log.warn("Format OWNER tidak valid.");
        }
    }

    const config = {
        owner: owners,
        pairing: (Bun.env.PAIRING_NUMBER || "").trim(),
        packnames: Bun.env.STICKPACK || "",
        authors: Bun.env.STICKAUTH || "",
        apikey: {
            fgsi: Bun.env.FGSI || "",
            paxsenix: Bun.env.PAXSENIX || "",
            gemini: Bun.env.GEMINI_STUDIO || "",
            gcloud: Bun.env.GOOGLE_CLOUD || ""
        }
    };

    return config;
};

global.config = initializeConfig();

global.validUrl = function getValidUrl(m, platform = null) {
  const url = getUrlFromMessage(m);
  if (!url) return null;
  if (!platform) return url;
  const pattern = URL_PATTERNS[platform.toLowerCase()];
  if (!pattern) return url;
  return validateUrl(url, pattern) ? url : null;
};
