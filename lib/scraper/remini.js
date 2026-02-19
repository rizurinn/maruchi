import crypto from 'crypto';

const BASE_URL = "https://app.remini.ai";
const URL_USER = "/api/v1/web/users";
const URL_BULK = "/api/v1/web/tasks/bulk-upload";
const URL_APPROVAL = "/api/v1/web/tasks/bulk-upload/BULK_UPLOAD_ID/process";
const URL_TASK = "/api/v1/web/tasks/bulk-upload/";

const BASE_URL_WM = "https://api.watermarkremover.io";
const URL_REMOVE_WM = "/service/public/transformation/v1.0/predictions/wm/remove";
const URL_SECRET = "https://api.pixelbin.io/service/public/transformation/v1.0/predictions/wm/remove";
const SIGN_KEY = "A4nzUYcDOZ";

const shaderTypes = ["FRAGMENT_SHADER", "VERTEX_SHADER"];
const precisionLevels = ["LOW_FLOAT", "MEDIUM_FLOAT", "HIGH_FLOAT", "LOW_INT", "MEDIUM_INT", "HIGH_INT"];
const extensions = [
  "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_clip_control",
  "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_disjoint_timer_query",
  "OES_texture_float", "OES_texture_half_float", "WEBGL_draw_buffers"
];
const extensionParams = [
  "COLOR_ATTACHMENT0_WEBGL=36064", "COMPRESSED_RGBA_S3TC_DXT1_EXT=33777",
  "DEPTH_CLAMP_EXT=34383", "FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING_EXT=33296",
  "TEXTURE_MAX_ANISOTROPY_EXT=34046=16"
];

const BULK_PAYLOAD = (settings) => {
  return {
    input_task_list: [
      {
        image_content_type: "image/jpeg",
        output_content_type: "image/jpeg",
        ai_pipeline: settings
      }
    ]
  }
}

let k = [2277735313, 289559509];
let I = [1291169091, 658871167];
let P = [0, 5];
let C = [0, 1390208809];
let A = [0, 944331445];
let E = [4283543511, 3981806797];
let S = [3301882366, 444984403];

let headersListWm = {
  "authority": "api.watermarkremover.io",
  "accept": "application/json, text/plain, */*",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ru;q=0.6",
  "origin": "https://www.watermarkremover.io",
  "pixb-cl-id": "d6b7221dce0eb93bfa9641d48b72bef6",
  "priority": "u=1, i",
  "referer": "https://www.watermarkremover.io/",
  "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
}

let headersList = {
  "authority": "app.remini.ai",
  "accept": "*/*",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7,ru;q=0.6",
  "content-type": "application/json",
  "origin": "https://app.remini.ai",
  "priority": "u=1, i",
  "referer": "https://app.remini.ai/?v=9247d6bf-c36b-49ad-a3f0-a40e1297c3d2-1739612547618",
  "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
}

function _delay(msec) {
  return new Promise(resolve => setTimeout(resolve, msec));
}

async function req(url, method = "GET", data = null, params = null, head = null) {
  try {
    let pUrl;
    if (params) {
      const cUrl = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        cUrl.append(k, v);
      })
      pUrl = url + "?" + cUrl.toString();
    } else {
      pUrl = url;
    }

    return await fetch(pUrl, {
      method,
      headers: head ? head : headersList,
      ...(data ? {
        body: data
      } : {})
    })
  } catch (error) {
    throw new Error(error.stack);
  }
}

function randomChar(length = 5) {
  const chr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
  return Array.from({ length }).map(() => chr.charAt(Math.floor(Math.random() * chr.length))).join("");
}

function generateRandomMathValues() {
  const x = Math.random() * 2 - 1;
  const y = Math.random() * 10;

  return {
    acos: Math.acos(Math.abs(x)),
    acosh: Math.acosh(y + 1),
    acoshPf: Math.acosh(y + 1),
    asin: Math.asin(x),
    asinh: Math.asinh(x),
    asinhPf: Math.asinh(x),
    atanh: Math.atanh(x * 0.9),
    atanhPf: Math.atanh(x * 0.9),
    atan: Math.atan(x),
    sin: Math.sin(y),
    sinh: Math.sinh(y),
    sinhPf: Math.sinh(y * 0.5),
    cos: Math.cos(y),
    cosh: Math.cosh(y),
    coshPf: Math.cosh(y),
    tan: Math.tan(y),
    tanh: Math.tanh(y),
    tanhPf: Math.tanh(y),
    exp: Math.exp(x),
    expm1: Math.expm1(x),
    expm1Pf: Math.expm1(x),
    log1p: Math.log1p(y),
    log1pPf: Math.log1p(y),
    powPI: Math.pow(Math.PI, -y)
  };
}

function getRandomParameter() {
  const keys = [
    "ACTIVE_ATTRIBUTES", "ACTIVE_TEXTURE", "ACTIVE_UNIFORMS", "ALIASED_LINE_WIDTH_RANGE",
    "ALIASED_POINT_SIZE_RANGE", "ALPHA", "ALPHA_BITS", "ALWAYS", "ARRAY_BUFFER",
    "ARRAY_BUFFER_BINDING", "ATTACHED_SHADERS", "BACK", "BLEND", "BLEND_COLOR",
    "BLEND_DST_ALPHA", "BLEND_DST_RGB", "BLEND_EQUATION", "BLEND_EQUATION_ALPHA",
    "BLEND_EQUATION_RGB", "BLEND_SRC_ALPHA", "BLEND_SRC_RGB", "BLUE_BITS",
    "BOOL", "BOOL_VEC2", "BOOL_VEC3", "BOOL_VEC4", "BROWSER_DEFAULT_WEBGL"
  ];

  const key = keys[Math.floor(Math.random() * keys.length)];
  const value = Math.random() > 0.5 ? Math.floor(Math.random() * 50000) : `${Math.floor(Math.random() * 1000)},${Math.floor(Math.random() * 1000)}`;
  return `"${key}=${value}"`;
}

function generateRandomParameters(count = 10) {
  const parameters = [];
  for (let i = 0; i < count; i++) {
    parameters.push(getRandomParameter());
  }
  return `{\n  "parameters": [\n    ${parameters.join(",\n    ")}\n  ]\n}`;
}

const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateShaderPrecisions = () => {
  return shaderTypes.flatMap(type =>
    precisionLevels.map(level => `${type}.${level}=${getRandomNumber(10, 200)},${getRandomNumber(10, 200)},${getRandomNumber(0, 50)}`)
  );
};

const generateExtensions = () => {
  return extensions.sort(() => Math.random() - 0.5).slice(0, getRandomNumber(5, extensions.length));
};

const generateExtensionParameters = () => {
  return extensionParams.sort(() => Math.random() - 0.5).slice(0, getRandomNumber(3, extensionParams.length));
};

const generateDummyData = () => {
  return {
    shaderPrecisions: generateShaderPrecisions(),
    extensions: generateExtensions(),
    extensionParameters: generateExtensionParameters()
  };
};

const COMPONENTS = {
  "applePay": [-1, 1, 0][Math.floor(Math.random() * 2)],
  "architecture": Math.floor(Math.random() * 255),
  "audio": Math.random() * 999.9999,
  "audioBaseLatency": [-1, -2, 1][Math.floor(Math.random() * 2)],
  "canvas": {
    "winding": [false, true][Math.floor(Math.random() * 1)],
    "geometry": "data:image/png;base64,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",
    "text": "data:image/png;base64,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"
  },
  "colorDepth": Math.floor(Math.random() * 24),
  "colorGamut": ["srgb", "rgb", "rgba"][Math.floor(Math.random() * 2)],
  "contrast": Math.floor(Math.random() * 255),
  "cookiesEnabled": true,
  "deviceMemory": Math.floor(Math.random() * 24),
  "fontPreferences": {
    "default": Math.random() * 247.9999,
    "apple": Math.random() * 239.1013,
    "serif": Math.random() * 973.1287,
    "sans": Math.random() * 778.1238,
    "mono": Math.random() * 87.918351,
    "min": Math.random() * 9.23409,
    "system": Math.random() * 999.999999
  },
  "fonts": [
    "Agency FB",
    "Calibri",
    "Century",
    "Century Gothic",
    "Franklin Gothic",
    "Futura Bk BT",
    "Futura Md BT",
    "Haettenschweiler",
    "Humanst521 BT",
    "Leelawadee",
    "Lucida Bright",
    "Lucida Sans",
    "MS Outlook",
    "MS Reference Specialty",
    "MS UI Gothic",
    "MT Extra",
    "Marlett",
    "Microsoft Uighur",
    "Monotype Corsiva",
    "Pristina",
    "Segoe UI Light"
  ].slice(Math.random() * 5, Math.random() * 20),
  "forcedColors": false,
  "hardwareConcurrency": Math.floor(Math.random() * 12),
  "hdr": [false, true, false][Math.floor(Math.random() * 2)],
  "indexedDB": true,
  "languages": [
    [
      "id-ID",
      "en-EN",
      "us-US",
      "eu-EU"
    ][Math.floor(Math.random() * 3)]
  ],
  "localStorage": true,
  "math": generateRandomMathValues(),
  "monochrome": 0,
  "openDatabase": false,
  "pdfViewerEnabled": true,
  "platform": ["Win32", "Win64", "Linux", "MacOS"][Math.floor(Math.random() * 4)],
  "plugins": [
    {
      "name": "PDF Viewer",
      "description": "Portable Document Format",
      "mimeTypes": [
        {
          "type": "application/pdf",
          "suffixes": "pdf"
        },
        {
          "type": "text/pdf",
          "suffixes": "pdf"
        }
      ]
    },
    {
      "name": "Chrome PDF Viewer",
      "description": "Portable Document Format",
      "mimeTypes": [
        {
          "type": "application/pdf",
          "suffixes": "pdf"
        },
        {
          "type": "text/pdf",
          "suffixes": "pdf"
        }
      ]
    },
    {
      "name": "Chromium PDF Viewer",
      "description": "Portable Document Format",
      "mimeTypes": [
        {
          "type": "application/pdf",
          "suffixes": "pdf"
        },
        {
          "type": "text/pdf",
          "suffixes": "pdf"
        }
      ]
    },
    {
      "name": "Microsoft Edge PDF Viewer",
      "description": "Portable Document Format",
      "mimeTypes": [
        {
          "type": "application/pdf",
          "suffixes": "pdf"
        },
        {
          "type": "text/pdf",
          "suffixes": "pdf"
        }
      ]
    },
    {
      "name": "WebKit built-in PDF",
      "description": "Portable Document Format",
      "mimeTypes": [
        {
          "type": "application/pdf",
          "suffixes": "pdf"
        },
        {
          "type": "text/pdf",
          "suffixes": "pdf"
        }
      ]
    }
  ][Math.floor(Math.random() * 5)],
  "reducedMotion": false,
  "reducedTransparency": false,
  "screenFrame": [
    0,
    0,
    50,
    0
  ],
  "screenResolution": [
    Math.random() * 4090,
    Math.random() * 3090
  ],
  "sessionStorage": true,
  "timezone": "Asia/Jakarta",
  "touchSupport": {
    "maxTouchPoints": 0,
    "touchEvent": false,
    "touchStart": false
  },
  "vendor": `${randomChar(10)}`,
  "vendorFlavors": [
    "chrome"
  ],
  "webGlBasics": {
    "version": "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
    "vendor": "WebKit",
    "vendorUnmasked": `${randomChar(10)} (NVIDIA)`,
    "renderer": "WebKit WebGL",
    "rendererUnmasked": `ANGLE (NVIDIA, NVIDIA GeForce RTX ${["3090", "4090", "5090", "360", "450", "720"][Math.floor(Math.random() * 6)]} (0x00001380) Direct3D11 vs_5_0 ps_5_0, D3D11)`,
    "shadingLanguageVersion": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)"
  },
  "webGlExtensions": {
    "contextAttributes": [
      `alpha=${Math.random() < 0.5}`,
      `antialias=${Math.random() < 0.5}`,
      `depth=${Math.random() < 0.5}`,
      `desynchronized=${Math.random() < 0.5}`,
      `failIfMajorPerformanceCaveat=${Math.random() < 0.5}`,
      `powerPreference=default`,
      `premultipliedAlpha=${Math.random() < 0.5}`,
      `preserveDrawingBuffer=${Math.random() < 0.5}`,
      `stencil=${Math.random() < 0.5}`,
      `xrCompatible=${Math.random() < 0.5}`
    ],
    "parameters": generateRandomParameters(15),
    ...generateDummyData(),
    "unsupportedExtensions": []
  }
}

function _(e, t) {
  if ((t %= 64) !== 0) {
    if (t < 32) {
      e[0] = e[1] >>> 32 - t;
      e[1] = e[1] << t;
    } else {
      e[0] = e[1] << t - 32;
      e[1] = 0;
    }
  }
}

function b(e, t) {
  let n = e[0] >>> 16;
  let r = e[0] & 65535;
  let o = e[1] >>> 16;
  let i = e[1] & 65535;
  let a = t[0] >>> 16;
  let s = t[0] & 65535;
  let l = t[1] >>> 16;
  let u = t[1] & 65535;
  let c = 0;
  let d = 0;
  let f = 0;
  let p = 0;
  f += (p += i * u) >>> 16;
  p &= 65535;
  d += (f += o * u) >>> 16;
  f &= 65535;
  d += (f += i * l) >>> 16;
  f &= 65535;
  c += (d += r * u) >>> 16;
  d &= 65535;
  c += (d += o * l) >>> 16;
  d &= 65535;
  c += (d += i * s) >>> 16;
  d &= 65535;
  c += n * u + r * l + o * s + i * a;
  c &= 65535;
  e[0] = c << 16 | d;
  e[1] = f << 16 | p;
}

function w(e, t) {
  let n = e[0];
  if ((t %= 64) === 32) {
    e[0] = e[1];
    e[1] = n;
  } else if (t < 32) {
    e[0] = n << t | e[1] >>> 32 - t;
    e[1] = e[1] << t | n >>> 32 - t;
  } else {
    t -= 32;
    e[0] = e[1] << t | n >>> 32 - t;
    e[1] = n << t | e[1] >>> 32 - t;
  }
}

function x(e, t) {
  e[0] ^= t[0];
  e[1] ^= t[1];
}

function y(e, t) {
  let n = e[0] >>> 16;
  let r = e[0] & 65535;
  let o = e[1] >>> 16;
  let i = e[1] & 65535;
  let a = t[0] >>> 16;
  let s = t[0] & 65535;
  let l = t[1] >>> 16;
  let u = 0;
  let c = 0;
  let d = 0;
  let f = 0;
  d += (f += i + (t[1] & 65535)) >>> 16;
  f &= 65535;
  c += (d += o + l) >>> 16;
  d &= 65535;
  u += (c += r + s) >>> 16;
  c &= 65535;
  u += n + a;
  u &= 65535;
  e[0] = u << 16 | c;
  e[1] = d << 16 | f;
}

function O(e) {
  let t = [0, e[0] >>> 1];
  x(e, t);
  b(e, E);
  t[1] = e[0] >>> 1;
  x(e, t);
  b(e, S);
  t[1] = e[0] >>> 1;
  x(e, t);
}

function _encrypt(e) {
  let n = function (e) {
    let t = new Uint8Array(e.length);
    for (let n = 0; n < e.length; n++) {
      let r = e.charCodeAt(n);
      if (r > 127) {
        return new TextEncoder().encode(e);
      }
      t[n] = r;
    }
    return t;
  }(e);
  let t = 0;
  let r;
  let o = [0, n.length];
  let i = o[1] % 16;
  let a = o[1] - i;
  let s = [0, t];
  let l = [0, t];
  let u = [0, 0];
  let c = [0, 0];
  for (r = 0; r < a; r += 16) {
    u[0] = n[r + 4] | n[r + 5] << 8 | n[r + 6] << 16 | n[r + 7] << 24;
    u[1] = n[r] | n[r + 1] << 8 | n[r + 2] << 16 | n[r + 3] << 24;
    c[0] = n[r + 12] | n[r + 13] << 8 | n[r + 14] << 16 | n[r + 15] << 24;
    c[1] = n[r + 8] | n[r + 9] << 8 | n[r + 10] << 16 | n[r + 11] << 24;
    b(u, k);
    w(u, 31);
    b(u, I);
    x(s, u);
    w(s, 27);
    y(s, l);
    b(s, P);
    y(s, C);
    b(c, I);
    w(c, 33);
    b(c, k);
    x(l, c);
    w(l, 31);
    y(l, s);
    b(l, P);
    y(l, A);
  }
  u[0] = 0;
  u[1] = 0;
  c[0] = 0;
  c[1] = 0;
  let d = [0, 0];
  switch (i) {
    case 15:
      d[1] = n[r + 14];
      _(d, 48);
      x(c, d);
    /* falls through */
    case 14:
      d[1] = n[r + 13];
      _(d, 40);
      x(c, d);
    /* falls through */
    case 13:
      d[1] = n[r + 12];
      _(d, 32);
      x(c, d);
    /* falls through */
    case 12:
      d[1] = n[r + 11];
      _(d, 24);
      x(c, d);
    /* falls through */
    case 11:
      d[1] = n[r + 10];
      _(d, 16);
      x(c, d);
    /* falls through */
    case 10:
      d[1] = n[r + 9];
      _(d, 8);
      x(c, d);
    /* falls through */
    case 9:
      d[1] = n[r + 8];
      x(c, d);
      b(c, I);
      w(c, 33);
      b(c, k);
      x(l, c);
    /* falls through */
    case 8:
      d[1] = n[r + 7];
      _(d, 56);
      x(u, d);
    /* falls through */
    case 7:
      d[1] = n[r + 6];
      _(d, 48);
      x(u, d);
    /* falls through */
    case 6:
      d[1] = n[r + 5];
      _(d, 40);
      x(u, d);
    /* falls through */
    case 5:
      d[1] = n[r + 4];
      _(d, 32);
      x(u, d);
    /* falls through */
    case 4:
      d[1] = n[r + 3];
      _(d, 24);
      x(u, d);
    /* falls through */
    case 3:
      d[1] = n[r + 2];
      _(d, 16);
      x(u, d);
    /* falls through */
    case 2:
      d[1] = n[r + 1];
      _(d, 8);
      x(u, d);
    /* falls through */
    case 1:
      d[1] = n[r];
      x(u, d);
      b(u, k);
      w(u, 31);
      b(u, I);
      x(s, u);
    /* falls through */
  }
  x(s, o);
  x(l, o);
  y(s, l);
  y(l, s);
  O(s);
  O(l);
  y(s, l);
  y(l, s);
  return ("00000000" + (s[0] >>> 0).toString(16)).slice(-8) + ("00000000" + (s[1] >>> 0).toString(16)).slice(-8) + ("00000000" + (l[0] >>> 0).toString(16)).slice(-8) + ("00000000" + (l[1] >>> 0).toString(16)).slice(-8);
}

function _objToStr(e) {
  let t = "";
  for (let n = 0, r = Object.keys(e).sort(); n < r.length; n++) {
    const o = r[n];
    const i = e[o];
    const a = typeof i == "string" ? i : JSON.stringify(i);
    t += `${t ? "|" : ""}${o.replace(/([:|\\])/g, "\\$1")}:${a}`;
  }
  return t;
}

function _visitorId() {
  const txt = _objToStr(COMPONENTS);
  const enc = _encrypt(txt.trim());
  return enc;
}

async function _initSignature() {
  const iso = new Date().toISOString();
  const params = Buffer.from(iso).toString("base64");
  const uri = new URL(URL_SECRET);
  const vis = _visitorId()
  const hm = `POST${encodeURI(uri.pathname + uri.search)}${iso}${vis}`;
  const sig = crypto.createHmac("sha256", SIGN_KEY).update(hm).digest("hex");
  headersListWm["x-ebg-param"] = params;
  headersListWm["x-ebg-signature"] = sig;
  headersListWm["pixb-cl-id"] = vis;
}

async function _init() {
  const rs = await req(BASE_URL + URL_USER, "POST");
  const jsn = await rs.json();
  headersList["Authorization"] = `Bearer ${jsn.access_token}`;
  return true;
}

async function _upload(settings) {
  const hh = await req(BASE_URL + URL_BULK, "POST", JSON.stringify(BULK_PAYLOAD(settings)));
  const jsn = await hh.json();
  return jsn;
}

async function _approval(data, settings) {
  const hh = await req(BASE_URL + URL_APPROVAL.replace("BULK_UPLOAD_ID", data.bulk_upload_id), "POST", JSON.stringify(BULK_PAYLOAD(settings)));
  return hh.status;
}

async function _approvalWm() {
  const hh = await req(BASE_URL_WM + URL_REMOVE_WM, "OPTIONS", null, null, headersListWm);
  return hh.status;
}

async function _send(data, buffer) {
  headersList["content-type"] = "image/jpeg";
  headersList["x-goog-custom-time"] = data.task_list[0].upload_headers["x-goog-custom-time"];
  const jj = await req(data.task_list[0].upload_url, "PUT", buffer)
  return jj.status;
}

async function _task(data) {
  headersList["content-type"] = "application/json";
  const jj = await req(BASE_URL + URL_TASK + data.bulk_upload_id);
  return await jj.json();
}

async function Remini(img, settings) {
  try {
    let buffer;
    let wm;
    let no_wm;
      if (Buffer.isBuffer(img)) {
        buffer = img;
      } else {
        const gs = await fetch(img);
        const kb = await gs.arrayBuffer();
        buffer = Buffer.from(kb);
      }
      await _init();
      const data = await _upload(settings);
      await _send(data, buffer);
      await _approval(data, settings);

      while (true) {
        const jdata = await _task(data);
        if (jdata.task_list[0].status == "completed") {
          wm = jdata;
          break;
        }
        await _delay(2000); // 2 Detik
      }

      if (wm.task_list[0].result.outputs[0].has_watermark) {
        const rm = await Remove(wm.task_list[0].result.outputs[0].url);
        if (rm == null) {
          no_wm = wm.task_list[0].result.outputs[0].url
        } else {
          no_wm = rm.output[0];
        }
      } else {
        no_wm = wm.task_list[0].result.outputs[0].url;
      }
      return {
        no_wm,
        wm: wm.task_list[0].result.outputs[0].url
      }
  } catch (error) {
    throw new Error(error);
  }
}

async function Remove(image) {
  try {
    let buffer;
    let results = null;

    if (/https?:\/\//i.test(image)) {
      const gs = await fetch(image);
      const kb = await gs.arrayBuffer();
      buffer = Buffer.from(kb);
    } else {
      buffer = image;
    }

    await _approvalWm();
    
    await _initSignature();
    
    const form = new FormData();

    const imageBlob = new Blob([buffer], { type: "image/jpeg" });
    const filename = `${crypto.randomUUID().toString()}.jpg`;
    form.append("input.image", imageBlob, filename);
    form.append("input.rem_text", "false");
    form.append("input.rem_logo", "false");
    form.append("retention", "1d");

    const ts = await req(BASE_URL_WM + URL_REMOVE_WM, "POST", form, null, headersListWm);

    const jsn = await ts.json();
    if (jsn.status && jsn.status == "ACCEPTED") {
      const uri = new URL(jsn.urls.get);
      const headOri = {
        origin: "https://" + uri.hostname,
        referer: jsn.urls.get,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      }
      while (true) {
        const rm = await req(jsn.urls.get, "GET", null, null, headOri);
        const jj = await rm.json();
        if (jj.status && jj.status == "SUCCESS") {
          results = jj;
          break;
        }
        await _delay(5000);
      }
    }

    return results;
  } catch (error) {
    throw new Error(error.stack);
  }
}

export { Remini, Remove };
