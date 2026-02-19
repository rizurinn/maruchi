import { jidNormalizedUser, getDevice, areJidsSameUser, getContentType, normalizeMessageContent, downloadContentFromMessage } from 'baileys';
import { log } from '../../lib/log.js';

function normalizeMentionsInBody(body, originalMentionedJids, resolvedMentionedJids) {
  if (!body || !Array.isArray(originalMentionedJids) || !Array.isArray(resolvedMentionedJids)) return body;
  let normalizedBody = body;
  const lidToJidMap = new Map();

  for (let i = 0; i < Math.min(originalMentionedJids.length, resolvedMentionedJids.length); i++) {
    const original = originalMentionedJids[i];
    const resolved = resolvedMentionedJids[i];
    if (original !== resolved && original.endsWith('@lid') && resolved.endsWith('@s.whatsapp.net')) {
      const lidNumber = original.split('@')[0];
      const jidNumber = resolved.split('@')[0];
      lidToJidMap.set(lidNumber, jidNumber);
    }
  }

  for (const [lidNumber, jidNumber] of lidToJidMap.entries()) {
    const patterns = [
      new RegExp(`@\\+?\\s*${lidNumber.replace(/(\d)/g, '$1\\s*')}\\b`, 'g'),
      new RegExp(`@${lidNumber}\\b`, 'g')
    ];
    for (const pattern of patterns) {
      normalizedBody = normalizedBody.replace(pattern, `@${jidNumber}`);
    }
  }

  return normalizedBody;
}

export default async function serializeM(conn, msg, store) {
  try {
    if (!msg || !msg.message) return null;
    if (msg.messageStubType === 0 && !msg.message) {
      log.warn('Skipping stub message without content');
      return null;
    }

    const botNumber = jidNormalizedUser(conn.user?.lid || conn.user?.id);
    const m = {};

    // 1. Basic Key Properties
    m.key = { ...msg.key };
    m.chat = msg.key.remoteJid;
    m.isGroup = m.chat.endsWith('@g.us');
    m.fromMe = msg.key.fromMe;

    // 2. Handle Message Stub (System messages like "User joined", etc)
    if (msg.messageStubType) {
      m.messageStubType = msg.messageStubType;
      m.messageStubParameters = (msg.messageStubParameters || []).map((param) => {
        try { return conn.decodeJid ? conn.decodeJid(param) : param; } 
        catch { return param; }
      });
      return m; // Return early for stubs
    }

    // 3. Sender Identification
    if (m.isStatus) {
      m.sender = msg.key.participant;
      m.chat = m.sender; // Override chat for status
    } else if (m.isGroup) {
      m.sender = msg.key.participant;
      m.chat = jidNormalizedUser(m.chat);
    } else {
      m.sender = m.fromMe ? botNumber : jidNormalizedUser(m.chat);
      m.chat = m.sender;
    }

    // 4. Group Metadata & Admin Checks
    m.isAdmin = false;
    m.isBotAdmin = false;

    if (m.isGroup) {
      try {
        let metadata = store.getGroupMetadata(m.chat);
        if (!metadata && !metadata?.participants?.length) {
          metadata = await conn.groupMetadata(m.chat);
          if (metadata && store.updateGroupMetadata) await store.updateGroupMetadata(m.chat, metadata);
        }
        m.metadata = metadata

        if (metadata?.participants) {
          const participants = metadata.participants.map((p) => ({
            id: p.id, jid: p.jid, lid: p.lid, admin: p.admin || null
          }));
          
          let groupAdmins = participants.filter(p => p.admin);

          m.isAdmin = groupAdmins.some(admin => 
            (admin.id && areJidsSameUser(admin.id, m.sender)) || 
            (admin.jid && areJidsSameUser(admin.jid, m.sender)) || 
            (admin.lid && areJidsSameUser(admin.lid, m.sender))
          );

          const botId = conn.user?.id;
          const botLid = conn.user?.lid;
          
          m.isBotAdmin = groupAdmins.some(admin => 
            (botId && (areJidsSameUser(admin.id, botId) || areJidsSameUser(admin.jid, botId) || areJidsSameUser(admin.lid, botId))) ||
            (botLid && (areJidsSameUser(admin.id, botLid) || areJidsSameUser(admin.jid, botLid) || areJidsSameUser(admin.lid, botLid)))
          );
        }
      } catch (error) {
        log.error(`Error getting group metadata: ${error}`);
      }
    }

    // 5. Unwrapping Message Content
    try {
      m.message = normalizeMessageContent(msg.message);
    } catch (unwrapError) {
      log.error({ error: unwrapError.message }, 'Serialize unwrap failed');
      m.message = msg.message;
    }
    if (!m.message) return null;

    // 6. Handle Edited Messages
    m.isEditedMessage = false;
    m.editInfo = null;
    const protocolMsg = m.message.editedMessage?.message?.protocolMessage;
    
    if (protocolMsg && protocolMsg.type === 14 && protocolMsg.editedMessage) {
      m.isEditedMessage = true;
      const editedContent = protocolMsg.editedMessage;
      let newText = '', mediaType = 'unknown', isMediaEdit = false;

      if (editedContent.conversation) { newText = editedContent.conversation; mediaType = 'text'; } 
      else if (editedContent.extendedTextMessage?.text) { newText = editedContent.extendedTextMessage.text; mediaType = 'extendedText'; } 
      else if (editedContent.imageMessage) { newText = editedContent.imageMessage.caption || ''; mediaType = 'image'; isMediaEdit = true; } 
      else if (editedContent.videoMessage) { newText = editedContent.videoMessage.caption || ''; mediaType = 'video'; isMediaEdit = true; } 
      else if (editedContent.documentMessage) { newText = editedContent.documentMessage.caption || editedContent.documentMessage.fileName || ''; mediaType = 'document'; isMediaEdit = true; }

      m.editInfo = {
        originalMessageId: protocolMsg.key.id,
        originalKey: { remoteJid: protocolMsg.key.remoteJid, id: protocolMsg.key.id, fromMe: protocolMsg.key.fromMe, participant: protocolMsg.key.participantAlt || protocolMsg.key.participant },
        newText,
        editTimestamp: protocolMsg.timestampMs?.low || protocolMsg.timestampMs?.high || Date.now(),
        mediaType,
        isMediaEdit
      };
    }

    // 7. General Message Properties
    m.pushName = msg.pushName;
    m.type = getContentType(m.message) || Object.keys(m.message)[0];
    const mesej = m.message[m.type] || m.message;
    
    // Parse Body
    let originalBody = m.message?.conversation || mesej?.text || mesej?.conversation || mesej?.caption || mesej?.selectedButtonId || mesej?.singleSelectReply?.selectedRowId || mesej?.selectedId || mesej?.contentText || mesej?.selectedDisplayText || mesej?.title || mesej?.name || '';
    if (m.type === 'interactiveResponseMessage' && mesej?.nativeFlowResponseMessage?.paramsJson) {
      try { originalBody = JSON.parse(mesej.nativeFlowResponseMessage.paramsJson).id || originalBody; } catch {}
    }

    // Parse Mentions
    const rawMentionedJid = mesej?.contextInfo?.mentionedJid || [];
    m.mentionedJid = rawMentionedJid.map((mentionId) => {
      try { return conn.decodeJid ? conn.decodeJid(mentionId) : mentionId; } 
      catch { return mentionId; }
    });

    m.body = normalizeMentionsInBody(originalBody, rawMentionedJid, m.mentionedJid);
    m.device = getDevice(m.key.id);
    m.expiration = mesej?.contextInfo?.expiration || 0;
    
    const parseTimestamp = (t) => typeof t === 'number' ? t : t?.low || t?.high || 0;
    m.timestamp = parseTimestamp(msg.messageTimestamp) || 0;

    // 8. Media & Specific Types Info
    m.isMedia = !!mesej?.mimetype || !!mesej?.thumbnailDirectPath;
    if (m.isMedia) {
      m.mime = mesej?.mimetype;
      m.size = mesej?.fileLength;
      m.height = mesej?.height || '';
      m.width = mesej?.width || '';
      if (/webp/i.test(m.mime)) m.isAnimated = mesej?.isAnimated;
    }
    
    Object.defineProperties(m, {
      reply: {
        value: async (text) => await conn.reply(m.chat, text, { quoted: m }),
        enumerable: false,
        writable: false,
        configurable: false
      },
      
      download: {
        value: async () => {
          const stream = await downloadContentFromMessage(mesej, m.type.replace(/message/i, ""));
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          return Buffer.concat(chunks);
        },
        enumerable: false,
        writable: false,
        configurable: false
      }
    });

    if (m.type === 'reactionMessage') m.reaction = { ...mesej, sender: m.sender, chat: m.chat };
    if (m.type === 'protocolMessage') m.protocolMessage = mesej;
    if (m.type === 'buttonsResponseMessage') { m.selectedButtonId = mesej.selectedButtonId; m.selectedButtonText = mesej.selectedDisplayText || ''; }
    if (m.type === 'listResponseMessage') { m.selectedRowId = mesej.singleSelectReply?.selectedRowId || ''; m.selectedRowTitle = mesej.title || ''; m.selectedRowDescription = mesej.description || ''; }
    if (m.type === 'pollCreationMessage') m.poll = mesej;
    if (m.type === 'pollUpdateMessage') m.pollUpdate = mesej;
    if (m.type === 'pollResponseMessage') m.pollResponse = mesej;

    // 10. Quoted Message Handling
    m.quoted = null;
    if (mesej?.contextInfo?.quotedMessage) {
      const quotedInfo = mesej.contextInfo;
      const quotedMsg = normalizeMessageContent(quotedInfo.quotedMessage);

      if (quotedMsg) {
        const quotedType = getContentType(quotedMsg) || Object.keys(quotedMsg)[0];
        let quotedContent = quotedMsg[quotedType] || quotedMsg;
        let quotedMedia = quotedContent;
        let downloadType = null;

        // Structural Media Detection (from previous fix)
        if (quotedType === 'interactiveMessage') {
          const interactive = quotedContent;
          if (interactive.header?.hasMediaAttachment) {
             if (interactive.header.imageMessage) { quotedMedia = interactive.header.imageMessage; downloadType = 'image'; }
             else if (interactive.header.videoMessage) { quotedMedia = interactive.header.videoMessage; downloadType = 'video'; }
             else if (interactive.header.documentMessage) { quotedMedia = interactive.header.documentMessage; downloadType = 'document'; }
             else if (interactive.header.productMessage?.product?.productImage) { quotedMedia = interactive.header.productMessage.product.productImage; downloadType = 'image'; }
          } else if (interactive.carouselMessage?.cards?.[0]?.header) {
             const firstCardHeader = interactive.carouselMessage.cards[0].header;
             if (firstCardHeader.imageMessage) { quotedMedia = firstCardHeader.imageMessage; downloadType = 'image'; }
             else if (firstCardHeader.videoMessage) { quotedMedia = firstCardHeader.videoMessage; downloadType = 'video'; }
             else if (firstCardHeader.documentMessage) { quotedMedia = firstCardHeader.documentMessage; downloadType = 'document'; }
          }
        } else if (quotedType === 'viewOnceMessageV2' || quotedType === 'viewOnceMessage') {
          const innerMsg = quotedContent.message;
          if (innerMsg) {
              const innerType = getContentType(innerMsg);
              quotedMedia = innerMsg[innerType] || quotedMedia;
              if (innerType && ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'].includes(innerType)) {
                 downloadType = innerType.replace(/Message/i, '');
              }
          }
        } else {
            const validTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'];
            if (validTypes.includes(quotedType)) downloadType = quotedType.replace(/Message/i, '');
        }

        m.quoted = {
          key: {
            remoteJid: m.chat,
            participant: quotedInfo.participant,
            participantAlt: quotedInfo.participantAlt,
            fromMe: areJidsSameUser(quotedInfo.participant, botNumber),
            id: quotedInfo.stanzaId,
          },
          type: quotedType,
          sender: quotedInfo.participant,
          isMedia: !!quotedMedia?.mimetype || !!quotedMedia?.thumbnailDirectPath,
          message: quotedMsg,
          expiration: quotedContent?.contextInfo?.expiration || 0
        };

        // Resolve Quoted Mentions
        const rawQuotedMentionedJid = quotedContent?.contextInfo?.mentionedJid || [];
        m.quoted.mentionedJid = rawQuotedMentionedJid.map((mentionId) => {
          try { return conn.decodeJid ? conn.decodeJid(mentionId) : mentionId; } 
          catch { return mentionId; }
        });
        if (quotedContent?.contextInfo) quotedContent.contextInfo.mentionedJid = m.quoted.mentionedJid;

        // Quoted Body
        m.quoted.body = quotedContent?.text || quotedContent?.caption || quotedContent?.conversation || quotedContent?.selectedButtonId || quotedContent?.singleSelectReply?.selectedRowId || quotedContent?.selectedId || quotedContent?.contentText || quotedContent?.selectedDisplayText || quotedContent?.title || quotedContent?.name || quotedContent?.body?.text || quotedMsg.caption || quotedMsg.conversation || quotedMsg.contentText || quotedMsg.selectedDisplayText || quotedMsg.title || '';

        // Retrieve Contact Name from Store
        m.quoted.pushName = "Unknown";
        if (store) {
           const id = m.quoted.sender;
           if (id === botNumber) m.quoted.pushName = conn.user?.name;
           else if (id.endsWith("g.us")) m.quoted.pushName = store.getChat?.(id)?.metadata?.subject || "none";
           else {
              const contact = store.getContact(id);
              m.quoted.pushName = contact?.notify || contact?.verifiedName || contact?.name || "Unknown?";
           }
        }

        // Quoted Download Method (As a function)
        Object.defineProperty(m.quoted, 'download', {
            value: async () => {
                let qType = downloadType;
                if (!qType) {
                    const mimi = quotedMedia.mimetype ? quotedMedia.mimetype.split('/')[0] : '';
                    qType = mimi === 'audio' ? 'audio' : mimi === 'image' ? 'image' : mimi === 'video' ? 'video' : mimi === 'sticker' ? 'sticker' : 'document';
                }
                const stream = await downloadContentFromMessage(quotedMedia, qType);
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                return Buffer.concat(chunks);
            },
            enumerable: false,
            writable: false
        });

        // Quoted Media Info
        if (m.quoted.isMedia) {
          m.quoted.mime = quotedMedia?.mimetype;
          m.quoted.size = quotedMedia?.fileLength;
          m.quoted.height = quotedMedia?.height || '';
          m.quoted.width = quotedMedia?.width || '';
          if (/webp/i.test(quotedMedia?.mimetype)) m.quoted.isAnimated = quotedMedia?.isAnimated || false;
        }
      }
    }

    return m;
  } catch (error) {
    log.error({ error: JSON.stringify(error.stack, null, 2) }, 'Error in serializeMessage');
    if (error.message?.includes('decrypt') || error.message?.includes('session')) {
      log.error({ id: msg?.key?.remoteJid, user: msg?.key?.participant }, 'Failed to decrypt message');
    }
    return null;
  }
}
