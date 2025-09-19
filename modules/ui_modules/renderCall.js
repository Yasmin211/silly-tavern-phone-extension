

import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, SillyTavern_Context_API, UI;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    SillyTavern_Context_API = deps.st_context;
    UI = uiObject;
}

export function showRingingModal(contact) {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const modal = p.find('.voice-call-modal');
    modal.find('.caller-avatar').attr('src', contact.profile.avatar || UI.generateDefaultAvatar(contact.profile.note || contact.profile.nickname));
    modal.find('.caller-name').text(contact.profile.note || contact.profile.nickname);
    modal.show();
    if(!PhoneSim_State.customization.isMuted) {
        const audio = modal.find('.voice-call-audio')[0];
        if (audio) {
            audio.play().catch(e => console.error("Ringtone failed", e));
        }
    }
}

export function showVoiceCall(callData) {
    PhoneSim_State.isVoiceCallActive = true;
    PhoneSim_State.activeCallData = callData;
    PhoneSim_State.isCallRecording = false; // Reset recording state
    UI.showView('VoiceCall');
    const callView = jQuery_API(parentWin.document.body).find('#voicecall-view');
    const contact = PhoneSim_State.contacts[callData.id] || { profile: { nickname: callData.name } };
    const avatarUrl = contact.profile.avatar || UI.generateDefaultAvatar(callData.name);

    const callHtml = `
        <div class="call-ui-internal">
            <div class="call-background"></div>
            <div class="call-header-info">
                <div class="caller-name-small">${callData.name}</div>
                <div class="call-timer" id="call-timer">00:00</div>
            </div>
            <div class="caller-avatar-main-container">
                <img src="${avatarUrl}" class="caller-avatar-main"/>
            </div>
            <div class="conversation-box"><div class="conversation-scroll"><p>${jQuery_API('<div>').text(callData.content).html()}</p></div></div>
            <div class="call-controls">
                <button class="control-button record-call-btn" title="Record"><i class="fas fa-dot-circle"></i></button>
                <button class="control-button voice-input-btn" title="Speak"><i class="fas fa-microphone"></i></button>
                <button class="control-button end-call" title="Hang Up"><i class="fas fa-phone"></i></button>
            </div>
        </div>`;
    callView.html(callHtml);

    let seconds = 0;
    const timerInterval = setInterval(() => { 
        seconds++; 
        const m = Math.floor(seconds / 60).toString().padStart(2,'0'); 
        const s = (seconds % 60).toString().padStart(2,'0'); 
        const timerEl = callView.find('#call-timer')[0];
        if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
    callView.data('timerInterval', timerInterval);
}

export function updateVoiceCall(callData) {
    const callView = jQuery_API(parentWin.document.body).find('#voicecall-view');
    if (!callView.length || !PhoneSim_State.isVoiceCallActive) { this.showVoiceCall(callData); return; }
    PhoneSim_State.activeCallData = callData;
    const convoScroll = callView.find('.conversation-scroll');
    convoScroll.append(`<p>${jQuery_API('<div>').text(callData.content).html()}</p>`);
    convoScroll.parent().scrollTop(convoScroll.height());
}

export function showPhoneCall(callData) {
    PhoneSim_State.isPhoneCallActive = true;
    PhoneSim_State.activePhoneCallData = callData;
    PhoneSim_State.isCallRecording = false; // Reset recording state
    UI.showView('PhoneCall');
    const callView = jQuery_API(parentWin.document.body).find('#phonecall-view');
    const contactName = UI._getContactName(callData.id);
    
    const callHtml = `
        <div class="call-ui-internal">
             <div class="caller-info-top">
                <div class="caller-name-large">${contactName}</div>
                <div class="call-timer" id="call-timer">00:00</div>
            </div>
            <div class="conversation-box"><div class="conversation-scroll"><p>${jQuery_API('<div>').text(callData.content).html()}</p></div></div>
            <div class="call-controls">
                <button class="control-button record-call-btn" title="Record"><i class="fas fa-dot-circle"></i></button>
                <button class="control-button voice-input-btn" title="Speak"><i class="fas fa-microphone"></i></button>
                <button class="control-button end-call" title="Hang Up"><i class="fas fa-phone"></i></button>
            </div>
        </div>`;
    callView.html(callHtml);

    let seconds = 0;
    const timerInterval = setInterval(() => { 
        seconds++; 
        const m = Math.floor(seconds / 60).toString().padStart(2,'0'); 
        const s = (seconds % 60).toString().padStart(2,'0'); 
        const timerEl = callView.find('#call-timer')[0];
        if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
    callView.data('timerInterval', timerInterval);
}

export function updatePhoneCall(callData) {
    const callView = jQuery_API(parentWin.document.body).find('#phonecall-view');
    if (!callView.length || !PhoneSim_State.isPhoneCallActive) { this.showPhoneCall(callData); return; }
    PhoneSim_State.activePhoneCallData = callData;
    const convoScroll = callView.find('.conversation-scroll');
    convoScroll.append(`<p>${jQuery_API('<div>').text(callData.content).html()}</p>`);
    convoScroll.parent().scrollTop(convoScroll.height());
}

export function closeCallUI() {
    if(SillyTavern_Context_API) SillyTavern_Context_API.activateSendButtons();
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const modal = p.find('.voice-call-modal');
    modal.hide();
    const audio = modal.find('.voice-call-audio')[0];
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    PhoneSim_State.incomingCallData = null;
    
    if (PhoneSim_State.isVoiceCallActive) {
        const callView = p.find('#voicecall-view');
        clearInterval(callView.data('timerInterval'));
        callView.empty();
        UI.showView('ChatConversation', PhoneSim_State.activeCallData.id);
        PhoneSim_State.isVoiceCallActive = false;
        PhoneSim_State.activeCallData = null;
        PhoneSim_State.isCallRecording = false;
    }
    if (PhoneSim_State.isPhoneCallActive) {
        const callView = p.find('#phonecall-view');
        clearInterval(callView.data('timerInterval'));
        callView.empty();
        UI.showView('PhoneApp');
        PhoneSim_State.isPhoneCallActive = false;
        PhoneSim_State.activePhoneCallData = null;
        PhoneSim_State.isCallRecording = false;
    }
}
