
import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';
import { PhoneSim_Sounds } from '../sounds.js';

let jQuery_API, parentWin, SillyTavern_Context_API, TavernHelper_API, UI, DataHandler;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    SillyTavern_Context_API = deps.st_context;
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
        if (!p.is(':visible')) return;
        const isInsidePanel = target.closest(`#${PhoneSim_Config.PANEL_ID}`).length > 0;
        
        if (isInsidePanel) {
            const richMediaPanel = p.find('.rich-media-panel');
            if (richMediaPanel.is(':visible') && !target.closest('.rich-media-panel, .emoji-btn').length) {
                richMediaPanel.hide();
            }
             if (!target.closest('.phone-sim-menu, #chat-list-actions-btn, #add-chat-btn, #moments-actions-btn, .message-actions, .moment-actions-trigger, .forum-actions-trigger, .rich-message.transfer-message.unclaimed, .rich-media-btn, #manage-forum-btn, #manage-livecenter-btn').length) {
                p.find('.phone-sim-menu').hide();
            }
             if (p.find('#phone-sim-moments-notify-modal').is(':visible') && !target.closest('.phone-sim-notify-modal-content').length) {
                p.find('#phone-sim-moments-notify-modal').hide();
            }
        } else { // If click is outside the panel, close everything
            p.find('.phone-sim-menu, .rich-media-panel, #phone-sim-moments-notify-modal').hide();
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
    p.on('click.phonesim', '.phone-contact-delete-btn', async function(e) {
        e.stopPropagation();
        PhoneSim_Sounds.play('tap');
        const id = jQuery_API(this).closest('.phone-contact-item').data('id');
        const contactName = jQuery_API(this).siblings('.phone-contact-name').text();
        if (await SillyTavern_Context_API.callGenericPopup(`Are you sure you want to delete the contact ${contactName}? This will also delete all chat history.`, 'confirm')) {
            await DataHandler.deleteContact(id);
            UI.renderPhoneContactList();
            UI.renderContactsView();
        }
    });
    p.on('click.phonesim', '.email-item', function(e) { if(jQuery_API(e.target).closest('.delete-item-btn').length) return; PhoneSim_Sounds.play('tap'); UI.showView('EmailDetail', jQuery_API(this).data('id')); });
    p.on('click.phonesim', '.phoneapp-bottom-nav .nav-item', function() { const item = jQuery_API(this); if (item.hasClass('active')) return; PhoneSim_Sounds.play('tap'); const target = item.data('target'); p.find('.phoneapp-bottom-nav .nav-item').removeClass('active'); item.addClass('active'); const wrapper = p.find('#phoneapp-view .subview-wrapper'); wrapper.find('.subview').removeClass('active'); wrapper.find(`.phone-${target}-subview`).addClass('active'); PhoneSim_State.activeSubviews.phoneapp = target; PhoneSim_State.saveUiState(); });
    const dialerDisplay = p.find('.dialer-display');
    p.on('click.phonesim', '.dial-key', function() { PhoneSim_Sounds.play('tap'); dialerDisplay.val(dialerDisplay.val() + jQuery_API(this).data('key')); });
    p.on('click.phonesim', '.dialer-backspace', function() { PhoneSim_Sounds.play('tap'); dialerDisplay.val(dialerDisplay.val().slice(0, -1)); });
    p.on('click.phonesim', '.dial-call-btn', function() { PhoneSim_Sounds.play('open'); const number = dialerDisplay.val(); if (!number) return; const contact = Object.entries(PhoneSim_State.contacts).find(([id, c]) => id === number); const callTarget = contact ? { id: contact[0], name: contact[1].profile.note || contact[1].profile.nickname } : { id: number, name: number }; DataHandler.initiatePhoneCall(callTarget); });
    p.on('click.phonesim', '#emaildetail-view .reply-button', async function() { PhoneSim_Sounds.play('tap'); const senderName = jQuery_API(this).data('sender-name'); const replyContent = await UI.showDialog(`Reply to ${senderName}`); if (replyContent) { const prompt = `(System prompt: {{user}} replied to ${senderName}'s email: "${replyContent}")`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); UI.showView('EmailApp'); } });
    p.on('click.phonesim', '#emaildetail-view .accept-button', async function() { PhoneSim_Sounds.play('open'); const emailId = PhoneSim_State.activeEmailId; const email = PhoneSim_State.emails.find(e => e.id === emailId); if (email && email.attachment) { const prompt = `(System prompt: {{user}} accepted the attachment "${email.attachment.name}" from the email "${email.subject}".)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); SillyTavern_Context_API.callGenericPopup(`Attachment accepted: ${email.attachment.name}`, 'text'); } });
    p.on('click.phonesim', '#emailapp-view .delete-item-btn', async function(e) { e.stopPropagation(); if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this email?', 'confirm')) { await DataHandler.deleteEmailById(jQuery_API(this).closest('.email-item').data('id')); UI.renderEmailList(); } });
    p.on('click.phonesim', '#phonecall-view .delete-item-btn', async function(e) { e.stopPropagation(); if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this call log?', 'confirm')) { await DataHandler.deleteCallLogByTimestamp(jQuery_API(this).closest('.call-log-item').data('id')); UI.renderCallLogView(); } });
    p.on('click.phonesim', '#emaildetail-view #delete-email-btn', async function() { if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this email?', 'confirm')) { await DataHandler.deleteEmailById(PhoneSim_State.activeEmailId); UI.showView('EmailApp'); }});
    
    // --- BROWSER APP (DELEGATED EVENTS) ---
    p.on('click.phonesim', '#browser-back-btn', () => DataHandler.browserGoBack());
    p.on('click.phonesim', '#browser-home-btn', () => DataHandler.browserGoToHomePage());
    p.on('click.phonesim', '#browser-bookmarks-btn', () => UI.showView('BrowserHistory'));
    p.on('click.phonesim', '.back-to-browser-btn', () => UI.showView('BrowserApp'));
    p.on('click.phonesim', '#browser-go-btn', () => DataHandler.browserSearch(p.find('#browser-address-input').val()));
    p.on('keydown.phonesim', '#browser-address-input', (e) => { if (e.key === 'Enter') DataHandler.browserSearch(jQuery_API(e.target).val()); });
    p.on('click.phonesim', '.quick-search-item', function() { DataHandler.browserSearch(jQuery_API(this).data('term')); });
    p.on('click.phonesim', '.search-result-item .result-title', function() { const item = jQuery_API(this); DataHandler.browserLoadPage(item.data('url'), item.data('title')); });
    p.on('click.phonesim', '#browser-bookmark-toggle-btn', function() { const currentUrl = PhoneSim_State.browserHistory[PhoneSim_State.browserHistoryIndex]; const data = currentUrl ? PhoneSim_State.browserData[currentUrl] : null; if (data) DataHandler.toggleBookmark(data.url, data.title); });
    p.on('click.phonesim', '#browserhistory-view .tab-item', function() { const tab = jQuery_API(this); if (tab.hasClass('active')) return; const targetTab = tab.data('tab'); tab.siblings().removeClass('active').end().addClass('active'); p.find('#browserhistory-view .list-container').removeClass('active').filter(`[data-tab-content="${targetTab}"]`).addClass('active'); p.find('#clear-history-btn').toggle(targetTab !== 'directory'); });
    p.on('click.phonesim', '.hb-list-item .item-info', function() { const item = jQuery_API(this); DataHandler.browserLoadPage(item.data('url'), item.data('title')); UI.showView('BrowserApp'); });
    p.on('click.phonesim', '.hb-list-item .delete-item-btn', async function() { const item = jQuery_API(this).closest('.hb-list-item'); const url = item.data('url'); const type = jQuery_API(this).data('type'); if (type === 'history') await DataHandler.deleteHistoryItem(url); else if (type === 'bookmark') await DataHandler.deleteBookmarkItem(url); UI.renderHistoryAndBookmarks(); });
    p.on('click.phonesim', '#clear-history-btn', async () => { const activeTab = p.find('#browserhistory-view .tab-item.active').data('tab'); if (activeTab === 'history') { if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to clear all history?', 'confirm')) { await DataHandler.clearPersistentHistory(); UI.renderHistoryAndBookmarks(); } } else if (activeTab === 'bookmarks') { if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to clear all bookmarks?', 'confirm')) { await DataHandler.clearBookmarks(); UI.renderHistoryAndBookmarks(); } } });
    p.on('click.phonesim', '.webpage-content a[data-download="true"]', (e) => { e.preventDefault(); const link = jQuery_API(e.target); SillyTavern_Context_API.callGenericPopup(`<b>File Download</b><br><br><b>Filename:</b> ${link.attr('href')}<br><b>Description:</b> ${link.data('description')}<br><br><i>(This is a simulation, no file will be downloaded)</i>`, 'text'); });
    
    // --- FORUM & LIVE CENTER APPS ---
    p.on('click.phonesim', '#new-forum-content-btn, #new-live-content-btn, #new-live-stream-btn', function() {
        PhoneSim_Sounds.play('tap');
        const id = jQuery_API(this).attr('id');
        const context = (id.includes('forum')) ? 'forum' : 'live';
        UI.showView('Creation', { context: context });
    });
    p.on('click.phonesim', '#new-forum-post-btn', function() {
        PhoneSim_Sounds.play('tap');
        UI.showView('Creation', { context: 'forum', boardId: PhoneSim_State.activeForumBoardId });
    });
    p.on('click.phonesim', '#creation-back-btn', function() {
        PhoneSim_Sounds.play('tap');
        UI.showView(PhoneSim_State.previousView || 'HomeScreen');
    });
    p.on('submit.phonesim', '#creation-form', function(e) {
        e.preventDefault();
        PhoneSim_Sounds.play('send');
        const context = PhoneSim_State.creationContext;
        const board = p.find('#creation-board-input').val().trim();
        const title = p.find('#creation-title-input').val().trim();
        const content = p.find('#creation-content-input').val().trim();

        if (!board || !title || !content) {
            SillyTavern_Context_API.callGenericPopup('All fields are required.', 'text');
            return;
        }

        if (context === 'forum') {
            DataHandler.stagePlayerAction({ type: 'new_forum_post', postId: `staged_post_${Date.now()}`, boardName: board, boardId: PhoneSim_State.creationBoardContext, title: title, content: content });
            UI.showView('ForumApp');
        } else if (context === 'live') {
            DataHandler.stagePlayerAction({ type: 'new_live_stream', streamId: `staged_stream_${Date.now()}`, boardName: board, boardId: PhoneSim_State.creationBoardContext, title: title, content: content });
            UI.showView('LiveCenterApp');
        }
    });

    p.on('click.phonesim', '.forum-board-item', function(e) { 
        if (jQuery_API(e.target).closest('.delete-board-btn').length) return;
        PhoneSim_Sounds.play('tap'); 
        UI.showView('ForumPostList', jQuery_API(this).data('board-id')); 
    });
    p.on('click.phonesim', '.delete-board-btn', async function(e) {
        e.stopPropagation();
        PhoneSim_Sounds.play('tap');
        const item = jQuery_API(this).closest('.forum-board-item');
        const boardId = item.data('board-id');
        const boardName = item.data('board-name');
        
        if (await SillyTavern_Context_API.callGenericPopup(`Are you sure you want to delete the "${boardName}" board and all its posts? This action is irreversible.`, 'confirm')) {
            await DataHandler.deleteForumBoard(boardId);
            UI.renderForumBoardList();
        }
    });

    p.on('click.phonesim', '.forum-post-item', function() { PhoneSim_Sounds.play('open'); UI.showView('ForumPostDetail', jQuery_API(this).data('post-id')); });
    p.on('click.phonesim', '.live-board-item', function() { PhoneSim_Sounds.play('tap'); UI.showView('LiveStreamList', jQuery_API(this).data('board-id')); });
    p.on('click.phonesim', '.live-stream-item', async function() { PhoneSim_Sounds.play('open'); const streamerId = String(jQuery_API(this).data('streamer-id')); UI.showView('LiveStreamRoom', streamerId); const stream = DataHandler.findLiveStreamById(streamerId); if (stream) { const prompt = `(System prompt: {{user}} entered ${stream.streamerName}'s stream room "${stream.title}", please generate the current live content and comments.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); } else { console.error(`[Phone Sim] Could not find stream data for streamerId: ${streamerId}`); } });
    const handleSearch = async (inputElement) => { const input = jQuery_API(inputElement); const searchTerm = input.val().trim(); if (!searchTerm) return; PhoneSim_Sounds.play('send'); let prompt = ''; const view = input.closest('.view'); if (view.is('#forumpostlist-view')) { const boardName = view.find('.app-header h3').text(); prompt = `(System prompt: {{user}} searched in the "${boardName}" board of the forum for: "${searchTerm}". Please generate a list of relevant posts.)`; view.find('.forum-post-list-content').html(UI.getPostListSkeleton()); } else if (view.is('#livestreamlist-view')) { const boardName = view.find('.app-header h3').text(); prompt = `(System prompt: {{user}} searched in the "${boardName}" board of the live center for: "${searchTerm}". Please generate a list of relevant streams.)`; view.find('.live-stream-list-content').html(UI.getStreamListSkeleton()); } if (prompt) { await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); input.val(''); } };
    p.on('keydown.phonesim', '.search-input', function(e) { if (e.key === 'Enter') { handleSearch(this); } });
    p.on('click.phonesim', '.search-send-btn', function() { handleSearch(jQuery_API(this).siblings('.search-input')); });
    p.on('click.phonesim', '.generate-content-btn', async function(e) { e.stopPropagation(); PhoneSim_Sounds.play('send'); const btn = jQuery_API(this); const type = btn.data('type'); const boardId = btn.data('board-id'); const boardName = btn.data('board-name'); let prompt = ''; let viewId, skeletonLoader, contentSelector; if (type === 'forum') { prompt = `(System prompt: {{user}} requested to generate a new post list and corresponding replies for the "${boardName}" board in the forum.)`; viewId = 'ForumPostList'; skeletonLoader = UI.getPostListSkeleton; contentSelector = '.forum-post-list-content'; } else if (type === 'live') { prompt = `(System prompt: {{user}} requested to generate a new stream list for the "${boardName}" board in the live center.)`; viewId = 'LiveStreamList'; skeletonLoader = UI.getStreamListSkeleton; contentSelector = '.live-stream-list-content'; } if (prompt) { UI.showView(viewId, boardId); setTimeout(() => { p.find(`#${viewId.toLowerCase()}-view`).find(contentSelector).html(skeletonLoader()); }, 50); await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); } });
    const sendForumReply = () => { const input = p.find('.forum-reply-input'); const content = input.val().trim(); if (content && PhoneSim_State.activeForumPostId) { PhoneSim_Sounds.play('send'); DataHandler.stagePlayerAction({ type: 'new_forum_reply', postId: PhoneSim_State.activeForumPostId, content: content, replyId: 'staged_reply_' + Date.now() }); input.val(''); } };
    p.on('click.phonesim', '.forum-reply-send-btn', sendForumReply);
    p.on('keypress.phonesim', '.forum-reply-input', function(e) { if (e.key === 'Enter') { sendForumReply(); } });
    const sendDanmaku = () => {
        const input = p.find('.stream-danmaku-input');
        const content = input.val().trim();
        if (content && PhoneSim_State.activeLiveStreamId) {
            PhoneSim_Sounds.play('send');
            DataHandler.stagePlayerAction({
                type: 'new_danmaku',
                streamerId: PhoneSim_State.activeLiveStreamId,
                content: content
            });
            input.val('');
        }
    };
    p.on('click.phonesim', '.stream-danmaku-send-btn', sendDanmaku);
    p.on('keypress.phonesim', '.stream-danmaku-input', function(e) {
        if (e.key === 'Enter') {
            sendDanmaku();
        }
    });
    p.on('click.phonesim', '.post-like-btn', function() { PhoneSim_Sounds.play('tap'); const postId = jQuery_API(this).data('post-id'); DataHandler.stagePlayerAction({ type: 'like_forum_post', postId }); });
    
    // --- SETTINGS APP ---
    p.on('click.phonesim', '#mute-switch', function(){ const isActive = jQuery_API(this).toggleClass('active').hasClass('active'); PhoneSim_State.customization.isMuted = isActive; PhoneSim_State.saveCustomization(); PhoneSim_Sounds.play('toggle'); });
    p.on('click.phonesim', '#change-my-nickname', async () => { PhoneSim_Sounds.play('tap'); const newName = await UI.showDialog('Set My Nickname', PhoneSim_State.customization.playerNickname); if (newName !== null && newName.trim()) { PhoneSim_State.customization.playerNickname = newName.trim(); PhoneSim_State.saveCustomization(); UI.renderMeView(); } });
    p.on('click.phonesim', '#upload-player-avatar', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('playerAvatar'); });
    p.on('click.phonesim', '#upload-homescreen-wallpaper', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('homescreenWallpaper'); });
    p.on('click.phonesim', '#upload-chatlist-wallpaper', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('chatListWallpaper'); });
    p.on('click.phonesim', '#upload-chatview-wallpaper', () => { PhoneSim_Sounds.play('tap'); UI.handleFileUpload('chatViewWallpaper'); });
    p.on('click.phonesim', '#reset-ui-position', () => { PhoneSim_Sounds.play('tap'); UI.resetUIPosition(); });
    p.on('click.phonesim', '#reset-all-data', async () => { PhoneSim_Sounds.play('tap'); const result = await SillyTavern_Context_API.callGenericPopup('Are you sure you want to reset all phone data? This action is irreversible and will delete all related lorebook files.', 'confirm'); if (result) { await DataHandler.resetAllData(); await DataHandler.fetchAllData(); UI.rerenderCurrentView({ forceRerender: true }); } });

    // --- CALLS ---
    p.on('click.phonesim', '.reject-call', async () => { PhoneSim_Sounds.play('close'); SillyTavern_Context_API.stopGeneration(); if (PhoneSim_State.incomingCallData) { const prompt = `(System prompt: {{user}} rejected the call from ${PhoneSim_State.incomingCallData.name}.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); } UI.closeCallUI(); });
    p.on('click.phonesim', '.accept-call', async () => { PhoneSim_Sounds.play('open'); if (!PhoneSim_State.incomingCallData) return; const name = PhoneSim_State.incomingCallData.name; p.find('.voice-call-modal').hide().find('audio')[0].pause(); const prompt = `(System prompt: {{user}} answered the call from ${name}.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); PhoneSim_State.incomingCallData = null; });
    p.on('click.phonesim', '.call-ui-internal .voice-input-btn', function(){ PhoneSim_Sounds.play('tap'); jQuery_API(parentWin.document.body).find('#phone-sim-call-input-overlay').show().find('textarea').focus(); });
    p.on('click.phonesim', '.call-ui-internal .record-call-btn', function() { PhoneSim_Sounds.play('toggle'); const btn = jQuery_API(this); btn.toggleClass('active'); PhoneSim_State.isCallRecording = btn.hasClass('active'); const message = PhoneSim_State.isCallRecording ? "Call recording started" : "Call recording ended"; if (parentWin.toastr) { parentWin.toastr.info(message, 'Call Function'); } });
    p.on('click.phonesim', '.call-ui-internal .end-call', async function() {
        PhoneSim_Sounds.play('close');
        const isVoiceCall = PhoneSim_State.isVoiceCallActive;
        const callData = isVoiceCall ? PhoneSim_State.activeCallData : PhoneSim_State.activePhoneCallData;
        const callView = isVoiceCall ? p.find('#voicecall-view') : p.find('#phonecall-view');
        const timerText = callView.find('#call-timer').text() || '00:00';
    
        if (callData) {
            const contactName = UI._getContactName(callData.id);
            
            await DataHandler.logCallRecord({
                contactId: callData.id,
                duration: timerText,
                timestamp: new Date().toISOString(),
                callType: isVoiceCall ? 'wechat' : 'phone'
            });
    
            if (isVoiceCall) {
                await DataHandler.addWeChatCallEndMessage(callData.id, timerText);
            }
    
            const genericPrompt = `(System prompt: The call with ${contactName} has ended.)`;
            await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(genericPrompt)}`);
            SillyTavern_Context_API.generate();
        }
        
        UI.closeCallUI();
    });
    b.on('click.phonesim', '#phone-sim-call-input-cancel', function(){ PhoneSim_Sounds.play('tap'); jQuery_API(this).closest('.phone-sim-dialog-overlay').hide(); });
    b.on('click.phonesim', '#phone-sim-call-input-confirm', async function(){ PhoneSim_Sounds.play('send'); const modal = jQuery_API(this).closest('.phone-sim-dialog-overlay'); const textarea = modal.find('textarea'); const content = textarea.val().trim(); textarea.val(''); modal.hide(); if (content) { const isVoiceCall = PhoneSim_State.isVoiceCallActive; const callData = isVoiceCall ? PhoneSim_State.activeCallData : PhoneSim_State.activePhoneCallData; if (callData) { const contactName = UI._getContactName(callData.id); const callType = isVoiceCall ? 'Voice Call' : 'Phone Call'; const prompt = `(System prompt: {{user}} said in the ${callType} with ${contactName}: "${content}".)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); } } });
    
    // --- WECHAT NAVIGATION ---
    p.on('click.phonesim', '.back-to-list-btn, .back-to-discover-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('ChatApp'); });
    p.on('click.phonesim', '.back-to-chat-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('ChatConversation', PhoneSim_State.activeContactId); });
    p.on('click.phonesim', '.back-to-members-btn', () => { PhoneSim_Sounds.play('tap'); UI.showView('GroupMembers', PhoneSim_State.activeContactId); });
    p.on('click.phonesim', '.chatapp-bottom-nav .nav-item', function() { const item = jQuery_API(this); if (item.hasClass('active')) return; PhoneSim_Sounds.play('tap'); const target = item.data('target'); p.find('.chatapp-bottom-nav .nav-item').removeClass('active'); item.addClass('active'); const wrapper = p.find('#chatapp-view .subview-wrapper'); wrapper.find('.subview').removeClass('active'); wrapper.find(`.subview[data-subview="${target}"]`).addClass('active'); PhoneSim_State.activeSubviews.chatapp = target; PhoneSim_State.saveUiState(); });

    // --- CHAT LIST & CONTACTS ---
    p.on('click.phonesim', '.chat-list-item', function(e) { if (!jQuery_API(e.target).closest('.delete-chat-history-btn').length) { PhoneSim_Sounds.play('tap'); UI.showView('ChatConversation', String(jQuery_API(this).data('id'))); } });
    p.on('click.phonesim', '.chat-list-item .delete-chat-history-btn', async function(e) {
        e.stopPropagation();
        PhoneSim_Sounds.play('tap');
        const id = jQuery_API(this).data('id');
        const contactName = jQuery_API(this).closest('.chat-list-item').find('.chat-name-list').text();
        if (await SillyTavern_Context_API.callGenericPopup(`Are you sure you want to clear the chat history with ${contactName}? This action is irreversible but will not delete the contact.`, 'confirm')) {
            await DataHandler.clearChatHistoryForContact(id);
            await DataHandler.fetchAllData();
            UI.renderContactsList();
        }
    });
    p.on('click.phonesim', '.contacts-subview .contact-item .delete-contact-btn', async function(e) {
        e.stopPropagation();
        PhoneSim_Sounds.play('tap');
        const id = jQuery_API(this).closest('.contact-item').data('id');
        const contactName = jQuery_API(this).siblings('.contact-item-name').text();
        if (await SillyTavern_Context_API.callGenericPopup(`Are you sure you want to delete the contact ${contactName}? This will also delete all chat history.`, 'confirm')) {
            await DataHandler.deleteContact(id);
            UI.renderContactsView();
            UI.renderPhoneContactList();
        }
    });

    p.on('click.phonesim', '.contact-item', function(e) { if (!jQuery_API(e.target).closest('.delete-contact-btn').length) { PhoneSim_Sounds.play('tap'); UI.showView('ChatConversation', String(jQuery_API(this).data('id'))); }});
    p.on('input.phonesim', '#chatapp-view .contacts-subview .search-input', UI.throttle(function() { const searchTerm = jQuery_API(this).val().toLowerCase(); const contactList = jQuery_API(this).closest('.contacts-subview').find('.contacts-list-content'); contactList.find('.contact-item').each(function() { const contactItem = jQuery_API(this); const contactName = contactItem.find('.contact-item-name').text().toLowerCase(); if (contactName.includes(searchTerm)) contactItem.show(); else contactItem.hide(); }); contactList.find('.contact-group-header').each(function() { const header = jQuery_API(this); const itemsInGroup = header.nextUntil('.contact-group-header', '.contact-item'); const isGroupVisible = itemsInGroup.filter(':visible').length > 0; header.toggle(isGroupVisible); }); }, 200));
    p.on('click.phonesim', '.new-friend-request-item .request-btn', function() { PhoneSim_Sounds.play('tap'); const item = jQuery_API(this).closest('.new-friend-request-item'); const uid = item.data('uid'); const from_id = item.data('from-id'); const from_name = item.data('from-name'); const action = jQuery_API(this).data('action'); DataHandler.stageFriendRequestResponse(uid, action, from_id, from_name); });
    p.on('click.phonesim', '.friend-request-bubble .friend-request-btn', async function() { PhoneSim_Sounds.play('tap'); const bubble = jQuery_API(this).closest('.friend-request-bubble'); const uid = bubble.data('uid'); const from_id = bubble.data('from-id'); const from_name = bubble.data('from-name'); const action = jQuery_API(this).data('action'); await DataHandler.stageFriendRequestResponse(uid, action, from_id, from_name); });
    
    // --- GROUP MANAGEMENT ---
    p.on('click.phonesim', '.members-btn', function() { PhoneSim_Sounds.play('tap'); UI.showView('GroupMembers', jQuery_API(this).data('group-id')); });
    p.on('click.phonesim', '.group-invite-btn-item', function() { PhoneSim_Sounds.play('tap'); UI.showView('GroupInvite', PhoneSim_State.activeContactId); });
    p.on('click.phonesim', '.group-member-item .kick-btn', async function() { PhoneSim_Sounds.play('tap'); const memberId = jQuery_API(this).closest('.group-member-item').data('member-id'); const memberName = UI._getContactName(memberId); if (await SillyTavern_Context_API.callGenericPopup(`Are you sure you want to remove ${memberName} from the group chat?`, 'confirm')) { DataHandler.stagePlayerAction({ type: 'kick_member', groupId: PhoneSim_State.activeContactId, memberId: memberId }); } });
    function updateGroupConfirmButton(viewSelector, btnSelector) { const selectedCount = p.find(`${viewSelector} .checkbox.checked`).length; const btn = p.find(btnSelector); btn.text(`Done(${selectedCount})`).prop('disabled', selectedCount === 0); }
    p.on('click.phonesim', '.group-creation-contact-item', function() { jQuery_API(this).find('.checkbox').toggleClass('checked'); updateGroupConfirmButton('#groupcreation-view', '#confirm-group-creation-btn'); });
    p.on('click.phonesim', '.invite-contact-item', function() { jQuery_API(this).find('.checkbox').toggleClass('checked'); updateGroupConfirmButton('#groupinvite-view', '#confirm-invite-btn'); });
    p.on('click.phonesim', '#confirm-group-creation-btn', async function() { PhoneSim_Sounds.play('send'); const selectedIds = p.find('#groupcreation-view .checkbox.checked').map((_, el) => jQuery_API(el).closest('.group-creation-contact-item').data('contact-id')).get(); const groupName = await UI.showDialog('Set Group Chat Name', 'Group Chat'); if (groupName && selectedIds.length > 0) { DataHandler.stagePlayerAction({ type: 'create_group', memberIds: selectedIds, groupName: groupName }); } });
    p.on('click.phonesim', '#confirm-invite-btn', function() { PhoneSim_Sounds.play('send'); const selectedIds = p.find('#groupinvite-view .checkbox.checked').map((_, el) => jQuery_API(el).closest('.invite-contact-item').data('contact-id')).get(); if (selectedIds.length > 0) { DataHandler.stagePlayerAction({ type: 'invite_members', groupId: PhoneSim_State.activeContactId, memberIds: selectedIds }); } });

    // --- CHAT CONVERSATION ---
    const inputField = p.find('.input-field');
    const sendBtn = p.find('.send-btn');
    const richMediaBtn = p.find('.rich-media-btn');
    inputField.on('input.phonesim', function() {
        const hasText = jQuery_API(this).val().trim().length > 0;
        sendBtn.toggle(hasText);
        richMediaBtn.toggle(!hasText);
        const textarea = this;
        textarea.style.height = 'auto';
        const maxHeight = 100;
        if (textarea.scrollHeight <= maxHeight) {
            textarea.style.height = textarea.scrollHeight + 'px';
            textarea.style.overflowY = 'hidden';
        } else {
            textarea.style.height = maxHeight + 'px';
            textarea.style.overflowY = 'auto';
        }
    });

    sendBtn.on('click.phonesim', function() {
        const content = inputField.val().trim();
        if (content && PhoneSim_State.activeContactId) {
            PhoneSim_Sounds.play('send');
            DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, content, PhoneSim_State.activeReplyUid);
            inputField.val('').trigger('input');
            UI.hideReplyPreview();
        }
    });

    inputField.on('keypress.phonesim', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
    p.on('click.phonesim', '.close-reply-preview', () => UI.hideReplyPreview());
    p.on('click.phonesim', '.rich-message.location-message', function() { PhoneSim_Sounds.play('tap'); const location = jQuery_API(this).data('location'); if (location) { SillyTavern_Context_API.callGenericPopup(`<b>📍 地理位置</b><br><br>${location}`, 'text'); } });
    p.on('click.phonesim', '.pseudo-image-cover', function() { 
        PhoneSim_Sounds.play('tap'); 
        const cover = jQuery_API(this);
        const textDiv = cover.siblings('.pseudo-image-text');
        cover.hide();
        textDiv.show();
    });
    p.on('click.phonesim', '.voice-message', function(){ PhoneSim_Sounds.play('tap'); jQuery_API(this).toggleClass('expanded'); });
    p.on('click.phonesim', '.edit-note-btn', function() { PhoneSim_Sounds.play('tap'); if (PhoneSim_State.activeContactId) { const contact = PhoneSim_State.contacts[PhoneSim_State.activeContactId]; if (!contact || !contact.profile) return; UI.showDialog('Set Note', contact.profile.note || contact.profile.nickname || '').then(n => { if (n !== null) DataHandler.updateContactNote(PhoneSim_State.activeContactId, n).then(() => DataHandler.fetchAllData()); }); } });
    p.on('click.phonesim', '.call-btn', () => { PhoneSim_Sounds.play('tap'); if (PhoneSim_State.activeContactId) DataHandler.initiateVoiceCall(PhoneSim_State.activeContactId); });
    p.on('click.phonesim', '#chatconversation-view .header-avatar.clickable-avatar', function() {
        PhoneSim_Sounds.play('tap');
        const contactId = String(jQuery_API(this).data('contact-id'));
        if (contactId.startsWith('group_')) {
            UI.handleFileUpload('contactAvatar', contactId);
        } else {
            UI.showView('Homepage', contactId);
        }
    });

    // --- MOMENTS & HOMEPAGE ---
    p.on('click.phonesim', '#discover-moments', () => { PhoneSim_Sounds.play('tap'); UI.showView('Moments'); });
    p.on('click.phonesim', '.clickable-avatar', function() { PhoneSim_Sounds.play('tap'); const contactId = jQuery_API(this).data('contact-id'); UI.showView('Homepage', contactId); });
    p.on('click.phonesim', '#generate-moment-btn', async () => { PhoneSim_Sounds.play('tap'); const prompt = `(System prompt: Please generate a new Moments post for any character.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); });
    p.on('click.phonesim', '#homepage-view #generate-profile-update-btn', async () => { PhoneSim_Sounds.play('tap'); if (PhoneSim_State.activeProfileId) { const contactName = UI._getContactName(PhoneSim_State.activeProfileId); const prompt = `(System prompt: Please update the homepage for ${contactName} and generate a new post.)`; await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`); SillyTavern_Context_API.generate(); } });
    p.on('click.phonesim', '#post-moment-btn', async () => { PhoneSim_Sounds.play('tap'); const content = await UI.showDialog('Post New Moment'); if(content) DataHandler.stagePlayerAction({ type: 'new_moment', momentId: 'staged_' + Date.now(), data: { content, images: [], timestamp: new Date().toISOString() } }); })
    p.on('click.phonesim', '.moment-actions .like-btn', function() { PhoneSim_Sounds.play('tap'); const btn = jQuery_API(this); const icon = btn.find('i'); const momentId = btn.closest('.moment-post').data('moment-id'); if (!btn.hasClass('liked')) { icon.addClass('popped'); setTimeout(() => icon.removeClass('popped'), 300); } DataHandler.stagePlayerAction({ type: 'like', momentId }); });
    p.on('click.phonesim', '.moment-actions .comment-btn', async function() { PhoneSim_Sounds.play('tap'); const momentId = jQuery_API(this).closest('.moment-post').data('moment-id'); const content = await UI.showDialog('Post Comment'); if (content) DataHandler.stagePlayerAction({ type: 'comment', momentId, content, commentId: 'staged_comment_' + Date.now() }); });
    p.on('click.phonesim', '#homepage-view .homepage-avatar', function() { PhoneSim_Sounds.play('tap'); const contactId = PhoneSim_State.activeProfileId; if (contactId) { UI.handleFileUpload('contactAvatar', contactId); } });
    p.on('click.phonesim', '#moments-notify-btn', () => { PhoneSim_Sounds.play('open'); UI.showMomentsNotificationModal(); });
    p.on('click.phonesim', '#phone-sim-moments-notify-modal .phone-sim-notify-close', () => { PhoneSim_Sounds.play('close'); jQuery_API(parentWin.document.body).find('#phone-sim-moments-notify-modal').hide(); });

    // --- RICH MEDIA & EMOJI PICKER ---
    const richMediaPanel = p.find('.rich-media-panel');
    p.on('click.phonesim', '.emoji-btn', function(e) {
        e.stopPropagation(); PhoneSim_Sounds.play('tap');
        richMediaPanel.toggle();
        if (richMediaPanel.is(':visible')) {
            richMediaPanel.find('#sticker-picker-grid img[data-src]').each(function() {
                const img = jQuery_API(this);
                img.attr('src', img.data('src')).removeAttr('data-src');
            });
        }
    });

    p.on('click.phonesim', '.rich-media-tabs .tab-btn', function() {
        const tab = jQuery_API(this);
        if (tab.hasClass('active')) return;
        const target = tab.data('tab');
        tab.siblings().removeClass('active');
        tab.addClass('active');
        richMediaPanel.find('.rich-media-tab-content').removeClass('active');
        richMediaPanel.find(`.rich-media-tab-content[data-tab-content="${target}"]`).addClass('active');
    });

    const emojiPicker = richMediaPanel.find('emoji-picker')[0];
    if(emojiPicker) emojiPicker.addEventListener('emoji-click', e => { inputField.val(inputField.val() + e.detail.unicode); richMediaPanel.hide(); });

    p.on('click.phonesim', '.sticker-item', function() {
        const name = jQuery_API(this).data('name');
        const file = jQuery_API(this).data('file');
        const content = { type: 'image', url: `https://files.catbox.moe/${file}` };
        const descriptionForAI = `${name} sticker`;
        DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, content, null, descriptionForAI);
        richMediaPanel.hide();
    });


    // --- MENU HANDLER ---
    p.on('click.phonesim', '#chat-list-actions-btn, #add-chat-btn, #moments-actions-btn, .message-actions, .moment-actions-trigger, .forum-actions-trigger, .rich-message.transfer-message.unclaimed, .rich-media-btn, #manage-forum-btn, #manage-livecenter-btn', function(e){
        e.stopPropagation();
        PhoneSim_Sounds.play('tap');
        const clickedElement = jQuery_API(this);
        p.find('.phone-sim-menu').hide();
        let menuId;

        if (clickedElement.is('#chat-list-actions-btn')) menuId = '#manage-chats-menu';
        else if (clickedElement.is('#add-chat-btn')) menuId = '#add-chat-menu';
        else if (clickedElement.is('#moments-actions-btn')) menuId = '#manage-moments-menu';
        else if (clickedElement.is('#manage-forum-btn')) menuId = '#manage-forum-menu';
        else if (clickedElement.is('#manage-livecenter-btn')) menuId = '#manage-livecenter-menu';
        else if (clickedElement.hasClass('rich-media-btn')) menuId = '#rich-media-actions-menu';
        else if (clickedElement.hasClass('message-actions')) { const message = DataHandler.findMessageByUid(clickedElement.data('message-uid')); if (message) { menuId = (message.sender_id === PhoneSim_Config.PLAYER_ID) ? '#message-actions-menu' : '#npc-message-actions-menu'; } }
        else if (clickedElement.hasClass('rich-message')) { menuId = '#transfer-actions-menu'; }
        else if (clickedElement.hasClass('moment-actions-trigger')) { menuId = clickedElement.data('poster-id') == PhoneSim_Config.PLAYER_ID ? '#player-moment-actions-menu' : '#npc-moment-actions-menu'; }
        else if (clickedElement.hasClass('forum-actions-trigger')) {
            const authorId = clickedElement.data('author-id');
            const isPlayer = String(authorId) === PhoneSim_Config.PLAYER_ID;
            const isReply = clickedElement.data('reply-id');
            if(isReply) {
                menuId = isPlayer ? '#player-forum-reply-actions-menu' : '#npc-forum-reply-actions-menu';
            }
            else {
                menuId = isPlayer ? '#player-forum-post-actions-menu' : '#npc-forum-post-actions-menu';
            }
        }
        
        if (!menuId) return;

        const menu = p.find(menuId);
        if(!menu.length) return;

        const panelRect = p[0].getBoundingClientRect();
        const buttonRect = clickedElement[0].getBoundingClientRect();
        const menuHeight = menu.outerHeight();
        const menuWidth = menu.outerWidth();
        
        let top = (buttonRect.top - panelRect.top) + clickedElement.outerHeight() + 5;
        if (top + menuHeight > panelRect.height - 5) {
            top = (buttonRect.top - panelRect.top) - menuHeight - 5;
        }

        let left = (buttonRect.left - panelRect.left) - menuWidth + clickedElement.outerWidth();
        if (clickedElement.hasClass('message-actions') && clickedElement.closest('.message').hasClass('sent')) {
            left = (buttonRect.left - panelRect.left);
        }
        if (left < 5) left = 5;
        if (left + menuWidth > panelRect.width - 5) {
            left = panelRect.width - menuWidth - 5;
        }
        
        menu.data(clickedElement.data()).css({ top: `${top}px`, left: `${left}px` }).toggle();
    });

    // --- CONTEXT MENUS ---
    p.on('contextmenu.phonesim', '.moment-comment.player-comment', function(e) {
        e.preventDefault();
        e.stopPropagation();
        PhoneSim_Sounds.play('tap');
        p.find('.phone-sim-menu').hide();
        const commentId = jQuery_API(this).data('comment-id');
        const momentId = jQuery_API(this).closest('.moment-post').data('moment-id');
        const menu = p.find('#moment-comment-actions-menu');

        const panelRect = p[0].getBoundingClientRect();
        const top = e.clientY - panelRect.top;
        let left = e.clientX - panelRect.left;
        if (left + menu.outerWidth() > panelRect.width - 5) {
            left = left - menu.outerWidth();
        }
        
        menu.data({commentId, momentId}).css({top, left}).show();
    });

    // --- MENU ITEM ACTIONS ---
    p.on('click.phonesim', '.phone-sim-menu .menu-item', async function() {
        const menuItem = jQuery_API(this);
        const menu = menuItem.parent();
        const action = menuItem.data('action');
        const uid = menu.data('uid');
        const messageUid = menu.data('message-uid');
        const { commentId, momentId, postId, replyId } = menu.data();
        
        menu.hide();

        switch(action) {
            case 'add-friend': { 
                const friendData = await UI.showAddFriendDialog();
                if (friendData && friendData.id && friendData.nickname) {
                    await DataHandler.addContactManually(friendData.id, friendData.nickname);
                }
                return;
            }
            case 'start-group-chat':
                UI.showView('GroupCreation');
                return;
            case 'clear_all_history':
                if(await SillyTavern_Context_API.callGenericPopup('Are you sure you want to clear all chat history?', 'confirm')) {
                    await DataHandler.clearAllChatHistory();
                    await DataHandler.fetchAllData();
                    UI.renderContactsList();
                }
                return;
            case 'clear_all_moments':
                if(await SillyTavern_Context_API.callGenericPopup('Are you sure you want to clear all moments?', 'confirm')) {
                    await DataHandler.clearAllMoments();
                    await DataHandler.fetchAllData();
                    if (p.find('#moments-view').hasClass('active')) UI.renderMomentsView();
                }
                return;
            case 'clear_all_forum_data':
                if(await SillyTavern_Context_API.callGenericPopup('Are you sure you want to clear all forum data?', 'confirm')) {
                    await DataHandler.clearAllForumData();
                    await DataHandler.fetchAllData();
                    if (p.find('#forumapp-view').hasClass('active')) UI.renderForumBoardList();
                }
                return;
            case 'clear_all_live_data':
                 if(await SillyTavern_Context_API.callGenericPopup('Are you sure you want to clear all live data?', 'confirm')) {
                    await DataHandler.clearAllLiveData();
                    await DataHandler.fetchAllData();
                    if (p.find('#livecenterapp-view').hasClass('active')) UI.renderLiveBoardList();
                }
                return;
            case 'accept':
                if (uid) {
                    DataHandler.stagePlayerAction({ type: 'accept_transaction', uid: uid });
                }
                return;
            case 'ignore':
                return;
            case 'upload-local-image':
                UI.handleFileUpload('localImageUpload', PhoneSim_State.activeContactId);
                return;
            case 'send-image-url': {
                const url = await UI.showDialog('Enter Image URL');
                if (url) DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, { type: 'image', url }, null, '[Image]');
                return;
            }
            case 'send-image-text': {
                const text = await UI.showDialog('Enter Image Description');
                if (text) DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, { type: 'pseudo_image', text }, null, `[Image: ${text}]`);
                return;
            }
            case 'send-voice-message': { 
                const voiceInput = await UI.showDialog('Enter Voice Content', 'Format: duration"|text, e.g. 8"|Hello');
                if (voiceInput) {
                    const parts = voiceInput.split('|');
                    const duration = parts[0]?.trim();
                    const text = parts[1]?.trim();
                    if (duration && text) {
                        const descriptionForAI = `[Voice: ${duration}]`;
                        DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, { type: 'voice', duration, text }, null, descriptionForAI);
                    } else {
                        SillyTavern_Context_API.callGenericPopup('Incorrect format. Please use "duration"|content" format.', 'text');
                    }
                }
                return;
            }
            case 'send-transfer': {
                const amount = await UI.showDialog('Enter Transfer Amount');
                if (amount && !isNaN(parseFloat(amount))) DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, { type: 'transfer', amount: parseFloat(amount).toFixed(2), note: 'Transfer', status: 'claimed' }, null, `[Transfer: ${amount}]`);
                return;
            }
            case 'send-red-packet': {
                const amount = await UI.showDialog('Enter Red Packet Amount');
                if (amount && !isNaN(parseFloat(amount))) DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, { type: 'red_packet', amount: parseFloat(amount).toFixed(2), note: 'Best wishes!', status: 'claimed' }, null, `[Red Packet: ${amount}]`);
                return;
            }
            case 'send-location': {
                const loc = await UI.showDialog('Enter Location');
                if (loc) DataHandler.stagePlayerMessage(PhoneSim_State.activeContactId, { type: 'location', text: loc }, null, `[Location: ${loc}]`);
                return;
            }
            case 'edit_moment': {
                const moment = PhoneSim_State.moments.find(m => m.momentId === momentId);
                if (moment) {
                    const newContent = await UI.showDialog('Edit Moment', typeof moment.content === 'string' ? moment.content : '');
                    if (newContent !== null) {
                        DataHandler.stagePlayerAction({ type: 'edit_moment', momentId, content: newContent });
                    }
                }
                return;
            }
            case 'delete_moment': {
                if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this moment?', 'confirm')) {
                    DataHandler.stagePlayerAction({ type: 'delete_moment', momentId });
                }
                return;
            }
            case 'edit_comment': {
                const comment = DataHandler.findMomentCommentByUid(commentId);
                if (comment) {
                    const newContent = await UI.showDialog('Edit Comment', typeof comment.text === 'string' ? comment.text : '');
                    if (newContent !== null) {
                        DataHandler.stagePlayerAction({ type: 'edit_comment', momentId, commentId, content: newContent });
                    }
                }
                return;
            }
            case 'recall_comment': {
                DataHandler.stagePlayerAction({ type: 'recall_comment', momentId, commentId });
                return;
            }
            case 'delete_comment': {
                if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this comment?', 'confirm')) {
                    DataHandler.stagePlayerAction({ type: 'delete_comment', momentId, commentId });
                }
                return;
            }
            case 'edit_forum_post': {
                const post = DataHandler.findForumPostById(postId);
                if (post) {
                    const newContent = await UI.showDialog('Edit Post', typeof post.content === 'string' ? post.content : '');
                    if (newContent !== null) {
                        DataHandler.stagePlayerAction({ type: 'edit_forum_post', postId, content: newContent });
                    }
                }
                return;
            }
            case 'delete_forum_post': {
                if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this post?', 'confirm')) {
                    DataHandler.stagePlayerAction({ type: 'delete_forum_post', postId });
                }
                return;
            }
             case 'edit_forum_reply': {
                const reply = DataHandler.findForumReplyById(replyId);
                 if (reply) {
                    const newContent = await UI.showDialog('Edit Reply', typeof reply.content === 'string' ? reply.content : '');
                    if (newContent !== null) {
                        DataHandler.stagePlayerAction({ type: 'edit_forum_reply', replyId, content: newContent });
                    }
                }
                return;
            }
            case 'delete_forum_reply': {
                 if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete this reply?', 'confirm')) {
                    DataHandler.stagePlayerAction({ type: 'delete_forum_reply', replyId });
                }
                return;
            }
            case 'report': {
                SillyTavern_Context_API.callGenericPopup('Report submitted.', 'text');
                return;
            }
        }

        if (messageUid) {
            let updateType = null;
            if (action === 'delete') { if (await SillyTavern_Context_API.callGenericPopup('Are you sure you want to delete?', 'confirm')) { updateType = await DataHandler.deleteMessageByUid(messageUid); } }
            else if (action === 'edit') { const message = DataHandler.findMessageByUid(messageUid); if (message && typeof message.content === 'string') { const newContent = await UI.showDialog('Edit Message', message.content); if (newContent !== null) updateType = await DataHandler.editMessageByUid(messageUid, newContent); } else if (message) { SillyTavern_Context_API.callGenericPopup('Cannot edit rich content messages.', 'text'); } }
            else if (action === 'recall') { updateType = await DataHandler.recallMessageByUid(messageUid); }
            else if (action === 'reply') { const message = DataHandler.findMessageByUid(messageUid); if (message) UI.showReplyPreview(message); }
            if (updateType) { if (updateType === 'worldbook') await DataHandler.fetchAllData(); UI.rerenderCurrentView({ chatUpdated: true }); UI.updateCommitButton(); }
        }
    });

    // --- DRAGGING & RESIZING ---
    UI.makeDraggable(p);
    jQuery_API(parentWin).on('resize.phonesim', () => UI.updateScaleAndPosition());
}
