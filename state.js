
import { PhoneSim_Config } from '../config.js';

let parentWindow;

export const PhoneSim_State = {
    isPanelVisible: false,
    panelPos: null,
    contacts: {},
    emails: [],
    moments: [],
    callLogs: [],
    forumData: {},
    liveCenterData: {},
    activeContactId: null,
    activeEmailId: null,
    activeProfileId: null,
    activeForumBoardId: null,
    activeForumPostId: null,
    activeLiveBoardId: null,
    activeLiveStreamId: null,
    activeLiveStreamData: null,
    activeReplyUid: null,
    worldDate: new Date(),
    worldTime: '12:00',
    customization: { isMuted: false, playerNickname: '我' },
    stagedPlayerMessages: [],
    stagedPlayerActions: [],
    pendingFriendRequests: [],
    lastTotalUnread: 0,
    isVoiceCallActive: false,
    activeCallData: null,
    isPhoneCallActive: false,
    activePhoneCallData: null,
    isCallRecording: false,
    incomingCallData: null,
    currentView: 'HomeScreen',
    activeSubviews: {},
    browserHistory: [], // This is now officially the SESSION history for back/forward
    persistentBrowserHistory: [], // This is the full history log for the Library view
    browserData: {},
    browserDirectory: {},
    browserHistoryIndex: -1,
    isBrowserLoading: false,
    pendingBrowserAction: null,
    browserBookmarks: [],
    pendingAnimations: {},

    init: function(win) {
        parentWindow = win;
    },

    loadCustomization: function() {
        try {
            const saved = JSON.parse(parentWindow.localStorage.getItem(PhoneSim_Config.STORAGE_KEY_CUSTOMIZATION) || '{}');
            const defaultCustomization = { isMuted: false, playerNickname: '我' };
            this.customization = { ...defaultCustomization, ...this.customization, ...saved };
        } catch (e) {
            console.error('[Phone Sim] Failed to load customization state from localStorage:', e);
            this.customization = { isMuted: false, playerNickname: '我' };
        }
    },

    loadUiState: function() {
        try {
            const s = JSON.parse(parentWindow.localStorage.getItem(PhoneSim_Config.STORAGE_KEY_UI) || '{}');
            // Selectively assign properties to avoid overwriting initialized objects
            const propertiesToLoad = [
                'isPanelVisible', 'panelPos', 'currentView', 'activeContactId', 
                'activeEmailId', 'activeProfileId', 'activeForumBoardId', 
                'activeForumPostId', 'activeLiveBoardId', 'activeLiveStreamId', 
                'activeSubviews'
            ];
            for (const prop of propertiesToLoad) {
                if (s[prop] !== undefined) {
                    this[prop] = s[prop];
                }
            }
        } catch (e) {
            console.error('[Phone Sim] Failed to load UI state from localStorage:', e);
        }
    },
    saveUiState: function() {
        try {
            const stateToSave = { 
                isPanelVisible: this.isPanelVisible, 
                panelPos: this.panelPos,
                currentView: this.currentView,
                activeContactId: this.activeContactId,
                activeEmailId: this.activeEmailId,
                activeProfileId: this.activeProfileId,
                activeForumBoardId: this.activeForumBoardId,
                activeForumPostId: this.activeForumPostId,
                activeLiveBoardId: this.activeLiveBoardId,
                activeLiveStreamId: this.activeLiveStreamId,
                activeSubviews: this.activeSubviews
            };
            parentWindow.localStorage.setItem(PhoneSim_Config.STORAGE_KEY_UI, JSON.stringify(stateToSave));
        } catch (e) {
            console.error('[Phone Sim] Failed to save UI state to localStorage:', e);
        }
    }
};
