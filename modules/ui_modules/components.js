
import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';
import { PhoneSim_Sounds } from '../sounds.js';
import { PhoneSim_Parser } from '../parser.js';

let jQuery_API, parentWin, SillyTavern_Context_API, UI, DataHandler;
let notificationTimeoutId; // Hold the timeout ID for the notification banner

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    SillyTavern_Context_API = deps.st_context;
    UI = uiObject;
    DataHandler = dataHandler;
}

export function getPostListSkeleton() {
    return `
    <div class="skeleton-forum-post-list">
        ${'<div class="skeleton-forum-post-item"><div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text short"></div><div class="skeleton meta"></div></div>'.repeat(5)}
    </div>`;
}

export function getStreamListSkeleton() {
    return `
    <div class="skeleton-stream-list">
        ${'<div class="skeleton-stream-item"><div class="skeleton thumbnail"></div><div class="skeleton-stream-info"><div class="skeleton title"></div><div class="skeleton meta"></div></div></div>'.repeat(6)}
    </div>`;
}

export function renderInteractiveMessage(message) {
    const { requestData, uid } = message;
    if (!requestData || requestData.type !== 'friend_request') {
        return `<div>[Unrecognized interactive message]</div>`;
    }

    const { from_id, from_name, status } = requestData;
    
    let actionsHtml = '';
    if (status === 'pending') {
        actionsHtml = `
            <div class="friend-request-actions">
                <button class="friend-request-btn decline" data-action="ignore">Ignore</button>
                <button class="friend-request-btn accept" data-action="accept">Accept</button>
            </div>`;
    } else {
        const statusText = status === 'accepted' ? 'Added' : 'Ignored';
        actionsHtml = `<div class="friend-request-status">${statusText}</div>`;
    }

    return `
        <div class="message system-notification" data-uid="${uid}">
            <div class="friend-request-bubble" data-uid="${uid}" data-from-id="${from_id}" data-from-name="${from_name}">
                <div class="request-header">
                    <div class="sender-name">${jQuery_API('<div>').text(from_name).html()}</div>
                    <div class="request-subtitle">Wants to add you as a friend</div>
                </div>
                <div class="request-content">Note: ${jQuery_API('<div>').text(message.content).html()}</div>
                ${actionsHtml}
            </div>
        </div>`;
}

/**
 * Renders any type of content (string, object, or array) into its corresponding HTML representation for display.
 * This is the single source of truth for all content rendering.
 * @param {*} content - The content to render.
 * @param {object} context - Contextual options, e.g., { isMoment: true }.
 * @returns {string} - The generated HTML string.
 */
export function renderRichContent(content, context = {}) {
    const { isMoment = false, uid = '' } = context;
    const sanitize = (text) => jQuery_API('<div>').text(text).html();

    if (typeof content === 'string') {
        const parsed = PhoneSim_Parser._parseContent(content);
        if (parsed !== content) {
            return UI.renderRichContent(parsed, context);
        }
        
        const downloadLinkRegex = /\[([^\]]+)\]\(([^|]+)\|([^)]+)\)/g;
        let processedText = sanitize(content).replace(/\\n/g, '<br>');
        processedText = processedText.replace(downloadLinkRegex, (match, linkText, fileName, description) => {
            return `<a href="${sanitize(fileName)}" data-download="true" data-description="${sanitize(description)}">${sanitize(linkText)}</a>`;
        });
        return processedText;
    }
    
    if (Array.isArray(content)) {
        return `<div class="mixed-content">${content.map(p => UI.renderRichContent(p, context)).join('')}</div>`;
    }

    if (typeof content === 'object' && content !== null) {
        switch(content.type) {
            case 'text':
                return renderRichContent(content.value, context);
            case 'image':
                return `<div class="rich-message"><img src="${sanitize(content.url)}" class="inline-image" alt="Image"></div>`;
            case 'local_image':
                return `<div class="rich-message"><img src="${content.base64}" class="inline-image" alt="Local image preview"></div>`;
            case 'pseudo_image':
                const text = sanitize(content.text);
                if (isMoment) {
                    return `<div class="rich-message pseudo-image-moment"><i class="fas fa-image"></i> [Image] ${text}</div>`;
                }
                return `<div class="rich-message pseudo-image-message">
                            <div class="pseudo-image-cover"><i class="fas fa-image"></i> [Image] Click to view</div>
                            <div class="pseudo-image-text" style="display:none;">${text}</div>
                        </div>`;
            case 'voice': 
                return `<div class="rich-message voice-message" data-text="${sanitize(content.text)}"><div class="voice-bar"><div class="voice-wave"><span></span><span></span><span></span><span></span></div><span class="voice-duration">${sanitize(content.duration)}</span></div><div class="voice-transcript">${sanitize(content.text)}</div></div>`;
            case 'transfer': 
            case 'red_packet':
                const isRedPacket = content.type === 'red_packet';
                const isClaimed = content.status === 'claimed';
                const statusText = isClaimed ? (isRedPacket ? 'Red packet claimed' : 'Received') : (isRedPacket ? 'Claim Red Packet' : 'Pending');
                const className = `${content.type} ${isClaimed ? 'claimed' : 'unclaimed'}`;
                const footerText = isRedPacket ? 'WeChat Red Packet' : 'WeChat Transfer';
                const iconSvg = isRedPacket ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20,6H4V4H20V6M20,12H4V8H20V12M18,14H6A2,2 0 0,0 4,16V19A2,2 0 0,0 6,21H18A2,2 0 0,0 20,19V16A2,2 0 0,0 18,14Z"></path></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"><path d="M12 2v20M5 8h14M5 14h14"/></svg>`;
                
                let primaryText, secondaryText;
                if (isRedPacket) {
                    primaryText = sanitize(content.note || 'Best wishes!');
                    secondaryText = statusText;
                } else {
                    primaryText = `￥${sanitize(content.amount)}`;
                    secondaryText = statusText;
                }
                
                return `<div class="rich-message transfer-message ${className}" data-uid="${uid}">
                            <div class="transfer-inner">
                                <div class="transfer-icon">${iconSvg}</div>
                                <div class="transfer-info">
                                    <span class="transfer-note">${primaryText}</span>
                                    <span class="transfer-amount">${secondaryText}</span>
                                </div>
                            </div>
                            <div class="transfer-footer">${footerText}</div>
                        </div>`;
            case 'location':
                const locationText = sanitize(content.text);
                return `<div class="rich-message location-message" data-location="${locationText}" title="Click to view details">
                                    <div class="location-map"></div>
                                    <div class="location-text-content">
                                        <div class="location-title">${locationText}</div>
                                        <div class="location-subtitle">Received location</div>
                                    </div>
                                </div>`;
            case 'call_end':
                const icon = '<i class="fas fa-phone"></i>';
                return `<div class="call-end-bubble">${icon}<span>Call duration ${sanitize(content.duration)}</span></div>`;
            default: return `<div>[Unknown message format]</div>`;
        }
    }
     return `<div>[Unknown message format]</div>`;
}


export function renderSystemMessage(message) {
    const { content, uid } = message;
    let textContent;

    if (typeof content === 'object' && content !== null && content.type === 'call_end') {
        textContent = `Call ended, duration ${content.duration}`;
    } else {
        textContent = jQuery_API('<div>').text(content).html();
    }
    
    return `<div class="message system-notification" data-uid="${uid}"><span>${textContent}</span></div>`;
}


export function renderSingleMessage(s, isGroup) {
    const isPlayer = s.sender_id === PhoneSim_Config.PLAYER_ID;
    const senderName = UI._getContactName(s.sender_id);
    
    if (s.recalled) {
        const recalledBy = isPlayer ? 'You' : senderName;
        const recalledText = `${recalledBy} recalled a message`;
        return `<div class="message system-notification" data-uid="${s.uid}"><span>${recalledText}</span></div>`;
    }

    const senderContact = PhoneSim_State.contacts[s.sender_id];
    const senderAvatar = isPlayer 
        ? (PhoneSim_State.customization.playerAvatar || UI.generateDefaultAvatar('Me')) 
        : (senderContact?.profile?.avatar || UI.generateDefaultAvatar(senderName));
        
    const contentHtml = renderRichContent(s.content, { uid: s.uid });
    
    let messageClass = `message ${isPlayer ? 'sent' : 'received'} ${s.isStaged ? 'staged' : ''}`;
    
    const messageActionsHtml = `<div class="message-actions" data-message-uid="${s.uid}" title="More actions"><i class="fas fa-ellipsis-h"></i></div>`;
    const avatarHtml = `<div class="avatar-container"><img src="${senderAvatar}" class="avatar clickable-avatar" data-contact-id="${s.sender_id}"></div>`;
    const statusHtml = isPlayer && s.isStaged ? `<div class="message-status"><i class="fas fa-clock" title="Sending"></i></div>` : '';
    const senderNameHtml = isGroup && !isPlayer ? `<div class="sender-name">${senderName}</div>` : '';

    const bubbleContent = `<div class="message-content">${contentHtml}</div>`;

    if (isPlayer) {
        return `<div class="${messageClass}" data-uid="${s.uid}">
                    <div class="message-wrapper-with-actions">
                        <div class="message-wrapper">${bubbleContent}</div>
                        ${messageActionsHtml}${statusHtml}
                    </div>
                    ${avatarHtml}
                </div>`;
    } else {
        return `<div class="${messageClass}" data-uid="${s.uid}">
                    ${avatarHtml}
                    <div class="message-wrapper-with-actions">
                        <div class="message-wrapper">${senderNameHtml}${bubbleContent}</div>
                        ${messageActionsHtml}
                    </div>
                </div>`;
    }
}


export function showTransactionModal(message) {
    const p = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.PANEL_ID}`);
    const content = message.content;
    const sender = PhoneSim_State.contacts[message.sender_id];
    const senderName = sender ? (sender.profile.note || sender.profile.nickname) : 'Unknown';
    const isRedPacket = content.type === 'red_packet';
    
    const modal = p.find(isRedPacket ? '#phone-sim-red-packet-modal' : '#phone-sim-transfer-modal');
    
    if (isRedPacket) {
        modal.find('.red-packet-sender').text(`${senderName}'s Red Packet`);
        modal.find('.red-packet-note').text(content.note || 'Best wishes!');
    } else {
        modal.find('.transfer-modal-subtitle').text(`${senderName} sent you a transfer`);
        modal.find('.transfer-modal-amount').text(`￥${content.amount}`);
        modal.find('.transfer-modal-note').text(content.note || 'Transfer');
    }
    
    modal.show();
    
    const close = () => {
        modal.hide();
        modal.find('.confirm-btn, .cancel-btn').off('.transaction');
    };

    modal.find('.confirm-btn').one('click.transaction', async () => {
        PhoneSim_Sounds.play('open');
        await DataHandler.claimTransaction(message.uid);
        close();
    });
    modal.find('.cancel-btn').one('click.transaction', () => {
        PhoneSim_Sounds.play('tap');
        close();
    });
}

export async function showDialog(title, initialValue = '') {
    return new Promise(resolve => {
        const dialog = jQuery_API(parentWin.document.body).find('#phone-sim-dialog-overlay');
        dialog.find('#phone-sim-dialog-title').text(title);
        const textarea = dialog.find('#phone-sim-dialog-textarea').val(initialValue);
        dialog.show();
        textarea.focus();
        const confirmBtn = dialog.find('#phone-sim-dialog-confirm');
        const cancelBtn = dialog.find('#phone-sim-dialog-cancel');
        const close = (value) => { dialog.hide(); confirmBtn.off(); cancelBtn.off(); resolve(value); };
        confirmBtn.one('click', () => { PhoneSim_Sounds.play('tap'); close(textarea.val()); });
        cancelBtn.one('click', () => { PhoneSim_Sounds.play('tap'); close(null); });
    });
}

export function showNotificationBanner(contact, message) {
    const p = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.PANEL_ID}`);
    let banner = p.find('#phone-sim-notification-banner');

    clearTimeout(notificationTimeoutId);
    banner.removeClass('show');

    const isGroup = contact.id?.startsWith('group_');
    const name = isGroup ? contact.profile.groupName : (contact.profile.note || contact.profile.nickname);
    const avatar = contact.profile.avatar || UI.generateDefaultAvatar(name);
    let preview = '...';
    if (typeof message.content === 'string') preview = message.content;
    else if (message.content?.type) {
        if (message.app === 'Email') preview = message.content;
        else preview = '[Rich Content Message]';
    }

    const bannerContent = `<div class="notification-content"><img src="${avatar}" class="notification-avatar"/><div class="notification-text"><h4>${name}</h4><p>${jQuery_API('<div>').text(preview).html()}</p></div></div>`;
    
    setTimeout(() => {
        banner.html(bannerContent).addClass('show');
        notificationTimeoutId = setTimeout(() => banner.removeClass('show'), 4000);
    }, 50);
}


export function updateCommitButton() {
    const btn = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.COMMIT_BUTTON_ID}`);
    const count = PhoneSim_State.stagedPlayerMessages.length + PhoneSim_State.stagedPlayerActions.length;
    if (count > 0) btn.addClass('has-staged-messages').attr('data-count', count);
    else btn.removeClass('has-staged-messages').removeAttr('data-count');
}
