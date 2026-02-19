class Emailnator {
  constructor() {
    this.baseUrl = "https://www.emailnator.com";
    this.address = "";
    this.cookies = "";
    this.xsrf = "";
  }

  async _getSession() {
    const res = await fetch(this.baseUrl + "/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      }
    });

    if (!res.ok) throw new Error("Gagal mengambil session Emailnator");

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    let cookieJar = [];
    let xsrfToken = "";

    for (const cookieStr of setCookies) {
      const [pair] = cookieStr.split(";");
      cookieJar.push(pair);
      if (pair.startsWith("XSRF-TOKEN=")) {
        xsrfToken = decodeURIComponent(pair.split("=")[1]);
      }
    }

    this.cookies = cookieJar.join("; ");
    this.xsrf = xsrfToken;
  }

  async _request(endpoint, payload) {
    if (!this.cookies || !this.xsrf) await this._getSession();

    const res = await fetch(this.baseUrl + endpoint, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "x-xsrf-token": this.xsrf,
        "Cookie": this.cookies,
        "Origin": this.baseUrl,
        "Referer": this.baseUrl + "/"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) throw new Error(`Emailnator HTTP ${res.status}: ${text.substring(0, 100)}`);
    return data;
  }

  async createAccount() {
    try {
      await this._getSession();
      
      // Request generate email (Gmail aliases)
      const data = await this._request("/generate-email", { email: ["plusGmail", "dotGmail", "googleMail"] });

      if (Array.isArray(data.email) && data.email.length > 0) {
        this.address = data.email[0]; // Ambil email yang ter-generate
        return { success: true, address: this.address, raw: data };
      }
      
      throw new Error("Respons Emailnator tidak valid atau gagal menghasilkan email");
    } catch (e) {
      return { success: false, message: e.message, raw: e };
    }
  }

  async waitForOTP(timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        // Cek Inbox
        const inboxRes = await this._request("/message-list", { email: this.address });
        const inbox = inboxRes.messageData || [];
        
        // Abaikan email iklan dari Emailnator
        const mail = inbox.find(m => m.messageID !== "ADSVPN");

        if (mail) {
          // Buka isi email
          const htmlData = await this._request("/message-list", { email: this.address, messageID: mail.messageID });
          
          // Cari angka 6 digit di dalam konten email (OTP)
          const match = htmlData.match(/\b\d{6}\b/);
          if (match) {
            return { code: match[0], raw: htmlData };
          }
        }
      } catch (e) {
        // Abaikan error jaringan kecil saat polling, lanjut cek lagi
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error("OTP_TIMEOUT");
  }
}

export default class NanobanaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "https://www.nanobana.net";
    this.verbose = options.verbose !== undefined ? options.verbose : true;
    this.cookieJar = new Map();
    // Menggunakan kelas Emailnator yang baru, menggantikan MailTM
    this.mail = new Emailnator(); 
  }

  log(msg) {
    if (this.verbose) console.log(msg);
  }

  response(code, message, payload = null, raw = null, source = "system") {
    return {
      code,
      message,
      data: {
        payload,
        raw,
        meta: { source, status_code: raw?.status || (code === 0 ? 200 : 400), timestamp: new Date().toISOString() },
      },
    };
  }

  getCookieString() {
    return Array.from(this.cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async _request(method, endpoint, payload = null, customHeaders = {}, isFormData = false, manualRedirect = false) {
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.baseUrl,
      "Origin": this.baseUrl,
      "Accept": "application/json",
      ...customHeaders
    });

    const cookieString = this.getCookieString();
    if (cookieString) headers.set("Cookie", cookieString);

    const options = { method, headers };
    if (manualRedirect) options.redirect = "manual"; 

    if (payload) {
      if (isFormData) {
        options.body = payload;
      } else if (payload instanceof URLSearchParams) {
        options.body = payload;
        headers.set("Content-Type", "application/x-www-form-urlencoded");
      } else {
        options.body = JSON.stringify(payload);
        headers.set("Content-Type", "application/json");
      }
    }

    const res = await fetch(url, options);

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    setCookies.forEach((c) => {
      const [pair] = c.split(";");
      const [key, ...val] = pair.split("=");
      if (key) this.cookieJar.set(key.trim(), val.join("=").trim());
    });

    if (manualRedirect && (res.status === 302 || res.status === 303)) {
         return { data: { url: res.headers.get('location') }, status: res.status };
    }

    let data;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) throw { message: `HTTP ${res.status}`, response: { data } };
    return { data, status: res.status };
  }

  async login() {
    this.log("[Auth] Initiating automated session...");
    try {
      const acc = await this.mail.createAccount();
      if (!acc.success) return this.response(1, "Email service unavailable", null, acc.raw, "emailnator");

      const email = acc.address;
      const sendRes = await this._request("POST", "/api/auth/email/send", { email });

      if (sendRes.data?.code !== 0) {
        return this.response(1, sendRes.data?.msg || "OTP request denied", null, sendRes.data, "nanobana-auth");
      }

      this.log(`[Auth] Waiting for OTP at ${email}...`);
      const otpObj = await this.mail.waitForOTP().catch(() => null);
      if (!otpObj) return this.response(1, "OTP timeout", null, null, "emailnator");

      const csrfRes = await this._request("GET", "/api/auth/csrf");
      const csrfToken = csrfRes.data?.csrfToken;

      const params = new URLSearchParams({
        email, code: otpObj.code, csrfToken, callbackUrl: `${this.baseUrl}/`, json: "true",
      });

      const loginRes = await this._request("POST", "/api/auth/callback/email-code", params, {
        "X-Auth-Return-Redirect": "1",
      }, false, true);

      if (loginRes.data?.url) {
        await this._request("GET", loginRes.data.url);
      }

      const cookies = this.getCookieString();
      const hasSession = cookies.toLowerCase().includes("session-token");

      if (!hasSession) return this.response(1, "Session token missing", null, loginRes.data, "nanobana-auth");

      return this.response(0, "Authentication successful", { email, cookies, session_verified: true }, loginRes.data, "nanobana-auth");
    } catch (error) {
      return this.response(1, error.message, null, error.response?.data, "system");
    }
  }

  async uploadImage(imageBuffer) {
    const form = new FormData();
    const blob = new Blob([imageBuffer], { type: "image/png" });
    form.append("file", blob, "upload.png");
    
    const res = await this._request("POST", "/api/upload/image", form, {}, true);
    return res.data?.url;
  }

  async generateImage(params) {
    try {
      let { prompt, model = "nano-banana", image = null, aspectRatio = "1:1", resolution = "1K", outputFormat = "png" } = params;
      let uploadedUrl = null;
      
      if (image) {
        uploadedUrl = await this.uploadImage(image);
        if (!uploadedUrl) return this.response(1, "Source image upload failed");
      }

      const isPro = model === "nano-banana-pro";
      const endpoint = isPro ? "/api/nano-banana-pro/generate" : uploadedUrl ? "/api/nano-banana/image-to-image/generate" : "/api/nano-banana/text-to-image/generate";
      const pollEndpoint = isPro ? "/api/nano-banana-pro/task" : uploadedUrl ? "/api/nano-banana/image-to-image/task" : "/api/nano-banana/text-to-image/task";

      const payload = { prompt, output_format: outputFormat };
      if (isPro) {
        Object.assign(payload, { aspect_ratio: aspectRatio, resolution });
        if (uploadedUrl) {
            payload.image_input = [uploadedUrl];
        }
      } else {
        payload.image_size = aspectRatio;
        if (uploadedUrl) payload.imageInputs = [{ url: uploadedUrl }];
      }

      const res = await this._request("POST", endpoint, payload);
      const taskId = res.data.taskId || res.data.data?.taskId || res.data.data?.task_id;

      if (taskId) return this.response(0, "Task created", { taskId, pollEndpoint, model }, res.data, "nanobana-api");
      return this.response(1, res.data.message || "Generation rejected", null, res.data, "nanobana-api");
    } catch (e) {
      return this.response(1, e.message, null, e.response?.data, "system");
    }
  }

  async generateVideo(params) {
    try {
      let { prompt, model = "sora2", image = null, aspectRatio = "16:9", duration = "10s" } = params;
      let uploadedUrl = null;

      if (image) {
        uploadedUrl = await this.uploadImage(image);
        if (!uploadedUrl) return this.response(1, "Source image upload failed");
      }

      const mode = uploadedUrl ? "image-to-video" : "text-to-video";
      const apiBase = model === "sora2-pro" ? "/api/sora2-pro" : "/api/sora2";
      const endpoint = `${apiBase}/${mode}/generate`;
      const pollEndpoint = `${apiBase}/${mode}/task`;

      const nFrames = ["5", "10", "15"].includes(duration.replace("s", "")) ? duration.replace("s", "") : "10";
      const payload = { prompt, n_frames: nFrames, remove_watermark: true, aspect_ratio: aspectRatio === "16:9" ? "landscape" : "portrait" };
      
      if (model === "sora2-pro") payload.size = "high";
      if (uploadedUrl) payload.image_urls = [uploadedUrl];

      const res = await this._request("POST", endpoint, payload);
      const taskId = res.data.taskId || res.data.data?.taskId || res.data.data?.task_id;

      if (taskId) return this.response(0, "Task created", { taskId, pollEndpoint, model }, res.data, "nanobana-api");
      return this.response(1, res.data.message || "Video task rejected", null, res.data, "nanobana-api");
    } catch (e) {
      return this.response(1, e.message, null, e.response?.data, "system");
    }
  }

  async waitTask(taskRef, interval = 5000) {
    const { taskId, pollEndpoint } = taskRef.data?.payload || taskRef;
    if (!taskId || !pollEndpoint) return this.response(1, "Invalid task reference");

    this.log(`[Task] Monitoring ${taskId}...`);
    let attempts = 0;
    while (attempts < 60) {
      try {
        const res = await this._request("GET", `${pollEndpoint}/${taskId}?save=1`);
        const data = res.data.data || res.data;
        if (this.verbose) process.stdout.write(`\r[Task] Status: ${data.status}   `);

        if (data.status === "completed") {
          if (this.verbose) process.stdout.write("\n");
          const results = data.resultUrls || data.result?.images || data.result?.videos || data.result;
          return this.response(0, "Task completed", results, res.data, "nanobana-api");
        }
        if (data.status === "failed") {
          if (this.verbose) process.stdout.write("\n");
          return this.response(1, data.error?.message || data.failMsg || "Execution failed", null, res.data, "nanobana-api");
        }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, interval));
      attempts++;
    }
    return this.response(1, "Task Timeout", null, null, "system");
  }
}
