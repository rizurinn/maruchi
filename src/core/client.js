import path from 'path';
import pino from 'pino';
import fs from 'fs';
import { access, writeFile, unlink, readFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { jidNormalizedUser, generateWAMessage, generateWAMessageFromContent, generateWAMessageContent, jidDecode, jidEncode, getBinaryNodeChildString, getBinaryNodeChildren, getBinaryNodeChild, proto } from 'baileys';
import { sticker } from '#addon/sticker.js';
import Func from '../../lib/funcc.js';
import crypto from 'crypto';

const log = pino({
    level: "debug",
    base: { module: "SOCKET" },
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:HH:MM",
            ignore: "pid,hostname",
        },
    },
});
const randomByte = (length) => crypto.randomBytes(length);
const createQuotedOptions = (quoted, options = {}) => {
  return {
    quoted,
    ...options
  };
};
const extractMentions = (text) => {
  if (!text || typeof text !== 'string') return [];
  return [...text.matchAll(/@(\d{0,16})(@lid|@s\.whatsapp\.net)?/g)].map(v => v[1] + (v[2] || '@lid'));
};
const detectMimeType = async (data, headers = {}) => {
  let mime = headers['content-type'];
  if (!mime || mime.includes('octet-stream')) {
    const fileType = await Func.fileTypeFromBuffer(data);
    mime = fileType?.mime || 'application/octet-stream';
  }
  return mime;
};

export async function clientBot(conn) {
  conn.decodeJid = (jid = '') => {
    try {
      if (typeof jid !== 'string' || jid.length === 0) return jid;
      if (jid.includes(':')) {
        const decode = jidDecode(jid);
        if (decode?.user && decode?.server) {
          return `${decode.user}@${decode.server}`;
        }
      }
      return jid;
    } catch (error) {
      throw error
      return jid;
    }
  };

  conn.getFile = async (PATH, saveToFile = false) => {
    let res, filename;
    let data = Buffer.alloc(0);

    if (Buffer.isBuffer(PATH)) {
      data = PATH;
    } else if (PATH instanceof ArrayBuffer) {
      data = Buffer.from(PATH);
    } else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
      data = Buffer.from(PATH.split`,`[1], "base64");
    } else if (/^https?:\/\//.test(PATH)) {
      res = await fetch(PATH);
      if (!res.ok) throw new Error(`Download failed with status: ${res.status}`);
      data = Buffer.from(await res.arrayBuffer());
    } else if (typeof PATH === "string") {
      try {
        data = await readFile(PATH);
        filename = PATH;
      } catch (e) {
        throw new Error(`Invalid input path: "${PATH}". Not a valid URL, Buffer, or readable file path.`);
      }
    } else {
       throw new TypeError(`Invalid input type for getFile: ${typeof PATH}`);
    }

    if (!Buffer.isBuffer(data) || data.length === 0) throw new TypeError("Result is not a buffer or is empty");
    
    const type = (await Func.fileTypeFromBuffer(data)) || {
      mime: "application/octet-stream",
      ext: "bin",
    };
    
    if (saveToFile && !filename) { 
      filename = path.join(process.cwd(), "./tmp", Date.now() + "." + type.ext);
      await writeFile(filename, data);
    }
    
    return {
      res,
      filename,
      ...type,
      data,
      deleteFile() {
        return (saveToFile && !PATH.startsWith('.')) && filename && unlink(filename);
      },
    };
  };

  conn.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
    let buffer;
    let fileType;
    let originalFilename = filename;

    try {
      const fetchedFile = await conn.getFile(path, false); 
      buffer = fetchedFile.data;
      fileType = { mime: fetchedFile.mime, ext: fetchedFile.ext };
      
      if (!originalFilename && fetchedFile.filename) {
        originalFilename = path.basename(fetchedFile.filename);
      }
    } catch (e) {
      throw new Error(`Failed to get file from path: ${path}`);
    }

    if (!buffer || buffer.length === 0) throw new Error("Buffer is empty or could not be processed.");
    
    const mime = fileType?.mime || 'application/octet-stream';
    let mtype = '';

    if (/image/.test(mime) || (/webp/.test(mime) && options.asImage)) {
      mtype = 'image';
    } else if (/video/.test(mime)) {
      mtype = 'video';
    } else if (/audio/.test(mime)) {
      mtype = 'audio';
    } else {
      mtype = 'document';
    }

    if (options.asDocument) mtype = 'document';

    const message = {
      ...options,
      caption,
      ptt,
      [mtype]: buffer,
      mimetype: mtype === 'audio' ? 'audio/ogg; codecs=opus' : mime,
      fileName: originalFilename || `file.${fileType.ext}`
    };

    return conn.sendMessage(jid, message, { quoted, ...options });
  };

  async function _internalSendMessage(chat, content, options = {}) {
    const { quoted, ...restOptions } = options;
    let mentions = [];
    if (typeof content === 'string' || content?.text || content?.caption) {
      const textToParse = content.text || content.caption || content;
      mentions = extractMentions(textToParse);
    }
    const opts = typeof content === 'object' ? { mentions, ...restOptions, ...content } : { mentions, ...restOptions };
    
    if (typeof content === 'object') {
      return await conn.sendMessage(chat, content, createQuotedOptions(quoted, opts));
    }
    
    if (typeof content === 'string') {
      try {
        if (/^https?:\/\//.test(content)) {
          const response = await fetch(content);
          if (!response.ok) throw new Error(`Download failed with status: ${response.status}`);
          const buffer = await response.arrayBuffer();
          const headers = {};
          response.headers.forEach((value, key) => headers[key] = value);
          const mime = await detectMimeType(buffer, headers);
          const finalCaption = opts.caption || '';
          
          if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
            return await conn.sendFile(chat, buffer, 'file', finalCaption, quoted, opts);
          }
        }
        return await conn.sendMessage(chat, { text: content, ...opts }, createQuotedOptions(quoted, opts));
      } catch (error) {
        return await conn.sendMessage(chat, { text: content, ...opts }, createQuotedOptions(quoted, opts));
      }
    }
  }

  conn.reply = async (chat, content, options = {}) => {
    const quoted = options.quoted || options.m;
    return _internalSendMessage(chat, content, { ...options, quoted });
  };

  conn.sendAsSticker = async (jid, input, quoted, options = {}) => {
      let buffer;
      if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
        const file = await conn.getFile(input, true);
        buffer = Buffer.isBuffer(file) ? file : file?.data;
      } else if (Buffer.isBuffer(input)) {
        buffer = input;
      } else {
        throw new Error('Input harus berupa URL atau buffer!');
      }

      if (!buffer) throw new Error("Buffer kosong, file gagal diproses.");

      let opts = {
        crop: options.crop !== undefined ? options.crop : false,
        quality: options.quality || 90,
        fps: options.fps || 15,
        maxDuration: options.maxDuration || 15,
        packName: options.pack || global.config.packnames || "",
        authorName: options.author || global.config.authors || "",
        emojis: options.emojis || []
      };

      let result = await sticker(buffer, opts);

      return await conn.sendMessage(jid, { 
        sticker: result 
      }, { quoted });
  };

  conn.extractGroupMetadata = (result) => {
    const group = getBinaryNodeChild(result, 'group');
    const descChild = getBinaryNodeChild(group, 'description');
    const desc = descChild ? getBinaryNodeChildString(descChild, 'body') : undefined;
    const descId = descChild?.attrs?.id;
    const groupId = group.attrs.id.includes('@') ? group.attrs.id : jidEncode(group.attrs.id, 'g.us');
    const eph = getBinaryNodeChild(group, 'ephemeral')?.attrs?.expiration;
    const participants = getBinaryNodeChildren(group, 'participant') || [];
    
    return {
      id: groupId,
      addressingMode: group.attrs.addressing_mode,
      subject: group.attrs.subject,
      subjectOwner: group.attrs.s_o?.endsWith('@lid') ? group.attrs.s_o_pn : group.attrs.s_o,
      subjectOwnerPhoneNumber: group.attrs.s_o_pn,
      subjectTime: +group.attrs.s_t,
      creation: +group.attrs.creation,
      size: participants.length,
      owner: group.attrs.creator?.endsWith('@lid') ? group.attrs.creator_pn : group.attrs.creator,
      ownerPhoneNumber: group.attrs.creator_pn ? jidNormalizedUser(group.attrs.creator_pn) : undefined,
      desc,
      descId,
      linkedParent: getBinaryNodeChild(group, 'linked_parent')?.attrs?.jid,
      restrict: !!getBinaryNodeChild(group, 'locked'),
      announce: !!getBinaryNodeChild(group, 'announcement'),
      isCommunity: !!getBinaryNodeChild(group, 'parent'),
      isCommunityAnnounce: !!getBinaryNodeChild(group, 'default_sub_group'),
      joinApprovalMode: !!getBinaryNodeChild(group, 'membership_approval_mode'),
      memberAddMode: getBinaryNodeChildString(group, 'member_add_mode') === 'all_member_add',
      ephemeralDuration: eph ? +eph : undefined,
      participants: participants.map(({ attrs }) => ({
        id: attrs.jid.endsWith('@lid') ? attrs.phone_number : attrs.jid,
        jid: attrs.jid.endsWith('@lid') ? attrs.phone_number : attrs.jid,
        lid: attrs.jid.endsWith('@lid') ? attrs.jid : attrs.lid,
        admin: attrs.type || null
      }))
    };
  };

  conn.groupMetadata = async (jid) => {
    const result = await conn.query({
      tag: 'iq',
      attrs: { type: 'get', xmlns: 'w:g2', to: jid },
      content: [{ tag: 'query', attrs: { request: 'interactive' } }]
    });
    return conn.extractGroupMetadata(result);
  };

  conn.groupFetchAllParticipating = async () => {
    const result = await conn.query({
      tag: 'iq',
      attrs: { to: '@g.us', xmlns: 'w:g2', type: 'get' },
      content: [{
        tag: 'participating',
        attrs: {},
        content: [
          { tag: 'participants', attrs: {} },
          { tag: 'description', attrs: {} }
        ]
      }]
    });
    
    const data = {};
    const groupsChild = getBinaryNodeChild(result, 'groups');
    if (groupsChild) {
      const groups = getBinaryNodeChildren(groupsChild, 'group');
      for (const groupNode of groups) {
        const meta = conn.extractGroupMetadata({
          tag: 'result',
          attrs: {},
          content: [groupNode]
        });
        if (meta.isCommunity || meta.announce) continue;
        data[meta.id] = meta;
      }
    }
    conn.ev.emit('groups.update', Object.values(data));
    return data;
  };

conn.sendButton = async (jid, content = {}, options = {}) => {
  try {
    if (!conn.user?.id) {
      throw new Error("User not authenticated");
    }

    const {
      text = "",
      caption = "",
      title = "",
      footer = "",
      buttons = [],
      interactiveButtons = [],
      // List Message support
      sections = null,
      listType = "SINGLE_SELECT",
      buttonText = "Menu",
      description = "",
      // Interactive Message fields
      hasMediaAttachment = false,
      image = null,
      video = null,
      document = null,
      mimetype = null,
      fileName = null,
      fileLength = null,
      pageCount = null,
      jpegThumbnail = null,
      location = null,
      product = null,
      businessOwnerJid = null,
      contextInfo = null,
      externalAdReply = null,
      // messageParamsJson for tap target / thumbnail URL preview
      tapTarget = null,
    } = content;

    // ─────────────────────────────────────────────────────────────
    // MODE 1: LIST MESSAGE — ketika sections diberikan
    // ─────────────────────────────────────────────────────────────
    if (Array.isArray(sections) && sections.length > 0) {
      const listContent = {
        listMessage: {
          title: title || undefined,
          description: description || text || caption || "",
          buttonText: buttonText || "Menu",
          listType: listType,
          sections: sections.map((section) => ({
            title: section.title || undefined,
            rows: Array.isArray(section.rows)
              ? section.rows.map((row) => ({
                  title: row.title || "",
                  description: row.description || undefined,
                  rowId: row.rowId || row.id || row.title,
                }))
              : [],
          })),
        },
      };

      // Quoted support untuk list message
      const listRelayOpts = {};
      if (options.quoted) {
        listContent.listMessage.contextInfo = {
          stanzaId: options.quoted.key.id,
          remoteJid: options.quoted.key.remoteJid,
          participant: options.quoted.key.participant || options.quoted.key.remoteJid,
          fromMe: options.quoted.key.fromMe,
          quotedMessage: options.quoted.message,
        };
      }

      const listMsg = generateWAMessageFromContent(jid, listContent, {
        userJid: conn.user.id,
        quoted: options?.quoted || null,
      });

      await conn.relayMessage(jid, listMsg.message, {
        messageId: listMsg.key.id,
        ...listRelayOpts,
      });

      return listMsg;
    }

    // ─────────────────────────────────────────────────────────────
    // MODE 2: INTERACTIVE (NATIVE FLOW) MESSAGE — dengan buttons
    // ─────────────────────────────────────────────────────────────
    const allButtons = [...buttons, ...interactiveButtons];

    if (!Array.isArray(allButtons) || allButtons.length === 0) {
      throw new Error("buttons, interactiveButtons, atau sections harus diisi");
    }

    // Proses buttons
    const processedButtons = [];
    for (let i = 0; i < allButtons.length; i++) {
      const btn = allButtons[i];

      if (!btn || typeof btn !== "object") {
        throw new Error(`button[${i}] must be an object`);
      }

      // Format 1: name + buttonParamsJson
      if (btn.name && btn.buttonParamsJson) {
        processedButtons.push({
          name: btn.name,
          buttonParamsJson: typeof btn.buttonParamsJson === 'string'
            ? btn.buttonParamsJson
            : JSON.stringify(btn.buttonParamsJson)
        });
        continue;
      }

      // Format 2: nativeFlowInfo
      if (btn.nativeFlowInfo && btn.nativeFlowInfo.name) {
        processedButtons.push({
          name: btn.nativeFlowInfo.name,
          buttonParamsJson: btn.nativeFlowInfo.paramsJson || JSON.stringify({}),
        });
        continue;
      }

      // Format 3: simple format (id, text, displayText)
      if (btn.id || btn.text || btn.displayText) {
        processedButtons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: btn.text || btn.displayText || `Button ${i + 1}`,
            id: btn.id || `quick_${i + 1}`,
          }),
        });
        continue;
      }

      // Format 4: cta_url shorthand { url, displayText }
      if (btn.url && (btn.displayText || btn.text)) {
        processedButtons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText || btn.text,
            url: btn.url,
            webview_presentation: btn.webviewPresentation || null,
            payment_link_preview: false,
            landing_page_url: btn.landingPageUrl || btn.url,
            webview_interaction: btn.webviewInteraction !== false,
          }),
        });
        continue;
      }

      // Format 5: buttonId + buttonText
      if (btn.buttonId && btn.buttonText?.displayText) {
        if (btn.type === 4 || btn.nativeFlowInfo) {
          const flowInfo = btn.nativeFlowInfo || {};
          processedButtons.push({
            name: flowInfo.name || "quick_reply",
            buttonParamsJson:
              flowInfo.paramsJson ||
              JSON.stringify({
                display_text: btn.buttonText.displayText,
                id: btn.buttonId,
              }),
          });
        } else {
          processedButtons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: btn.buttonText.displayText,
              id: btn.buttonId,
            }),
          });
        }
        continue;
      }

      throw new Error(`button[${i}] has invalid shape`);
    }

    let messageContent = {};

    // Handle Image
    if (image) {
      const mediaInput = {};
      if (Buffer.isBuffer(image)) {
        mediaInput.image = image;
      } else if (typeof image === "object" && image.url) {
        mediaInput.image = { url: image.url };
      } else if (typeof image === "string") {
        mediaInput.image = { url: image };
      }

      const preparedMedia = await generateWAMessageContent(mediaInput, {
        upload: conn.waUploadToServer,
      });

      messageContent.header = {
        title: title || "",
        hasMediaAttachment: hasMediaAttachment || true,
        imageMessage: preparedMedia.imageMessage,
      };
    }
    // Handle Video
    else if (video) {
      const mediaInput = {};
      if (Buffer.isBuffer(video)) {
        mediaInput.video = video;
      } else if (typeof video === "object" && video.url) {
        mediaInput.video = { url: video.url };
      } else if (typeof video === "string") {
        mediaInput.video = { url: video };
      }

      const preparedMedia = await generateWAMessageContent(mediaInput, {
        upload: conn.waUploadToServer,
      });

      messageContent.header = {
        title: title || "",
        hasMediaAttachment: hasMediaAttachment || true,
        videoMessage: preparedMedia.videoMessage,
      };
    }
    // Handle Document
    else if (document) {
      const mediaInput = { document: {} };

      if (Buffer.isBuffer(document)) {
        mediaInput.document = document;
      } else if (typeof document === "object" && document.url) {
        mediaInput.document = { url: document.url };
      } else if (typeof document === "string") {
        mediaInput.document = { url: document };
      }

      if (mimetype) mediaInput.mimetype = mimetype;
      if (fileName) mediaInput.fileName = fileName;

      const preparedMedia = await generateWAMessageContent(mediaInput, {
        upload: conn.waUploadToServer,
      });

      if (preparedMedia.documentMessage) {
        if (fileName) preparedMedia.documentMessage.fileName = fileName;
        if (fileLength !== null) preparedMedia.documentMessage.fileLength = fileLength.toString();
        if (pageCount !== null) preparedMedia.documentMessage.pageCount = pageCount;
        if (mimetype) preparedMedia.documentMessage.mimetype = mimetype;
        if (jpegThumbnail && Buffer.isBuffer(jpegThumbnail)) {
          preparedMedia.documentMessage.jpegThumbnail = jpegThumbnail;
        }
      }

      messageContent.header = {
        title: title || "",
        hasMediaAttachment: hasMediaAttachment || true,
        documentMessage: preparedMedia.documentMessage,
      };
    }
    // Handle Location
    else if (location && typeof location === "object") {
      messageContent.header = {
        title: title || location.name || "Location",
        hasMediaAttachment: hasMediaAttachment || false,
        locationMessage: {
          degreesLatitude: location.degressLatitude || location.degreesLatitude || 0,
          degreesLongitude: location.degressLongitude || location.degreesLongitude || 0,
          name: location.name || "",
          address: location.address || "",
        },
      };
    }
    // Handle Product
    else if (product && typeof product === "object") {
      let productImageMessage = null;
      if (product.productImage) {
        const mediaInput = {};
        if (Buffer.isBuffer(product.productImage)) {
          mediaInput.image = product.productImage;
        } else if (typeof product.productImage === "object" && product.productImage.url) {
          mediaInput.image = { url: product.productImage.url };
        } else if (typeof product.productImage === "string") {
          mediaInput.image = { url: product.productImage };
        }

        const preparedMedia = await generateWAMessageContent(mediaInput, {
          upload: conn.waUploadToServer,
        });
        productImageMessage = preparedMedia.imageMessage;
      }

      messageContent.header = {
        title: title || product.title || "Product",
        hasMediaAttachment: hasMediaAttachment || false,
        productMessage: {
          product: {
            productImage: productImageMessage,
            productId: product.productId || "",
            title: product.title || "",
            description: product.description || "",
            currencyCode: product.currencyCode || "USD",
            priceAmount1000: parseInt(product.priceAmount1000) || 0,
            retailerId: product.retailerId || "",
            url: product.url || "",
            productImageCount: product.productImageCount || 1,
          },
          businessOwnerJid: businessOwnerJid || product.businessOwnerJid || conn.user.id,
        },
      };
    }
    // Handle Text Only
    else if (title) {
      messageContent.header = {
        title: title,
        hasMediaAttachment: false,
      };
    }

    // Body text
    const hasMedia = !!(image || video || document || location || product);
    const bodyText = hasMedia ? caption : text || caption;

    if (bodyText) {
      messageContent.body = { text: bodyText };
    }

    // Footer
    if (footer) {
      messageContent.footer = { text: footer };
    }

    // ── Build nativeFlowMessage ──────────────────────────────────
    // messageParamsJson: opsional untuk tap target / thumbnail URL
    // Bisa diisi via tapTarget: { url, title, domain, buttonIndex }
    // atau via content.messageParamsJson (string JSON langsung)
    let messageParamsJson = content.messageParamsJson || null;

    if (!messageParamsJson && tapTarget && typeof tapTarget === "object") {
      const tapEntry = {
        canonical_url: tapTarget.canonicalUrl || tapTarget.url || "",
        url_type: tapTarget.urlType || "STATIC",
        button_index: tapTarget.buttonIndex ?? 0,
        title: tapTarget.title || "",
        domain: tapTarget.domain || (tapTarget.url ? new URL(tapTarget.url).hostname : ""),
        tap_target_format: tapTarget.format ?? 1,
      };
      messageParamsJson = JSON.stringify({
        bottom_sheet: {
          in_thread_buttons_limit: allButtons.length,
          divider_indices: tapTarget.dividerIndices || [],
        },
        tap_target_configuration: tapEntry,
        tap_target_list: [tapEntry],
      });
    }

    messageContent.nativeFlowMessage = {
      buttons: processedButtons,
      ...(messageParamsJson && { messageParamsJson }),
    };

    // ── Context Info ─────────────────────────────────────────────
    if (contextInfo && typeof contextInfo === "object") {
      messageContent.contextInfo = { ...contextInfo };
    } else if (externalAdReply && typeof externalAdReply === "object") {
      messageContent.contextInfo = {
        externalAdReply: {
          title: externalAdReply.title || "",
          body: externalAdReply.body || "",
          mediaType: externalAdReply.mediaType || 1,
          sourceUrl: externalAdReply.sourceUrl || externalAdReply.url || "",
          thumbnailUrl: externalAdReply.thumbnailUrl || externalAdReply.thumbnail || "",
          renderLargerThumbnail: externalAdReply.renderLargerThumbnail || false,
          showAdAttribution: externalAdReply.showAdAttribution !== false,
          containsAutoReply: externalAdReply.containsAutoReply || false,
          ...(externalAdReply.mediaUrl && { mediaUrl: externalAdReply.mediaUrl }),
          ...(externalAdReply.thumbnail && Buffer.isBuffer(externalAdReply.thumbnail) && {
            thumbnail: externalAdReply.thumbnail,
          }),
          ...(externalAdReply.jpegThumbnail && Buffer.isBuffer(externalAdReply.jpegThumbnail) && {
            jpegThumbnail: externalAdReply.jpegThumbnail,
          }),
        },
      };
    }

    // Mentions
    if (options.mentions || options.mentionedJid) {
      if (messageContent.contextInfo) {
        messageContent.contextInfo.mentionedJid = options.mentions || options.mentionedJid;
      } else {
        messageContent.contextInfo = {
          mentionedJid: options.mentions || options.mentionedJid,
        };
      }
    }

    // Quoted message
    if (options.quoted) {
      if (!messageContent.contextInfo) messageContent.contextInfo = {};
      messageContent.contextInfo = {
        ...messageContent.contextInfo,
        stanzaId: options.quoted.key.id,
        remoteJid: options.quoted.key.remoteJid,
        participant: options.quoted.key.participant || options.quoted.key.remoteJid,
        fromMe: options.quoted.key.fromMe,
        quotedMessage: options.quoted.message,
      };
    }

    const payload = proto.Message.InteractiveMessage.create(messageContent);

    const msg = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            interactiveMessage: payload,
          },
        },
      },
      {
        userJid: conn.user.id,
        quoted: options?.quoted || null,
      }
    );

    const additionalNodes = [
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: {
              type: "native_flow",
              v: "1",
            },
            content: [
              {
                tag: "native_flow",
                attrs: {
                  v: "9",
                  name: "mixed",
                },
              },
            ],
          },
        ],
      },
    ];

    await conn.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
      additionalNodes,
    });

    return msg;
  } catch (error) {
    throw new Error(error.stack);
  }
};

conn.sendCard = async (jid, content = {}, options = {}) => {
  try {
    if (!conn.user?.id) {
      throw new Error("User not authenticated");
    }

    const { text = "", title = "", footer = "", cards = [] } = content;
    
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error("Cards must be a non-empty array");
    }

    if (cards.length > 10) {
      throw new Error("Maximum 10 cards allowed");
    }

    const carouselCards = await Promise.all(
      cards.map(async (card) => {
        let type = null;
        let media = null;

        if (card.image) {
          type = "image";
          media = card.image;
        } else if (card.video) {
          type = "video";
          media = card.video;
        } else {
          throw new Error("Card must have image or video");
        }

        const mediaInput = {};
        if (Buffer.isBuffer(media)) {
          mediaInput[type] = media;
        } else if (typeof media === "object" && media.url) {
          mediaInput[type] = { url: media.url };
        } else if (typeof media === "string") {
          mediaInput[type] = { url: media };
        } else {
          throw new Error("Media must be Buffer, URL string, or {url: string}");
        }

        const prepped = await generateWAMessageContent(mediaInput, {
          upload: conn.waUploadToServer,
        });

        const cardObj = {
          header: {
            title: card.title || "",
            hasMediaAttachment: true,
          },
          body: {
            text: card.body || "",
          },
          footer: {
            text: card.footer || "",
          },
        };

        if (type === "image") {
          cardObj.header.imageMessage = prepped.imageMessage;
        } else if (type === "video") {
          cardObj.header.videoMessage = prepped.videoMessage;
        }

        if (Array.isArray(card.buttons) && card.buttons.length > 0) {
          cardObj.nativeFlowMessage = {
            buttons: card.buttons.map((btn) => ({
              name: btn.name || "quick_reply",
              buttonParamsJson: typeof btn.buttonParamsJson === 'string'
                ? btn.buttonParamsJson
                : JSON.stringify(btn.buttonParamsJson || btn),
            })),
          };
        }

        return cardObj;
      })
    );

    const payload = proto.Message.InteractiveMessage.create({
      body: { text: text },
      footer: { text: footer },
      header: title ? { title: title } : undefined,
      carouselMessage: {
        cards: carouselCards,
        messageVersion: 1,
      },
    });

    // Context Info & Quoted
    if (options.quoted || options.mentions || options.contextInfo) {
      payload.contextInfo = {
        ...(options.contextInfo || {}),
        ...(options.mentions && { mentionedJid: options.mentions }),
        ...(options.quoted && {
          stanzaId: options.quoted.key.id,
          remoteJid: options.quoted.key.remoteJid,
          participant: options.quoted.key.participant || options.quoted.key.remoteJid,
          fromMe: options.quoted.key.fromMe,
          quotedMessage: options.quoted.message
        })
      };
    }

    const msg = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            interactiveMessage: payload,
          },
        },
      },
      {
        userJid: conn.user.id,
        quoted: options?.quoted || null,
      }
    );

    await conn.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
    });

    return msg;
  } catch (error) {
    throw new Error(error.stack);
  }
};


  conn.sendAlbum = async (jid, array, options = {}) => {
    try {
      const delay = options.delay ?? 500;

      if (!Array.isArray(array) || array.length === 0) {
        throw new RangeError("Parameter 'array' harus berupa array dengan minimal 1 media.");
      }

      if (array.length === 1) {
        const content = array[0];
        return await conn.sendMessage(jid, content, { 
          quoted: options?.quoted || null
        });
      }

      const validMedia = array.filter(item => {
        return item && (item.image || item.video);
      });

      if (validMedia.length === 0) {
        throw new Error("Tidak ada media valid dalam array.");
      }

      if (validMedia.length === 1) {
        return await conn.sendMessage(jid, validMedia[0], { 
          quoted: options?.quoted || null
        });
      }

      const imageCount = validMedia.filter(a => a.image).length;
      const videoCount = validMedia.filter(a => a.video).length;

      const messageContent = {
        messageContextInfo: { 
          messageSecret: randomByte(32) 
        },
        albumMessage: {
          expectedImageCount: imageCount,
          expectedVideoCount: videoCount,
        }
      };

      const generationOptions = {
        userJid: conn.user.id,
        upload: conn.waUploadToServer,
        quoted: options?.quoted || null
      };

      const album = generateWAMessageFromContent(jid, messageContent, generationOptions);

      let albumSent = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!albumSent && retryCount < maxRetries) {
        try {
          await conn.relayMessage(album.key.remoteJid, album.message, { 
            messageId: album.key.id 
          });
          albumSent = true;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) throw new Error(error.stack);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      const results = [];
      const failedMedia = [];

      for (let i = 0; i < validMedia.length; i++) {
        const content = validMedia[i];
        let mediaRetryCount = 0;
        let mediaSent = false;

        await new Promise(res => setTimeout(res, delay));

        while (!mediaSent && mediaRetryCount < maxRetries) {
          try {
            const mediaMessage = await generateWAMessage(album.key.remoteJid, content, {
              upload: conn.waUploadToServer
            });

            mediaMessage.message.messageContextInfo = {
              messageSecret: randomByte(32),
              messageAssociation: {
                associationType: 1,
                parentMessageKey: album.key,
              },
            };

            const result = await conn.relayMessage(
              mediaMessage.key.remoteJid, 
              mediaMessage.message, 
              { messageId: mediaMessage.key.id }
            );

            results.push(result);
            mediaSent = true;

          } catch (error) {
            mediaRetryCount++;
            if (mediaRetryCount >= maxRetries) {
              failedMedia.push({ index: i, error: error.message });
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * mediaRetryCount));
          }
        }
      }

      return {
        album,
        results,
        failedMedia,
        successCount: results.length,
        totalCount: validMedia.length
      };
    } catch (error) {
      throw new Error(error.stack);
    }
};

  return conn;
}