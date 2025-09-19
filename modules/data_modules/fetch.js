

import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';

let TavernHelper_API, parentWin, UI, DataHandler;

export function init(deps, uiHandler, dataHandler) {
    TavernHelper_API = deps.th;
    parentWin = deps.win;
    UI = uiHandler;
    DataHandler = dataHandler;
}

const PRESET_FORUM_BOARDS = {
    "campus_life": "校园生活",
    "academic_exchange": "学术交流"
};

const PRESET_LIVE_BOARDS = {
    "hot_games": { name: "热门游戏" },
    "music_station": { name: "音乐台" },
    "life_chat": { name: "生活闲聊" }
};

export function getBoardNameById(boardId, context) {
    if (context === 'forum') {
        if (PRESET_FORUM_BOARDS[boardId]) {
            return PRESET_FORUM_BOARDS[boardId];
        }
        return PhoneSim_State.forumData[boardId]?.boardName || boardId;
    }
    if (context === 'live') {
        if (PRESET_LIVE_BOARDS[boardId]) {
            return PRESET_LIVE_BOARDS[boardId].name;
        }
        // Custom live boards are not a feature, but this is a safe fallback
        return PhoneSim_State.liveCenterData[boardId]?.boardName || boardId;
    }
    return boardId; // Fallback
}


async function fetchAllDirectoryAndRequests() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) {
        PhoneSim_State.pendingFriendRequests = [];
        return;
    }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const dirEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_DIR_NAME);
        if (dirEntry) {
            const dirData = JSON.parse(dirEntry.content || '{}');
            PhoneSim_State.pendingFriendRequests = dirData.friend_requests || [];
        } else {
            PhoneSim_State.pendingFriendRequests = [];
        }
    } catch (er) {
        console.error('[Phone Sim] Failed to fetch directory and friend requests:', er);
        PhoneSim_State.pendingFriendRequests = [];
    }
}


export async function fetchAllBrowserData() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) {
        PhoneSim_State.persistentBrowserHistory = [];
        PhoneSim_State.browserData = {};
        PhoneSim_State.browserBookmarks = [];
        PhoneSim_State.browserDirectory = {};
        return;
    }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const browserDbEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_BROWSER_DATABASE);
        
        const browserDb = browserDbEntry ? JSON.parse(browserDbEntry.content || '{}') : {};
        
        PhoneSim_State.persistentBrowserHistory = browserDb.history || []; // For the library view
        PhoneSim_State.browserData = browserDb.pages || {};
        PhoneSim_State.browserBookmarks = browserDb.bookmarks || [];
        PhoneSim_State.browserDirectory = browserDb.directory || {};

    } catch (er) {
        console.error('[Phone Sim] Failed to fetch browser data:', er);
        PhoneSim_State.persistentBrowserHistory = [];
        PhoneSim_State.browserData = {};
        PhoneSim_State.browserBookmarks = [];
        PhoneSim_State.browserDirectory = {};
    }
}

export async function fetchAllForumData() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) { PhoneSim_State.forumData = {}; return; }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const forumEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_FORUM_DATABASE);
        PhoneSim_State.forumData = forumEntry ? JSON.parse(forumEntry.content || '{}') : {};
    } catch (er) {
        console.error('[Phone Sim] Failed to fetch forum data:', er);
        PhoneSim_State.forumData = {};
    }
}

export async function fetchAllLiveCenterData() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) { PhoneSim_State.liveCenterData = {}; return; }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const liveCenterEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_LIVECENTER_DATABASE);
        PhoneSim_State.liveCenterData = liveCenterEntry ? JSON.parse(liveCenterEntry.content || '{}') : {};
    } catch (er) {
        console.error('[Phone Sim] Failed to fetch live center data:', er);
        PhoneSim_State.liveCenterData = {};
    }
}

export async function fetchAllData() {
    await fetchAllContacts();
    await fetchAllEmails();
    await fetchAllMoments();
    await fetchAllCallLogs();
    await fetchAllBrowserData();
    await fetchAllForumData();
    await fetchAllLiveCenterData();
    await fetchAllDirectoryAndRequests();
    UI.updateGlobalUnreadCounts();
}

export async function fetchAllMoments() {
    let allMoments = [];
    for (const contactId in PhoneSim_State.contacts) {
        const contact = PhoneSim_State.contacts[contactId];
        if (contact.moments && Array.isArray(contact.moments)) {
            allMoments.push(...contact.moments);
        }
    }
    allMoments.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    PhoneSim_State.moments = allMoments;
}

export async function fetchAllEmails() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) { PhoneSim_State.emails = []; return; }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const emailEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_EMAIL_DB_NAME);
        PhoneSim_State.emails = emailEntry ? JSON.parse(emailEntry.content || '[]') : [];
    } catch (er) {
        console.error('[Phone Sim] Failed to fetch emails:', er);
        PhoneSim_State.emails = [];
    }
}

export async function fetchAllCallLogs() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) { PhoneSim_State.callLogs = []; return; }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const callLogEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_CALL_LOG_DB_NAME);
        PhoneSim_State.callLogs = callLogEntry ? JSON.parse(callLogEntry.content || '[]') : [];
    } catch (er) {
        console.error('[Phone Sim] Failed to fetch call logs:', er);
        PhoneSim_State.callLogs = [];
    }
}


export async function fetchAllContacts() {
    const lorebookName = await DataHandler.getOrCreatePhoneLorebook();
    if (!lorebookName) {
        PhoneSim_State.contacts = {};
        return;
    }
    try {
        const entries = await TavernHelper_API.getWorldbook(lorebookName);
        const dbEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_DB_NAME);
        const avatarEntry = entries.find(e => e.name === PhoneSim_Config.WORLD_AVATAR_DB_NAME);

        const dbData = dbEntry ? JSON.parse(dbEntry.content || '{}') : {};
        const avatarData = avatarEntry ? JSON.parse(avatarEntry.content || '{}') : {};

        if (avatarData[PhoneSim_Config.PLAYER_ID]) {
            PhoneSim_State.customization.playerAvatar = avatarData[PhoneSim_Config.PLAYER_ID];
        }

        delete dbData.plugin_customization_data;

        for (const contactId in dbData) {
            const contact = dbData[contactId];
            if (!contact.profile) continue;

            // This now works for both users and groups if they have the flag.
            if (contact.profile.has_custom_avatar && avatarData[contactId]) {
                contact.profile.avatar = avatarData[contactId];
            }
        }
        PhoneSim_State.contacts = dbData;
    } catch (er) {
        console.error('[Phone Sim] Failed to fetch all contacts:', er);
        PhoneSim_State.contacts = {};
    }
}
