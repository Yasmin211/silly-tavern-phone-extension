
import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, UI;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    UI = uiObject;
}

export function renderGroupMembersView(groupId) {
    const list = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .group-members-list`).empty();
    const group = PhoneSim_State.contacts[groupId];

    if (!group || !group.profile || !group.profile.members) {
        return;
    }

    // Add invite button at the top
    list.append(`<div class="group-invite-btn-item"><i class="fas fa-plus"></i> Invite</div>`);

    const members = [...group.profile.members, PhoneSim_Config.PLAYER_ID];
    members.forEach(memberId => {
        const member = PhoneSim_State.contacts[memberId];
        const isPlayer = memberId === PhoneSim_Config.PLAYER_ID;
        const name = isPlayer ? 'Me' : (member?.profile?.note || member?.profile?.nickname || memberId);
        const avatar = isPlayer ? (PhoneSim_State.customization.playerAvatar || UI.generateDefaultAvatar('Me')) : (member?.profile?.avatar || UI.generateDefaultAvatar(name));
        
        const kickButtonHtml = !isPlayer
            ? `<div class="group-member-action"><button class="kick-btn">Remove</button></div>`
            : '';

        const itemHtml = `
            <div class="group-member-item" data-member-id="${memberId}">
                <img src="${avatar}" class="group-member-avatar">
                <span class="group-member-name">${name}</span>
                ${kickButtonHtml}
            </div>
        `;
        list.append(itemHtml);
    });
}

export function renderGroupInviteView(groupId) {
    const list = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .invite-contact-list`).empty();
    const group = PhoneSim_State.contacts[groupId];
    const existingMembers = group?.profile?.members || [];

    const potentialInvites = Object.entries(PhoneSim_State.contacts)
        .filter(([id, contact]) => 
            !id.startsWith('group_') && 
            id !== PhoneSim_Config.PLAYER_ID && 
            !existingMembers.includes(id) &&
            contact.profile
        )
        .sort(([, a], [, b]) => (a.profile.note || a.profile.nickname).localeCompare(b.profile.note || b.profile.nickname, 'zh-Hans-CN'));
    
    potentialInvites.forEach(([id, contact]) => {
        const name = contact.profile.note || contact.profile.nickname;
        const avatar = contact.profile.avatar || UI.generateDefaultAvatar(name);
        const itemHtml = `
            <div class="invite-contact-item" data-contact-id="${id}">
                <div class="checkbox"><i class="fas fa-check"></i></div>
                <img src="${avatar}" class="invite-contact-avatar">
                <span class="invite-contact-name">${name}</span>
            </div>
        `;
        list.append(itemHtml);
    });
}

export function renderGroupCreationView() {
    const list = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .group-creation-contact-list`).empty();
    const confirmBtn = jQuery_API(parentWin.document.body).find('#confirm-group-creation-btn');
    
    const potentialMembers = Object.entries(PhoneSim_State.contacts)
        .filter(([id, contact]) => 
            !id.startsWith('group_') && 
            id !== PhoneSim_Config.PLAYER_ID && 
            contact.profile
        )
        .sort(([, a], [, b]) => (a.profile.note || a.profile.nickname).localeCompare(b.profile.note || b.profile.nickname, 'zh-Hans-CN'));

    if (potentialMembers.length === 0) {
        list.html('<div class="email-empty-state">No contacts to invite</div>');
        confirmBtn.prop('disabled', true).text('Done(0)');
        return;
    }
    
    potentialMembers.forEach(([id, contact]) => {
        const name = contact.profile.note || contact.profile.nickname;
        const avatar = contact.profile.avatar || UI.generateDefaultAvatar(name);
        const itemHtml = `
            <div class="group-creation-contact-item" data-contact-id="${id}">
                <div class="checkbox"><i class="fas fa-check"></i></div>
                <img src="${avatar}" class="group-creation-contact-avatar">
                <span class="group-creation-contact-name">${name}</span>
            </div>
        `;
        list.append(itemHtml);
    });

    confirmBtn.prop('disabled', true).text('Done(0)');
}
