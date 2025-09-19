

import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';
import { PhoneSim_Sounds } from '../sounds.js';

let jQuery_API, parentWin, SillyTavern_API, TavernHelper_API, UI, DataHandler;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    SillyTavern_API = deps.st;
    TavernHelper_API = deps.th;
    UI = uiObject;
    DataHandler = dataHandler;
}

export function addEventListeners() {
    const b = jQuery_API(parentWin.document.body);
    const p = b.find(`#${PhoneSim_Config.PANEL_ID}`);
    const fileInput = b.find('#phone-sim-file-input');
    
    fileInput.on('change.phonesim', async (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const compressedData = await UI.compressImage(e.target.result);
                if (UI.fileUploadCallback) UI.fileUploadCallback(compressedData);
            };
            reader.readAsDataURL(file);
        }
        fileInput.val('');
    });

    b.on('click.phonesim', `#${PhoneSim_Config.TOGGLE_BUTTON_ID}`, () => { PhoneSim_Sounds.play('tap'); UI.togglePanel(); });
    b.on('click.phonesim', `#${PhoneSim_Config.COMMIT_BUTTON_ID}`, () => { PhoneSim_Sounds.play('send'); DataHandler.commitStagedActions(); });
    
    // --- GLOBAL CLICK-OFF HANDLER (for closing menus and emoji picker) ---
    b.on('click.phonesim-global', function(e) {
        const target = jQuery_API(e.target);
        const panel = target.closest(`#${PhoneSim_Config.PANEL_ID}`);
        
        // If click is inside the panel
        if (panel.length > 0) {
            // Close emoji picker if click is outside of it and its button
            if (p.find('.emoji-picker-container').is(':visible') && !target.closest('.emoji-picker-container, .emoji-btn').length) {
                p.find('.emoji-picker-container').hide();
            }
            // Close menus if click is outside of them and their triggers
            if (!target.closest('.phone-sim-menu, #chat-list-actions-btn, #add-chat-btn, #moments-actions-btn, .message-actions, .moment-actions-trigger, .forum-actions-trigger').length) {
                p.find('.phone-sim-menu').hide();
            }
        } else { // If click is outside the panel, close everything
            p.find('.phone-sim-menu').hide();
            p.find('.emoji-picker-container').hide();
        }
    });


    // --- GENERIC NAVIGATION & SYSTEM ---
    p.on('click.phonesim', '.app-block', function() { PhoneSim_Sounds.play('open'); const viewId = jQuery_API(this).data('view'); const rect = this.getBoundingClientRect(); const panelRect = p[0].getBoundingClientRect(); const originX = rect.left - panelRect.left + rect.width / 2; const originY = rect.top - panelRect.top + rect.height / 2; UI.showView(viewId, { animationOrigin: { x: originX, y: originY } }); });
    p.on('click.phonesim', '.back-to-home-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('HomeScreen'); });
    p.on('click.phonesim', '#emaildetail-view .back-to-email-list-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('EmailApp'); });
    p.on('click.phonesim', '.back-to-board-list-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('ForumApp'); });
    p.on('click.phonesim', '.back-to-post-list-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('ForumPostList', PhoneSim_State.activeForumBoardId); });
    p.on('click.phonesim', '.back-to-livecenter-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('LiveCenterApp'); });
    p.on('click.phonesim', '.back-to-livestreamlist-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('LiveStreamList', PhoneSim_State.activeLiveBoardId); });
    
    // --- PHONE & EMAIL APPS ---
    p.on('click.phonesim', '.phone-contact-item .clickable-avatar', function() { PhoneSim_Sounds.play('tap'); const contactId = jQuery_API(this).data('contact-id'); UI.showView('Homepage', contactId); });
    p.on('click.phonesim', '.phone-contact-call-btn', function() { PhoneSim_Sounds.play('tap'); DataHandler.initiatePhoneCall({id: jQuery_API(this).closest('.phone-contact-item').data('id'), name: jQuery_API(this).siblings('.phone-contact-name').text()}); });
    p.on('click.phonesim', '#emailapp-view .email-item', function() { PhoneSim_Sounds.play('tap'); UI.showView('EmailDetail', jQuery_API(this).data('id')); });
    p.on('click.phonesim', '.phoneapp-bottom-nav .nav-item', function() { const item = jQuery_API(this); if (item.hasClass('active')) return; PhoneSim_Sounds.play('tap'); const target = item.data('target'); p.find('.phoneapp-bottom-nav .nav-item').removeClass('active'); item.addClass('active'); const wrapper = p.find('#phoneapp-view .subview-wrapper'); wrapper.find('.subview').removeClass('active'); wrapper.find(`.phone-${target}-subview`).addClass('active'); PhoneSim_State.activeSubviews.phoneapp = target; PhoneSim_State.saveUiState(); });
    const dialerDisplay = p.find('.dialer-display');
    p.on('click.phonesim', '.dial-key', function() { PhoneSim_Sounds.play('tap'); dialerDisplay.val(dialerDisplay.val() + jQuery_API(this).data('key')); });
    p.on('click.phonesim', '.dialer-backspace', function() { PhoneSim_Sounds.play('tap'); dialerDisplay.val(dialerDisplay.val().slice(0, -1)); });
    p.on('click.phonesim', '.dial-call-btn', function() { PhoneSim_Sounds.play('open'); const number = dialerDisplay.val(); if (!number) return; const contact = Object.entries(PhoneSim_State.contacts).find(([id, c]) => id === number); const callTarget = contact ? { id: contact[0], name: contact[1].profile.note || contact[1].profile.nickname } : { id: number, name: number }; DataHandler.initiatePhoneCall(callTarget); });
    
    // --- BROWSER APP ---
    // Browser event listeners are complex and numerous, kept separate in wechat_events for now.
    
    // --- FORUM & LIVE CENTER APPS ---
    p.on('click.phonesim', '.forum-board-item', function() { PhoneSim_Sounds.play('tap'); UI.showView('ForumPostList', jQuery_API(this).data('board-id')); });
    p.on('click.phonesim', '.forum-post-item', function() { PhoneSim_Sounds.play('open'); UI.showView('ForumPostDetail', jQuery_API(this).data('post-id')); });
    p.on('click.phonesim', '.live-board-item', function() { PhoneSim_Sounds.play('tap'); UI.showView('LiveStreamList', jQuery_API(this).data('board-id')); });
    p.on('click.phonesim', '.live-stream-item', async function() { PhoneSim_Sounds.play('open'); const streamerId = String(jQuery_API(this).data('streamer-id')); UI.showView('LiveStreamRoom', streamerId); const stream = DataHandler.findLiveStreamById(streamerId); if (stream) { const prompt = `(System prompt: {{user}} entered ${stream.streamerName}'s stream room "${stream.title}", please generate the current live content and comments.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_API.generate(); } else { console.error(`[Phone Sim] Could not find stream data for streamerId: ${streamerId}`); } });
    const handleSearch = async (inputElement) => { const input = jQuery_API(inputElement); const searchTerm = input.val().trim(); if (!searchTerm) return; PhoneSim_Sounds.play('send'); let prompt = ''; const view = input.closest('.view'); if (view.is('#forumpostlist-view')) { const boardName = view.find('.app-header h3').text(); prompt = `(System prompt: {{user}} searched in the "${boardName}" board of the forum for: "${searchTerm}". Please generate a list of relevant posts.)`; view.find('.forum-post-list-content').html(UI.getPostListSkeleton()); } else if (view.is('#livestreamlist-view')) { const boardName = view.find('.app-header h3').text(); prompt = `(System prompt: {{user}} searched in the "${boardName}" board of the live center for: "${searchTerm}". Please generate a list of relevant streams.)`; view.find('.live-stream-list-content').html(UI.getStreamListSkeleton()); } if (prompt) { await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_API.generate(); input.val(''); } };
    p.on('keydown.phonesim', '.search-input', function(e) { if (e.key === 'Enter') { handleSearch(this); } });
    p.on('click.phonesim', '.search-send-btn', function() { handleSearch(jQuery_API(this).siblings('.search-input')); });
    p.on('click.phonesim', '.generate-content-btn', async function(e) { e.stopPropagation(); PhoneSim_Sounds.play('send'); const btn = jQuery_API(this); const type = btn.data('type'); const boardId = btn.data('board-id'); const boardName = btn.data('board-name'); let prompt = ''; let viewId, skeletonLoader, contentSelector; if (type === 'forum') { prompt = `(System prompt: {{user}} requested to generate a new post list for the "${boardName}" board in the forum.)`; viewId = 'ForumPostList'; skeletonLoader = UI.getPostListSkeleton; contentSelector = '.forum-post-list-content'; } else if (type === 'live') { prompt = `(System prompt: {{user}} requested to generate a new stream list for the "${boardName}" board in the live center.)`; viewId = 'LiveStreamList'; skeletonLoader = UI.getStreamListSkeleton; contentSelector = '.live-stream-list-content'; } if (prompt) { UI.showView(viewId, boardId); setTimeout(() => { p.find(`#${viewId.toLowerCase()}-view`).find(contentSelector).html(skeletonLoader()); }, 50); await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_API.generate(); } });
    const sendForumReply = () => { const input = p.find('.forum-reply-input'); const content = input.val().trim(); if (content && PhoneSim_State.activeForumPostId) { PhoneSim_Sounds.play('send'); DataHandler.stagePlayerAction({ type: 'new_forum_reply', postId: PhoneSim_State.activeForumPostId, content: content, replyId: 'staged_reply_' + Date.now() }); input.val(''); } };
    p.on('click.phonesim', '.forum-reply-send-btn', sendForumReply);
    p.on('keypress.phonesim', '.forum-reply-input', function(e) { if (e.key === 'Enter') { sendForumReply(); } });
    p.on('click.phonesim', '.post-like-btn', function() { PhoneSim_Sounds.play('tap'); const postId = jQuery_API(this).data('post-id'); DataHandler.stagePlayerAction({ type: 'like_forum_post', postId }); });
    p.on('click.phonesim', '.phone-sim-menu .menu-item', async function() { const action = jQuery_API(this).data('action'); if (!['delete_forum_post', 'delete_forum_reply'].includes(action)) return; PhoneSim_Sounds.play('tap'); const menu = jQuery_API(this).parent(); const { postId, replyId } = menu.data(); menu.hide(); if (postId || replyId) { if (action === 'delete_forum_post') { if (await SillyTavern_API.callGenericPopup('Are you sure you want to delete this post?', 'confirm')) { DataHandler.stagePlayerAction({ type: 'delete_forum_post', postId }); } } else if (action === 'delete_forum_reply') { if (await SillyTavern_API.callGenericPopup('Are you sure you want to delete this reply?', 'confirm')) { DataHandler.stagePlayerAction({ type: 'delete_forum_reply', replyId }); } } } });

    // --- SETTINGS APP ---
    p.on('click.phonesim', '#mute-switch', function(){ const isActive = jQuery_API(this).toggleClass('active').hasClass('active'); PhoneSim_State.customization.isMuted = isActive; DataHandler.saveCustomization(); PhoneSim_Sounds.play('toggle'); });
    p.on('click.phonesim', '#change-my-nickname', async () => { PhoneSim_Sounds.play('tap'); const newName = await UI.showDialog('Set My Nickname', PhoneSim_State.customization.playerNickname); if (newName !== null && newName.trim()) { await DataHandler.savePlayerNickname(newName.trim()); } });
    p.on('click.phonesim', '#upload-player-avatar', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('playerAvatar'); });
    p.on('click.phonesim', '#upload-homescreen-wallpaper', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('homescreenWallpaper'); });
    p.on('click.phonesim', '#upload-chatlist-wallpaper', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('chatListWallpaper'); });
    p.on('click.phonesim', '#upload-chatview-wallpaper', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('chatViewWallpaper'); });
    p.on('click.phonesim', '#reset-ui-position', () => { PhoneSim_Sounds.play('tap'); UI.resetUIPosition(); });
    p.on('click.phonesim', '#reset-all-data', async () => { PhoneSim_Sounds.play('tap'); const result = await SillyTavern_API.callGenericPopup('Are you sure you want to reset all phone data? This action is irreversible and will delete all related lorebook files.', 'confirm'); if (result) { await DataHandler.resetAllData(); await DataHandler.fetchAllData(); UI.rerenderCurrentView({ forceRerender: true }); } });

    // --- CALLS & MISC ---
    p.on('click.phonesim', '.reject-call', async () => { PhoneSim_Sounds.play('close'); SillyTavern_API.stopGeneration(); if (PhoneSim_State.incomingCallData) { const prompt = `(System prompt: {{user}} rejected the call from ${PhoneSim_State.incomingCallData.name}.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_API.generate(); } UI.closeCallUI(); });
    p.on('click.phonesim', '.accept-call', async () => { PhoneSim_Sounds.play('open'); if (!PhoneSim_State.incomingCallData) return; const name = PhoneSim_State.incomingCallData.name; p.find('.voice-call-modal').hide().find('audio')[0].pause(); const prompt = `(System prompt: {{user}} answered the call from ${name}.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_API.generate(); PhoneSim_State.incomingCallData = null; });
    p.on('click.phonesim', '.call-ui-internal .voice-input-btn', function(){ PhoneSim_Sounds.play('tap'); jQuery_API(parentWin.document.body).find('#phone-sim-call-input-overlay').show().find('textarea').focus(); });
    b.on('click.phonesim', '#phone-sim-call-input-cancel', function(){ PhoneSim_Sounds.play('tap'); jQuery_API(this).closest('.phone-sim-dialog-overlay').hide(); });
    b.on('click.phonesim', '#phone-sim-call-input-confirm', async function(){ PhoneSim_Sounds.play('send'); const modal = jQuery_API(this).closest('.phone-sim-dialog-overlay'); const textarea = modal.find('textarea'); const content = textarea.val().trim(); textarea.val(''); modal.hide(); if (content) { const isVoiceCall = PhoneSim_State.isVoiceCallActive; const callData = isVoiceCall ? PhoneSim_State.activeCallData : PhoneSim_State.activePhoneCallData; if (callData) { const contactName = UI._getContactName(callData.id); const callType = isVoiceCall ? 'Voice Call' : 'Phone Call'; const prompt = `(System prompt: {{user}} said in the ${callType} with ${contactName}: "${content}".)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_API.generate(); } } });
    UI.makeDraggable(p);
    jQuery_API(parentWin).on('resize.phonesim', () => UI.updateScaleAndPosition());
}
