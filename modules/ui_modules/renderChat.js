

import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';
import { PhoneSim_Sounds } from '../sounds.js';
import { stickers } from '../stickers.js';

let jQuery_API, parentWin, UI, DataHandler;

const INITIAL_MESSAGE_LOAD_COUNT = 30;
const LOAD_MORE_COUNT = 30;
let displayedMessageCount = INITIAL_MESSAGE_LOAD_COUNT;
let isRendering = false;
let isLoadingMore = false;

let isAnimatingFlags = {};

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    UI = uiObject;
    DataHandler = dataHandler;
}

function _getSnippetFromContent(content) {
    if (typeof content === 'string') {
        if (content.startsWith('[Image:')) return '[Image]';
        return content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }
    if (typeof content === 'object' && content !== null) {
        switch (content.type) {
            case 'image': case 'pseudo_image': return '[Image]';
            case 'voice': return '[Voice]';
            case 'transfer': return '[Transfer]';
            case 'red_packet': return '[Red Packet]';
            case 'location': return '[Location]';
            case 'call_end': return '[Call]';
            default: return '[Message]';
        }
    }
    if (Array.isArray(content)) {
        return '[Rich Message]';
    }
    return '...';
}

export function showReplyPreview(message) {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const previewBar = p.find('.reply-preview-bar');
    const previewContent = previewBar.find('.reply-preview-content');

    PhoneSim_State.activeReplyUid = message.uid;
    const senderName = UI._getContactName(message.sender_id);
    const snippet = _getSnippetFromContent(message.content);

    previewContent.html(`Replying to <b>${jQuery_API('<div>').text(senderName).html()}</b>: ${jQuery_API('<div>').text(snippet).html()}`);
    previewBar.slideDown(200);
}

export function hideReplyPreview() {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const previewBar = p.find('.reply-preview-bar');
    previewBar.slideUp(200);
    PhoneSim_State.activeReplyUid = null;
}

export function renderContactsList() {
    const list = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .chat-list-content`).empty();

    const getLatestTimestamp = (contact, id) => {
        const allMessages = [
            ...(contact.app_data?.WeChat?.messages || []),
            ...PhoneSim_State.stagedPlayerMessages.filter(msg => msg.contactId === id).map(m => m.tempMessageObject)
        ];
        if (allMessages.length === 0) return 0;
        return new Date(allMessages[allMessages.length - 1].timestamp).getTime();
    };

    const contactsWithTimestamps = Object.entries(PhoneSim_State.contacts)
        .filter(([id, c]) => c.profile && id !== 'PLAYER_USER')
        .map(([id, contact]) => ({ id, contact, lastTimestamp: getLatestTimestamp(contact, id) }));

    const sortedContacts = contactsWithTimestamps
        .filter(item => item.lastTimestamp > 0)
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp);

    if (sortedContacts.length === 0) {
        list.html('<div class="email-empty-state" style="color: #fff; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">No conversations</div>');
        return;
    }

    sortedContacts.forEach(({ id, contact }) => {
        const isGroup = id.startsWith('group_');
        const name = isGroup ? contact.profile.groupName : (contact.profile.note || contact.profile.nickname);
        const avatar = contact.profile.avatar || UI.generateDefaultAvatar(name);
        const unreadCount = contact.unread || 0;

        const allMessages = [
            ...(contact.app_data?.WeChat?.messages || []),
            ...PhoneSim_State.stagedPlayerMessages.filter(msg => msg.contactId === id).map(m => m.tempMessageObject)
        ];
        const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;

        let preview = '...';
        let time = '';

        if (lastMessage) {
            if (lastMessage.replyingTo) {
                preview = `[Reply] ${_getSnippetFromContent(lastMessage.content)}`;
            } else if (lastMessage.recalled) {
                preview = 'Recalled a message';
            } else if (lastMessage.requestData?.type === 'friend_request') {
                preview = 'Wants to add you as a friend';
            } else {
                preview = _getSnippetFromContent(lastMessage.content);
            }
            time = new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        
        const itemHtml = `
            <div class="chat-list-item" data-id="${id}">
                <img src="${avatar}" class="chat-avatar">
                <div class="chat-info">
                    <div class="chat-header-list">
                        <span class="chat-name-list">${jQuery_API('<div>').text(name).html()}</span>
                        <span class="chat-time">${time}</span>
                    </div>
                    <p class="chat-preview">${jQuery_API('<div>').text(preview).html()}</p>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                <div class="delete-chat-history-btn" data-id="${id}" title="Clear chat history"><i class="fas fa-trash-alt"></i></div>
            </div>
        `;
        list.append(itemHtml);
    });
}

export function renderContactsView() {
    const listContent = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .contacts-list-content`).empty();
    const requests = PhoneSim_State.pendingFriendRequests || [];

    const pendingRequests = requests.filter(req => req.status === 'pending');
    if (pendingRequests.length > 0) {
        listContent.append('<div class="contact-group-header">New Friends</div>');
        pendingRequests.forEach(req => {
            const avatar = UI.generateDefaultAvatar(req.from_name);
            const itemHtml = `
                <div class="contact-item new-friend-request-item" data-uid="${req.uid}" data-from-id="${req.from_id}" data-from-name="${req.from_name}">
                    <img src="${avatar}" class="contact-item-avatar">
                    <div class="request-info">
                        <div class="contact-item-name">${req.from_name}</div>
                        <div class="request-message">${req.content}</div>
                    </div>
                    <div class="request-actions">
                        <button class="request-btn ignore-btn" data-action="ignore">Ignore</button>
                        <button class="request-btn accept-btn" data-action="accept">Accept</button>
                    </div>
                </div>`;
            listContent.append(itemHtml);
        });
    }
    
    const allContacts = Object.entries(PhoneSim_State.contacts)
        .filter(([id, c]) => id !== PhoneSim_Config.PLAYER_ID && !id.startsWith('group_') && c.profile)
        .map(([id, contact]) => ({
            id,
            name: contact.profile.note || contact.profile.nickname,
            avatar: contact.profile.avatar || UI.generateDefaultAvatar(contact.profile.note || contact.profile.nickname)
        }));

    allContacts.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

    const groupedContacts = allContacts.reduce((acc, contact) => {
        let firstLetter = contact.name.charAt(0).toUpperCase();
        if (!/^[A-Z]$/.test(firstLetter)) {
            firstLetter = '#';
        }
        if (!acc[firstLetter]) {
            acc[firstLetter] = [];
        }
        acc[firstLetter].push(contact);
        return acc;
    }, {});

    const sortedGroupKeys = Object.keys(groupedContacts).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
    });
    
    sortedGroupKeys.forEach(key => {
        listContent.append(`<div class="contact-group-header">${key}</div>`);
        groupedContacts[key].forEach(c => {
            const itemHtml = `
                <div class="contact-item" data-id="${c.id}">
                    <img src="${c.avatar}" class="contact-item-avatar">
                    <span class="contact-item-name">${c.name}</span>
                    <div class="delete-contact-btn" data-id="${c.id}" title="Delete contact"><i class="fas fa-trash-alt"></i></div>
                </div>`;
            listContent.append(itemHtml);
        });
    });
}

export function renderMeView() {
    const content = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .me-content`).empty();
    const { customization } = PhoneSim_State;

    const avatar = customization.playerAvatar || UI.generateDefaultAvatar(customization.playerNickname || 'Me');
    const nickname = customization.playerNickname || 'Me';
    const mockWeChatId = (nickname === 'Me' ? 'player' : nickname.toLowerCase().replace(/\s/g, '_')) + `_${Math.random().toString(36).substr(2, 4)}`;

    const meHtml = `
        <div class="me-profile-card">
            <img src="${avatar}" class="me-avatar">
            <div class="me-info">
                <h3 class="me-nickname">${nickname}</h3>
                <p class="me-id">WeChat ID: ${mockWeChatId}</p>
            </div>
        </div>
        
        <div class="settings-group" style="margin-top: 20px;">
             <div class="settings-item"><span><i class="fas fa-wallet fa-fw" style="color: #07c160; margin-right: 10px;"></i> Services</span><i class="fas fa-chevron-right"></i></div>
        </div>
        <div class="settings-group" style="margin-top: 8px;">
            <div class="settings-item"><span><i class="fas fa-star fa-fw" style="color: #ffc107; margin-right: 10px;"></i> Favorites</span><i class="fas fa-chevron-right"></i></div>
            <div class="settings-item" id="me-view-moments-link"><span><i class="fas fa-images fa-fw" style="color: #007aff; margin-right: 10px;"></i> Moments</span><i class="fas fa-chevron-right"></i></div>
            <div class="settings-item"><span><i class="fas fa-smile fa-fw" style="color: #ffc107; margin-right: 10px;"></i> Stickers</span><i class="fas fa-chevron-right"></i></div>
        </div>
        <div class="settings-group" style="margin-top: 8px;">
            <div class="settings-item" id="me-view-settings-link"><span><i class="fas fa-cog fa-fw" style="color: #007aff; margin-right: 10px;"></i> Settings</span><i class="fas fa-chevron-right"></i></div>
        </div>
    `;

    content.html(meHtml);

    // Add click handlers for navigation
    content.find('#me-view-settings-link').on('click.phonesim.meview', () => {
        UI.showView('SettingsApp');
    });
    content.find('#me-view-moments-link').on('click.phonesim.meview', () => {
        UI.showView('Moments');
    });
}

export function renderDiscoverView() { /* Placeholder */ }

function _buildMessagesHtml(messagesToRender, allMessages) {
    let html = '';
    let lastTimestamp = null;
    let lastReadMessageIndex = allMessages.findIndex(msg => msg.uid === PhoneSim_State.contacts[PhoneSim_State.activeContactId]?.lastReadMessageUid);

    messagesToRender.forEach(msg => {
        const currentTimestamp = new Date(msg.timestamp);

        if (!lastTimestamp || currentTimestamp - lastTimestamp > 10 * 60 * 1000) {
            html += `<div class="time-divider"><span>${UI.getDividerText(currentTimestamp)}</span></div>`;
        }

        if (msg.isSystemNotification) {
             html += UI.renderSystemMessage(msg);
        } else if (msg.requestData?.type === 'friend_request') {
            html += UI.renderInteractiveMessage(msg);
        } else {
            html += UI.renderSingleMessage(msg, PhoneSim_State.activeContactId.startsWith('group_'));
        }

        lastTimestamp = currentTimestamp;
    });

    return html;
}

export async function renderChatView(contactId, app, isAnimated = true) {
    if (isRendering) return;
    isRendering = true;

    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const chatView = p.find('#chatconversation-view');
    const messagesContainer = chatView.find('.chat-messages');

    PhoneSim_State.activeContactId = contactId;
    const contact = PhoneSim_State.contacts[contactId];

    if (!contact || !contact.profile) {
        messagesContainer.html('<div class="email-empty-state">Could not load conversation</div>');
        isRendering = false;
        return;
    }
    
    UI.hideReplyPreview();

    const isGroup = contactId.startsWith('group_');
    const name = isGroup ? contact.profile.groupName : (contact.profile.note || contact.profile.nickname);
    const avatar = contact.profile.avatar || UI.generateDefaultAvatar(name);

    chatView.find('.chat-name').text(name);
    const headerAvatar = chatView.find('.header-avatar');
    headerAvatar.attr('src', avatar).data('contact-id', contactId).addClass('clickable-avatar');

    chatView.find('.edit-note-btn').toggle(!isGroup);
    chatView.find('.header-status').toggle(!isGroup);
    
    // Restore group call functionality by always showing the members button and call button
    chatView.find('.members-btn').toggle(isGroup).data('group-id', contactId);
    chatView.find('.call-btn').show();


    const allMessages = [
        ...(contact.app_data?.WeChat?.messages || []),
        ...PhoneSim_State.stagedPlayerMessages.filter(msg => msg.contactId === contactId).map(m => m.tempMessageObject)
    ];

    messagesContainer.off('scroll.phonesim-lazyload');
    messagesContainer.empty();

    if (allMessages.length === 0) {
        isRendering = false;
        return;
    }
    
    let messagesToRender = allMessages;
    displayedMessageCount = allMessages.length;

    if (allMessages.length > INITIAL_MESSAGE_LOAD_COUNT) {
        messagesToRender = allMessages.slice(-INITIAL_MESSAGE_LOAD_COUNT);
        displayedMessageCount = INITIAL_MESSAGE_LOAD_COUNT;
        
        messagesContainer.on('scroll.phonesim-lazyload', UI.throttle(async () => {
            if (messagesContainer.scrollTop() === 0 && !isLoadingMore && displayedMessageCount < allMessages.length) {
                isLoadingMore = true;
                const loader = chatView.find('.chat-loader').show();
                const oldScrollHeight = messagesContainer[0].scrollHeight;

                await new Promise(resolve => setTimeout(resolve, 300));

                const nextBatchSize = Math.min(LOAD_MORE_COUNT, allMessages.length - displayedMessageCount);
                const nextMessagesToShow = allMessages.slice(-(displayedMessageCount + nextBatchSize), -displayedMessageCount);
                
                if (nextMessagesToShow.length > 0) {
                    const newHtml = _buildMessagesHtml(nextMessagesToShow, allMessages);
                    messagesContainer.prepend(newHtml);
                    const newScrollHeight = messagesContainer[0].scrollHeight;
                    messagesContainer.scrollTop(newScrollHeight - oldScrollHeight);
                    displayedMessageCount += nextBatchSize;
                }
                
                if (displayedMessageCount >= allMessages.length) {
                    messagesContainer.off('scroll.phonesim-lazyload');
                    loader.remove();
                } else {
                    loader.hide();
                }
                isLoadingMore = false;
            }
        }, 200));
    }
    
    const messagesHtml = _buildMessagesHtml(messagesToRender, allMessages);
    messagesContainer.html(messagesHtml);

    if (allMessages.length > INITIAL_MESSAGE_LOAD_COUNT) {
         messagesContainer.prepend('<div class="chat-loader" style="display: none;">Loading...</div>');
    }
    
    const lastMessage = allMessages[allMessages.length - 1];
    const shouldScroll = !lastMessage || lastMessage.sender_id === PhoneSim_Config.PLAYER_ID || (messagesContainer[0].scrollHeight - messagesContainer.scrollTop() - messagesContainer.height()) < 200;
    
    if (shouldScroll) {
         messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    }

    if (contact.unread > 0) {
        await DataHandler.resetUnreadCount(contactId);
        contact.unread = 0;
        await DataHandler.fetchAllContacts();
        UI.updateGlobalUnreadCounts();
    }
    
    isRendering = false;
}

export function triggerPendingAnimations(contactId) {
    if (!PhoneSim_State.pendingAnimations[contactId] || isAnimatingFlags[contactId]) {
        return;
    }

    isAnimatingFlags[contactId] = true;
    const queue = [...PhoneSim_State.pendingAnimations[contactId]];
    PhoneSim_State.pendingAnimations[contactId] = [];

    const processNext = () => {
        if (queue.length === 0) {
            isAnimatingFlags[contactId] = false;
            return;
        }

        const uid = queue.shift();
        const messageEl = jQuery_API(parentWin.document.body).find(`.message[data-uid="${uid}"]`);

        if (messageEl.length) {
            const typingIndicatorHtml = `<div class="message received typing-indicator-wrapper" data-uid="typing-${uid}">
                <div class="avatar-container">${messageEl.find('.avatar-container').html()}</div>
                <div class="message-wrapper">
                    ${messageEl.find('.sender-name').length > 0 ? `<div class="sender-name">${messageEl.find('.sender-name').html()}</div>` : ''}
                    <div class="message-content">
                        <div class="typing-indicator"><span></span><span></span><span></span></div>
                    </div>
                </div>
            </div>`;
            
            messageEl.hide();
            messageEl.before(typingIndicatorHtml);
            const typingIndicator = messageEl.prev();
            const messagesContainer = messageEl.closest('.chat-messages');
            messagesContainer.scrollTop(messagesContainer[0].scrollHeight);

            setTimeout(() => {
                typingIndicator.remove();
                messageEl.show();
                messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
                PhoneSim_Sounds.play('receive');
                processNext();
            }, 1000 + Math.random() * 1500);
        } else {
            processNext();
        }
    };

    processNext();
}

export function renderStickerPicker() {
    const grid = jQuery_API(parentWin.document.body).find('#sticker-picker-grid');
    if (!grid.length || grid.children().length > 0) return;

    const placeholderSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    const stickerHtml = stickers.map(sticker => `
        <div class="sticker-item" data-file="${sticker.file}" data-name="${sticker.name}" title="${sticker.name}">
            <img src="${placeholderSrc}" data-src="https://files.catbox.moe/${sticker.file}" alt="${sticker.name}">
        </div>
    `).join('');
    
    grid.html(stickerHtml);
}
