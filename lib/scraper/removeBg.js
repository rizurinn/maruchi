import { promises as fs } from "fs";
import path from "path";

const api = {
  base: "https://removal.ai",
  remove: "https://api.removal.ai",
  endpoint: {
    webtoken: "/wp-admin/admin-ajax.php",
    remove: "/3.0/remove",
    slug: "/upload/",
  },
};

const baseHeaders = { "user-agent": "Postify/1.0.0" };

export async function removeBg(input) {
  const { buf, filename, mime } = await resolveInput(input);

  const security = await getSecurityToken();
  const webtoken = await getWebToken(security);

  const blob = new Blob([buf], { type: mime });
  const form = new FormData();
  form.append("image_file", blob, filename);

  const res = await fetch(`${api.remove}${api.endpoint.remove}`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      origin: api.base,
      "web-token": webtoken,
    },
    body: form,
  });

  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`Upload gagal ${res.status} ${res.statusText}${t ? ` — ${t}` : ""}`);
  }

  const json = await res.json();
  const { url } = json ?? {};
  if (!url) throw new Error("Respon tidak berisi URL hasil.");
  return url;
}

async function resolveInput(input) {
  if (typeof input === "string" && /^https?:\/\//i.test(input)) {
    const r = await fetch(input);
    if (!r.ok) {
      const t = await safeText(r);
      throw new Error(`Gagal unduh URL (${r.status} ${r.statusText})${t ? ` — ${t}` : ""}`);
    }
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const name = baseNameFromUrl(input) || "image";
    const mime = pickMime(ct) || sniffMime(buf) || "image/jpeg";
    const filename = ensureExt(name, mime);
    return { buf, filename, mime };
  }

  if (typeof input === "string") {
    const buf = await fs.readFile(input);
    const filename = path.basename(input);
    const mime = pickMimeFromExt(filename) || sniffMime(buf) || "image/jpeg";
    return { buf, filename, mime };
  }

  if (Buffer.isBuffer(input) || input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const mime = sniffMime(buf) || "image/png";
    const filename = ensureExt("buffer_image", mime);
    return { buf, filename, mime };
  }

  throw new Error("Harus berupa URL, image path, atau Buffer.");
}

async function getSecurityToken() {
  const res = await fetch(`${api.base}${api.endpoint.slug}`, {
    headers: baseHeaders,
  });
  if (!res.ok) throw new Error(`Gagal ambil halaman upload (${res.status})`);
  const html = await res.text();
  const m = html.match(/ajax_upload_object\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error("Token 'ajax_upload_object' tidak ditemukan.");
  let security;
  try { security = JSON.parse(m[1]).security; } catch {
    throw new Error("Gagal parse security token.");
  }
  if (!security) throw new Error("Security token kosong.");
  return security;
}

async function getWebToken(security) {
  const params = new URLSearchParams({ action: "ajax_get_webtoken", security });
  const res = await fetch(`${api.base}${api.endpoint.webtoken}?${params.toString()}`, {
    headers: {
      ...baseHeaders,
      Referer: `${api.base}${api.endpoint.slug}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`Gagal ambil webtoken (${res.status})${t ? ` — ${t}` : ""}`);
  }
  const json = await res.json();
  const token = json?.data?.webtoken;
  if (!token) throw new Error("Webtoken tidak ditemukan di respons.");
  return token;
}

function baseNameFromUrl(u) {
  try {
    const url = new URL(u);
    const raw = url.pathname.split("/").pop() || "";
    const name = raw.split("#")[0].split("?")[0];
    return name || null;
  } catch { return null; }
}

function pickMime(ct) {
  if (!ct) return null;
  const m = ct.split(";")[0].trim().toLowerCase();
  if (m.startsWith("image/")) return m;
  return null;
}

function pickMimeFromExt(name) {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".heic": return "image/heic";
    default: return null;
  }
}

function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  // PNG
  if (buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4E && buf[3]===0x47) return "image/png";
  // JPEG
  if (buf[0]===0xFF && buf[1]===0xD8 && buf[2]===0xFF) return "image/jpeg";
  // GIF87a/GIF89a
  if (buf[0]===0x47 && buf[1]===0x49 && buf[2]===0x46 && buf[3]===0x38 && (buf[4]===0x37||buf[4]===0x39) && buf[5]===0x61) return "image/gif";
  // WEBP (RIFF....WEBP)
  if (buf[0]===0x52 && buf[1]===0x49 && buf[2]===0x46 && buf[3]===0x46 && buf[8]===0x57 && buf[9]===0x45 && buf[10]===0x42 && buf[11]===0x50) return "image/webp";
  // HEIC/HEIF (ftypheic/ftypheix/mif1)
  if (buf[4]===0x66 && buf[5]===0x74 && buf[6]===0x79 && buf[7]===0x70) {
    const brand = buf.subarray(8,12).toString();
    if (brand === "heic" || brand === "heix" || brand === "mif1") return "image/heic";
  }
  return null;
}

function ensureExt(name, mime) {
  const ext =
    mime === "image/png"  ? ".png"  :
    mime === "image/jpeg" ? ".jpg"  :
    mime === "image/webp" ? ".webp" :
    mime === "image/gif"  ? ".gif"  :
    mime === "image/heic" ? ".heic" : ".bin";
  const base = name.replace(/[^\w.-]+/g, "_").slice(0, 120) || "file";
  return base.endsWith(ext) ? base : base + ext;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}
