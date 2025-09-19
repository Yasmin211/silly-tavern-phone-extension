
import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, SillyTavern_Context_API, UI, DataHandler;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    SillyTavern_Context_API = deps.st_context;
    UI = uiObject;
    DataHandler = dataHandler;
}

function _createToggleButton() {
    const buttonHtml = `
        <div id="${PhoneSim_Config.TOGGLE_BUTTON_ID}" title="Phone Simulator">
            <i class="fas fa-mobile-alt"></i>
            <div class="unread-badge" style="display:none;"></div>
        </div>`;
    jQuery_API(parentWin.document.body).append(buttonHtml);
}

function _createAuxiliaryElements() {
    if (jQuery_API(parentWin.document.body).find('#phone-sim-file-input').length === 0) {
        jQuery_API(parentWin.document.body).append('<input type="file" id="phone-sim-file-input" accept="image/*" style="display:none;">');
    }

    const dialogHtml = `
        <div class="phone-sim-dialog-overlay" id="phone-sim-dialog-overlay" style="display:none;">
            <div class="phone-sim-dialog">
                <h3 id="phone-sim-dialog-title"></h3>
                <div class="dialog-content"><textarea id="phone-sim-dialog-textarea" class="dialog-input"></textarea></div>
                <div class="dialog-buttons">
                    <button id="phone-sim-dialog-cancel" class="dialog-btn cancel-btn">Cancel</button>
                    <button id="phone-sim-dialog-confirm" class="dialog-btn confirm-btn">Confirm</button>
                </div>
            </div>
        </div>
        <div class="phone-sim-dialog-overlay" id="phone-sim-call-input-overlay" style="display:none;">
             <div class="phone-sim-dialog">
                <h3 id="phone-sim-call-input-title">Speak during call</h3>
                <div class="dialog-content"><textarea id="phone-sim-call-input-textarea" class="dialog-input" placeholder="Enter what you want to say..."></textarea></div>
                <div class="dialog-buttons">
                    <button id="phone-sim-call-input-cancel" class="dialog-btn cancel-btn">Cancel</button>
                    <button id="phone-sim-call-input-confirm" class="dialog-btn confirm-btn">Send</button>
                </div>
            </div>
        </div>`;
    jQuery_API(parentWin.document.body).append(dialogHtml);
}


export async function initializeUI() {
    try {
        const body = jQuery_API(parentWin.document.body);
        
        if (body.find(`#${PhoneSim_Config.PANEL_ID}`).length > 0) {
            console.warn(`[Phone Sim] Panel already exists. Aborting UI creation.`);
            return true;
        }

        const coreJsUrl = new URL(import.meta.url);
        const basePath = coreJsUrl.pathname.substring(0, coreJsUrl.pathname.lastIndexOf('/modules/ui_modules'));
        const panelUrl = `${basePath}/panel.html`;

        console.log(`[Phone Sim] Fetching panel from: ${panelUrl}`);
        const response = await fetch(panelUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch panel.html: ${response.status} ${response.statusText}`);
        }
        const templateHtml = await response.text();
        if (!templateHtml) {
            throw new Error("Fetched panel.html is empty.");
        }
        
        body.append(templateHtml);
        
        if (body.find(`#${PhoneSim_Config.PANEL_ID}`).length === 0) {
             throw new Error("Panel element not found in DOM after injection.");
        }

        _createToggleButton();
        _createAuxiliaryElements();

        UI.populateApps();
        UI.renderStickerPicker();
        UI.applyCustomizations();
        UI.addEventListeners();
        UI.updateScaleAndPosition();

        if (parentWin.document.readyState === "complete") {
            const emojiScript = document.createElement('script');
            emojiScript.type = 'module';
            emojiScript.src = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js';
            parentWin.document.head.appendChild(emojiScript);
        }
        
        body.find(`#${PhoneSim_Config.PANEL_ID}`).hide();
        
        return true;
    } catch (error) {
        console.error('[Phone Sim] CRITICAL UI Initialization Failure:', error);
        if (parentWin.toastr) {
            parentWin.toastr.error("Phone Simulator plugin UI failed to load. Please check the console for details and try refreshing the page.", "Critical Error", { timeOut: 10000 });
        }
        return false;
    }
}

export function togglePanel(forceShow = null) {
    const panel = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.PANEL_ID}`);
    const shouldShow = forceShow !== null ? forceShow : panel.is(':hidden');

    PhoneSim_State.isPanelVisible = shouldShow;
    PhoneSim_State.saveUiState();

    if (shouldShow) {
        panel.show();
        UI.updateScaleAndPosition();
        UI.updateTime();
        DataHandler.fetchAllData().then(() => {
            UI.rerenderCurrentView();
        });
    } else {
        panel.hide();
    }
}

export function rerenderCurrentView(updates = {}) {
    let activeId = null;
    const currentViewId = PhoneSim_State.currentView;

    // Determine the correct context ID based on the currently active view
    switch(currentViewId) {
        case 'ChatConversation':
        case 'GroupMembers':
        case 'GroupInvite':
            activeId = PhoneSim_State.activeContactId;
            break;
        case 'Homepage':
            activeId = PhoneSim_State.activeProfileId;
            break;
        case 'EmailDetail':
            activeId = PhoneSim_State.activeEmailId;
            break;
        case 'ForumPostList':
            activeId = PhoneSim_State.activeForumBoardId;
            break;
        case 'ForumPostDetail':
            activeId = PhoneSim_State.activeForumPostId;
            break;
        case 'LiveStreamList':
            activeId = PhoneSim_State.activeLiveBoardId;
            break;
        case 'LiveStreamRoom':
            activeId = PhoneSim_State.activeLiveStreamId;
            break;
        // Views without a specific ID context don't need to be listed
    }

    // Always re-render the main content of the current view
    UI.renderViewContent(currentViewId, activeId);

    // Handle secondary UI updates that might be needed
    if (updates.chatUpdated) {
        // If we are on the main ChatApp screen, we need to refresh the message list
        if(currentViewId === 'ChatApp') {
            UI.renderContactsList();
        }
    }
}

export function showView(viewId, ...args) {
    if (PhoneSim_State.isNavigating) {
        return; // Navigation lock is active, ignore request.
    }
    
    const p = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.PANEL_ID}`);
    let targetViewId = viewId;
    let isSubViewNavigation = false;

    // Special handling for BrowserHistory, which is a subview treated like a main view target
    if (viewId === 'BrowserHistory') {
        targetViewId = 'BrowserApp';
        isSubViewNavigation = true;
    }

    const currentView = p.find('.view.active');
    const nextView = p.find(`#${targetViewId.toLowerCase()}-view`);

    if (!nextView.length || (currentView.attr('id') === nextView.attr('id') && !args[0]?.forceRerender && !args[0]?.isTabSwitch)) {
        // If it's just a subview navigation within the same main view, handle it without animation.
        if (isSubViewNavigation && currentView.attr('id') === nextView.attr('id')) {
             UI.renderViewContent(viewId, ...args); // This will handle the subview switch
             return;
        }
        return;
    }
    
    PhoneSim_State.isNavigating = true; // Engage navigation lock

    let options = {};
    let dataArgs = [...args];
    if (dataArgs.length > 0 && typeof dataArgs[0] === 'object' && dataArgs[0] !== null) {
        options = dataArgs.shift();
    }
    
    // Store the active context ID in the global state
    const activeId = dataArgs[0];
    switch(viewId) {
        case 'ChatConversation': PhoneSim_State.activeContactId = activeId; break;
        case 'GroupMembers': case 'GroupInvite': PhoneSim_State.activeContactId = activeId; break;
        case 'Homepage': PhoneSim_State.activeProfileId = activeId; break;
        case 'EmailDetail': PhoneSim_State.activeEmailId = activeId; break;
        case 'ForumPostList': PhoneSim_State.activeForumBoardId = activeId; break;
        case 'ForumPostDetail': PhoneSim_State.activeForumPostId = activeId; break;
        case 'LiveStreamList': PhoneSim_State.activeLiveBoardId = activeId; break;
        case 'LiveStreamRoom': PhoneSim_State.activeLiveStreamId = activeId; break;
        case 'Creation': 
            PhoneSim_State.creationContext = options.context; 
            PhoneSim_State.creationBoardContext = options.boardId || null;
            PhoneSim_State.previousView = PhoneSim_State.currentView; 
            break;
    }


    UI.renderViewContent(viewId, ...dataArgs);
    PhoneSim_State.currentView = viewId;
    PhoneSim_State.saveUiState();

    const currentLevel = parseInt(currentView.data('nav-level'), 10);
    const nextLevel = parseInt(nextView.data('nav-level'), 10);
    
    let animationIn = 'fade-in', animationOut = 'fade-out';

    const isZoomingIn = options.animationOrigin && currentView.is('#homescreen-view');
    const isReturningHome = nextView.is('#homescreen-view') && !currentView.is('#homescreen-view');

    if (isZoomingIn) {
        animationIn = 'zoom-in';
        const { x, y } = options.animationOrigin;
        nextView.css({ '--origin-x': `${x}px`, '--origin-y': `${y}px` });
    } else if (isReturningHome) {
        const closingAppViewId = currentView.attr('id'); // e.g., 'chatapp-view'
        const closingAppId = closingAppViewId.replace('-view', '').replace(/\b\w/g, l => l.toUpperCase());
        const appIcon = p.find(`.app-block[data-view="${closingAppId}"]`);

        if (appIcon.length) {
            animationOut = 'zoom-out';
            const rect = appIcon[0].getBoundingClientRect();
            const panelRect = p[0].getBoundingClientRect();
            const originX = rect.left - panelRect.left + rect.width / 2;
            const originY = rect.top - panelRect.top + rect.height / 2;
            currentView.css({ '--origin-x': `${originX}px`, '--origin-y': `${originY}px` });
        } else {
            animationOut = 'slide-out-to-bottom'; // Fallback
        }
    } else if (options.isTabSwitch) {
        animationIn = 'fade-in';
        animationOut = 'fade-out';
    } else if (nextLevel > currentLevel) {
        animationIn = 'slide-in-from-right';
        animationOut = 'slide-out-to-left';
    } else if (nextLevel < currentLevel) {
        animationIn = 'slide-in-from-left';
        animationOut = 'slide-out-to-right';
    }

    p.find('.view').removeClass('zoom-in zoom-out slide-in-from-right slide-in-from-left slide-out-to-right slide-out-to-left slide-out-to-bottom fade-in fade-out');
    
    nextView.addClass(animationIn);
    currentView.addClass(animationOut);

    nextView.css('z-index', 3).addClass('active');
    currentView.css('z-index', 2);
    
    const transitionDuration = (animationIn === 'zoom-in' || animationOut === 'zoom-out') ? 400 : 350;
    setTimeout(() => {
        currentView.removeClass('active').removeClass(animationOut);
        nextView.removeClass(animationIn).css({ zIndex: 2, '--origin-x': '', '--origin-y': '' });
        PhoneSim_State.isNavigating = false; // Release navigation lock
    }, transitionDuration);
}


export function renderViewContent(viewId, ...args) {
    const p = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.PANEL_ID}`);
    
    // Special case for BrowserHistory: it's a subview of BrowserApp
    if (viewId === 'BrowserHistory') {
        const browserView = p.find('#browserapp-view');
        browserView.find('.browser-subview').removeClass('active');
        browserView.find('#browserhistory-view').addClass('active');
        UI.renderHistoryAndBookmarks();
        return; // Handled, so we exit early.
    }

    switch(viewId) {
        case 'HomeScreen': break; 
        case 'ChatApp': 
            UI.renderContactsList(); UI.renderContactsView(); UI.renderDiscoverView(); UI.renderMeView();
            const activeTab = PhoneSim_State.activeSubviews.chatapp || 'messages';
            p.find('#chatapp-view .subview').removeClass('active').filter(`[data-subview="${activeTab}"]`).addClass('active');
            p.find('.chatapp-bottom-nav .nav-item').removeClass('active').filter(`[data-target="${activeTab}"]`).addClass('active');
            break;
        case 'ChatConversation': UI.renderChatView(args[0], 'WeChat'); break;
        case 'GroupMembers': UI.renderGroupMembersView(args[0]); break;
        case 'GroupInvite': UI.renderGroupInviteView(args[0]); break;
        case 'GroupCreation': UI.renderGroupCreationView(); break;
        case 'Moments': UI.renderMomentsView(); break;
        case 'Homepage': UI.renderHomepage(args[0]); break;
        case 'PhoneApp': 
            UI.renderPhoneContactList(); 
            UI.renderCallLogView();
            const activePhoneTab = PhoneSim_State.activeSubviews.phoneapp || 'contacts';
            p.find('#phoneapp-view .subview').removeClass('active').filter(`.phone-${activePhoneTab}-subview`).addClass('active');
            p.find('.phoneapp-bottom-nav .nav-item').removeClass('active').filter(`[data-target="${activePhoneTab}"]`).addClass('active');
            break;
        case 'EmailApp': UI.renderEmailList(); break;
        case 'EmailDetail': UI.renderEmailDetail(args[0]); break;
        case 'SettingsApp': UI.renderSettingsView(); break;
        case 'BrowserApp': UI.renderBrowserState(); break;
        // BrowserHistory is handled above, so no case is needed here.
        case 'ForumApp': UI.renderForumBoardList(); break;
        case 'ForumPostList': UI.renderForumPostList(args[0]); break;
        case 'ForumPostDetail': UI.renderForumPostDetail(args[0]); break;
        case 'LiveCenterApp': UI.renderLiveBoardList(); break;
        case 'LiveStreamList': UI.renderLiveStreamList(args[0]); break;
        case 'LiveStreamRoom': UI.renderLiveStreamRoom(args[0]); break;
        case 'Creation': UI.renderCreationView(); break;
    }
}

export function renderCreationView() {
    const p = jQuery_API(parentWin.document.body).find(`#${PhoneSim_Config.PANEL_ID}`);
    const form = p.find('#creation-form');
    form[0].reset();
    
    const context = PhoneSim_State.creationContext;
    const boardContextId = PhoneSim_State.creationBoardContext;

    const title = context === 'forum' ? 'Create New Post' : 'Create New Stream';
    p.find('#creation-view-title').text(title);
    
    const boardInput = form.find('#creation-board-input');
    
    if (boardContextId) {
        const boardName = DataHandler.getBoardNameById(boardContextId, context);
        boardInput.val(boardName).prop('readonly', true).css('background-color', '#e9ecef');
    } else {
        boardInput.val('').prop('readonly', false).css('background-color', '');
    }
}

export async function showAddFriendDialog() {
    return new Promise(resolve => {
        const dialog = jQuery_API(parentWin.document.body).find('#phone-sim-add-friend-dialog');
        const idInput = dialog.find('#add-friend-id-input');
        const nicknameInput = dialog.find('#add-friend-nickname-input');
        idInput.val('');
        nicknameInput.val('');

        dialog.show();
        idInput.focus();

        const confirmBtn = dialog.find('#phone-sim-add-friend-confirm');
        const cancelBtn = dialog.find('#phone-sim-add-friend-cancel');

        const close = (value) => {
            dialog.hide();
            confirmBtn.off();
            cancelBtn.off();
            resolve(value);
        };

        confirmBtn.one('click', () => {
            const id = idInput.val().trim();
            const nickname = nicknameInput.val().trim();
            if (id && nickname) {
                close({ id, nickname });
            } else {
                SillyTavern_Context_API.callGenericPopup('ID and nickname cannot be empty.', 'text');
            }
        });
        cancelBtn.one('click', () => close(null));
    });
}
