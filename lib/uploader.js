import crypto from 'crypto';
import Func from './funcc.js';
import { log } from './log.js';

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
};

const generateFilename = (ext, prefix = '') => {
    const randomBytes = crypto.randomBytes(5).toString("hex");
    return prefix ? `${prefix}_${randomBytes}.${ext}` : `${randomBytes}.${ext}`;
};

const createFormData = (buffer, fieldName, filename, mime) => {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mime || 'application/octet-stream' });
    formData.append(fieldName, blob, filename);
    return formData;
};

async function catbox(buffer, customFilename = null) {
    if (!buffer) throw new Error("Buffer tidak boleh kosong");
    const type = await Func.fileTypeFromBuffer(buffer);

    try {
        const filename = customFilename || generateFilename(type.ext, '.bin');
        const formData = new FormData();
        const blob = new Blob([buffer], { type: type.mime });
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', blob, filename);

        const res = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            headers: DEFAULT_HEADERS,
            body: formData,
        });

        const text = await res.text();
        if (!text.startsWith("http")) {
            throw new Error("Upload gagal atau response tidak valid dari Catbox");
        }
        return text.trim();
    } catch (err) {
        log.error({ error: err.message }, "Catbox error:");
        throw err;
    }
}

async function uguu(buffer, customFilename = null) {
    if (!buffer) throw new Error("Buffer tidak boleh kosong");
    const type = await Func.fileTypeFromBuffer(buffer);

    try {
        const filename = customFilename || generateFilename(type.ext, '.bin');
        const formData = createFormData(buffer, 'files[]', filename, type.mime);

        const res = await fetch("https://uguu.se/upload.php", {
            method: "POST",
            headers: DEFAULT_HEADERS,
            body: formData,
        });

        const json = await res.json();
        if (!json?.files?.[0]?.url) {
            throw new Error("Upload gagal atau response tidak valid dari Uguu");
        }
        return json.files[0].url.trim();
    } catch (err) {
        log.error({ error: err.message }, "Uguu error");
        throw err;
    }
}

async function quax(buffer, customFilename = null) {
    if (!buffer) throw new Error("Buffer tidak boleh kosong");
    const type = await Func.fileTypeFromBuffer(buffer);

    try {
        const filename = customFilename || generateFilename(type.ext, '.bin');
        const formData = createFormData(buffer, 'files[]', filename, type.mime);

        const res = await fetch("https://qu.ax/upload.php", {
            method: "POST",
            headers: DEFAULT_HEADERS,
            body: formData,
        });

        const json = await res.json();
        if (!json?.files?.[0]?.url) {
            throw new Error("Upload gagal atau response tidak valid dari Qu.ax");
        }
        return json.files[0].url.trim();
    } catch (err) {
        log.error({ error: err.message }, "Qu.ax error");
        throw err;
    }
}

async function picu(buffer) {
    if (!buffer) throw new Error("Buffer tidak boleh kosong");
    try {
        const res = await fetch("https://put.icu/upload/", {
            method: "PUT",
            headers: { 
                ...DEFAULT_HEADERS, 
                Accept: "application/json" 
            },
            body: buffer,
        });

        const json = await res.json();
        if (!json?.direct_url) {
            throw new Error("Upload gagal atau response tidak valid dari Put.icu");
        }
        return json.direct_url.trim();
    } catch (err) {
        log.error({ error: err.message }, "Put.icu error");
        throw err;
    }
}

async function tmpfiles(buffer, customFilename = null) {
    if (!buffer) throw new Error("Buffer tidak boleh kosong");
    const type = await Func.fileTypeFromBuffer(buffer);

    try {
        const filename = customFilename || generateFilename(type.ext, '.bin');
        const formData = createFormData(buffer, 'file', filename, type.mime);

        const res = await fetch("https://tmpfiles.org/api/v1/upload", {
            method: "POST",
            headers: DEFAULT_HEADERS,
            body: formData,
        });

        const json = await res.json();
        if (!json?.data?.url) {
            throw new Error("Upload gagal atau response tidak valid dari Tmpfiles");
        }
        
        const match = /https?:\/\/tmpfiles.org\/(.*)/.exec(json.data.url);
        return `https://tmpfiles.org/dl/${match[1]}`;
    } catch (err) {
        log.error({ error: err.message }, "Tmpfiles error");
        throw err;
    }
}

async function pomf2(buffer, customFilename = null) {
    if (!buffer) throw new Error("Buffer tidak boleh kosong");
    const type = await Func.fileTypeFromBuffer(buffer);

    try {
        const filename = customFilename || generateFilename(type.ext, '.bin');
        const formData = createFormData(buffer, 'files[]', filename, type.mime);

        const res = await fetch('https://pomf2.lain.la/upload.php', {
            method: 'POST',
            headers: DEFAULT_HEADERS,
            body: formData
        });

        const json = await res.json();
        if (!json.success || !json.files?.[0]?.url) {
            throw new Error("Upload failed");
        }
        return json.files[0].url;
    } catch (err) {
        log.error({ error: err.message }, "Pomf2 error");
        throw err;
    }
}

async function uploadFile(buffer, customFilename = null, preferredServices = null) {
    const allServices = [
        { name: 'catbox', fn: catbox, supportsCustom: true },
        { name: 'pomf2', fn: pomf2, supportsCustom: true },
        { name: 'tmpfiles', fn: tmpfiles, supportsCustom: true },
        { name: 'quax', fn: quax, supportsCustom: true },
        { name: 'uguu', fn: uguu, supportsCustom: true },
        { name: 'picu', fn: picu, supportsCustom: false },
    ];
    const servicesToTry = preferredServices 
        ? allServices.filter(s => preferredServices.includes(s.name))
        : allServices;

    const errors = [];

    for (const service of servicesToTry) {
        try {
            const url = service.supportsCustom 
                ? await service.fn(buffer, customFilename)
                : await service.fn(buffer);
            
            return url;
        } catch (error) {
            log.error({ error: error.message }, `Gagal pada ${service.name}:`);
            errors.push({ service: service.name, error: error.message });
            continue;
        }
    }

    throw new Error(`Semua layanan upload gagal. Error: ${JSON.stringify(errors, null, 2)}`);
}

export default {
    catbox,
    uguu,
    quax,
    picu,
    tmpfiles,
    pomf2,
    uploadFile
};
