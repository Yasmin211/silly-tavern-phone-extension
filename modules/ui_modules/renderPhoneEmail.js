

import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, UI, DataHandler;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    UI = uiObject;
    DataHandler = dataHandler;
}

export function renderPhoneContactList() {
    const list = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .phone-contact-list`).empty();
    const sortedContacts = Object.entries(PhoneSim_State.contacts)
        .filter(([id, c]) => id !== 'PLAYER_USER' && !id.startsWith('group_') && c.profile)
        .sort(([, a], [, b]) => (a.profile.note || a.profile.nickname).localeCompare(b.profile.note || b.profile.nickname, 'zh-Hans-CN'));

    for (const [id, c] of sortedContacts) {
        const name = c.profile.note || c.profile.nickname;
        const avatar = c.profile.avatar || UI.generateDefaultAvatar(name);
        const itemHtml = `
            <div class="phone-contact-item" data-id="${id}">
                <img src="${avatar}" class="phone-contact-avatar clickable-avatar" data-contact-id="${id}">
                <span class="phone-contact-name clickable-avatar" data-contact-id="${id}">${name}</span>
                <div class="phone-contact-delete-btn" data-id="${id}" title="Delete contact"><i class="fas fa-trash-alt"></i></div>
                <div class="phone-contact-call-btn"><i class="fas fa-phone"></i></div>
            </div>`;
        list.append(itemHtml);
    }
}

export function renderCallLogView() {
    const list = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .call-log-list`).empty();
    const callLogs = PhoneSim_State.callLogs;

    if (callLogs.length === 0) {
        list.html('<div class="email-empty-state">No call history</div>');
        return;
    }

    callLogs.forEach(log => {
        const name = UI._getContactName(log.contactId);
        const callTypeIcon = log.callType === 'wechat' 
            ? '<i class="fab fa-weixin" style="color: #07c160;"></i>'
            : '<i class="fas fa-phone-alt"></i>';

        const itemHtml = `
            <div class="call-log-item" data-id="${log.timestamp}">
                <div class="call-log-icon">
                    <i class="fas fa-arrow-left" style="color: #07c160;"></i>
                </div>
                <div class="call-log-info">
                    <div class="call-log-name">${name}</div>
                    <div class="call-log-meta">
                        ${callTypeIcon}
                        <span>${log.duration}</span>
                    </div>
                </div>
                <div class="call-log-time">
                    ${new Date(log.timestamp).toLocaleDateString()}
                </div>
                 <div class="delete-item-btn" title="Delete record"><i class="fas fa-trash-alt"></i></div>
            </div>
        `;
        list.append(itemHtml);
    });
}


export function renderEmailList() {
    const view = jQuery_API(parentWin.document.body).find('#emailapp-view');
    const emailList = view.find('.email-list-content').empty();
    const emails = PhoneSim_State.emails.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (emails.length === 0) { emailList.html('<div class="email-empty-state">No emails</div>'); return; }

    emails.forEach(email => {
        const sender = PhoneSim_State.contacts[email.from_id] || { profile: { nickname: email.from_name } };
        const avatar = sender.profile.avatar || UI.generateDefaultAvatar(email.from_name);
        const itemHtml = `
            <div class="email-item ${!email.read ? 'unread' : ''}" data-id="${email.id}">
                <img src="${avatar}" class="email-avatar"/>
                <div class="email-info">
                    <div class="email-sender">${email.from_name}</div>
                    <div class="email-subject">${email.subject}</div>
                    <div class="email-preview">${(email.content || '').substring(0, 50)}...</div>
                </div>
                <div class="email-time">${new Date(email.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                <div class="delete-item-btn" title="Delete email"><i class="fas fa-trash-alt"></i></div>
            </div>`;
        emailList.append(itemHtml);
    });
}

export function renderEmailDetail(emailId) {
    const detailView = jQuery_API(parentWin.document.body).find('#emaildetail-view');
    const header = detailView.find('.app-header');
    const scrollContent = detailView.find('.email-detail-scroll-content').empty();
    const actions = detailView.find('.email-actions').empty();

    const email = PhoneSim_State.emails.find(e => e.id === emailId);
    if (!email) {
        scrollContent.html('<div>Email not found</div>');
        header.find('#delete-email-btn').remove();
        return;
    }
    
    if (header.find('#delete-email-btn').length === 0) {
        header.append('<div class="header-actions" id="delete-email-btn" title="Delete email"><i class="fas fa-trash"></i></div>');
    }


    if (!email.read) {
        (async () => {
            await DataHandler.markEmailAsRead(emailId);
            await DataHandler.fetchAllEmails();
            UI.updateGlobalUnreadCounts();
        })();
    }

    const sender = PhoneSim_State.contacts[email.from_id] || { profile: { nickname: email.from_name } };
    const avatar = sender.profile.avatar || UI.generateDefaultAvatar(email.from_name);
    const formattedContent = (email.content || '').replace(/\\n/g, '<br>');

    const attachmentHtml = email.attachment ? `
        <div class="email-attachment">
            <div class="attachment-title"><i class="fas fa-paperclip"></i> Attachment</div>
            <div class="attachment-item" data-name="${email.attachment.name}">
                <div class="attachment-icon"><i class="fas fa-file"></i></div>
                <div class="attachment-info">
                    <div class="attachment-name">${email.attachment.name}</div>
                    <div class="attachment-meta">${email.attachment.description || ''}</div>
                </div>
            </div>
        </div>` : '';

    const detailContentHtml = `
        <div class="email-detail-header-new">
            <div class="email-detail-title">${email.subject}</div>
            <div class="email-detail-info">
                <div class="email-detail-sender">
                    <img class="sender-avatar" src="${avatar}">
                    <div>
                        <div style="font-weight: bold; color: #333;">${email.from_name}</div>
                        <div>${email.from_id}</div>
                    </div>
                </div>
                <div>${new Date(email.timestamp).toLocaleString()}</div>
            </div>
        </div>
        <div class="email-detail-body">${formattedContent}</div>
        ${attachmentHtml}
    `;
    scrollContent.html(detailContentHtml);
    
    const actionsHtml = `
        <button class="action-button reply-button" data-sender-name="${email.from_name}"><i class="fas fa-reply"></i>Reply</button>
        ${email.attachment ? '<button class="action-button accept-button"><i class="fas fa-check"></i>Accept</button>' : ''}
    `;
    actions.html(actionsHtml);
}
