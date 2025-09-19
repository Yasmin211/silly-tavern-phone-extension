import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';

let SillyTavern_API, TavernHelper_API;
let UI, DataHandler;

export function init(deps, uiHandler, dataHandler) {
    SillyTavern_API = deps.st;
    TavernHelper_API = deps.th;
    UI = uiHandler;
    DataHandler = dataHandler;
}


export function isBookmarked(url) {
    return PhoneSim_State.browserBookmarks.some(bookmark => bookmark.url === url);
}

export async function toggleBookmark(url, title) {
     await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        if (!browserDb.bookmarks) browserDb.bookmarks = [];
        const bookmarkIndex = browserDb.bookmarks.findIndex(b => b.url === url);

        if (bookmarkIndex > -1) {
            browserDb.bookmarks.splice(bookmarkIndex, 1);
        } else {
            browserDb.bookmarks.push({ url, title, timestamp: new Date().toISOString() });
        }
        return browserDb;
    });
    await DataHandler.fetchAllBrowserData();
    UI.updateNavControls();
}

export async function deleteHistoryItem(url) {
    await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        if (browserDb.history) {
            browserDb.history = browserDb.history.filter(hUrl => hUrl !== url);
        }
        return browserDb;
    });
    await DataHandler.fetchAllBrowserData();
}

export async function deleteBookmarkItem(url) {
     await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        if(browserDb.bookmarks) {
            browserDb.bookmarks = browserDb.bookmarks.filter(b => b.url !== url);
        }
        return browserDb;
    });
    await DataHandler.fetchAllBrowserData();
}

async function _navigateTo(prompt, action) {
    PhoneSim_State.pendingBrowserAction = action;
    UI.setLoading(true);
    if (prompt) {
        await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`);
        SillyTavern_API.generate();
    }
}


export async function browserSearch(term) {
    PhoneSim_State.browserHistory = [];
    PhoneSim_State.browserHistoryIndex = -1;
    const action = { type: 'search', value: term };
    const prompt = `(系统提示：{{user}}在浏览器中搜索：“${term}”)`;
    await _navigateTo(prompt, action);
}

export async function browserLoadPage(url, title) {
    const pageExists = PhoneSim_State.browserData[url] && PhoneSim_State.browserData[url].content?.length > 0;

    if (PhoneSim_State.browserHistoryIndex < PhoneSim_State.browserHistory.length - 1) {
        PhoneSim_State.browserHistory = PhoneSim_State.browserHistory.slice(0, PhoneSim_State.browserHistoryIndex + 1);
    }
    if (PhoneSim_State.browserHistory[PhoneSim_State.browserHistory.length - 1] !== url) {
        PhoneSim_State.browserHistory.push(url);
    }
    PhoneSim_State.browserHistoryIndex = PhoneSim_State.browserHistory.length - 1;

    if (pageExists) {
        await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, db => {
            if (!db.history) db.history = [];
            if (db.history[db.history.length - 1] !== url) db.history.push(url);
            return db;
        });
        await DataHandler.fetchAllBrowserData();
        UI.renderBrowserState();
        UI.setLoading(false);
    } else {
        const action = { type: 'pageload', url: url, title: title };
        const prompt = `(系统提示：{{user}}点击了标题为“${title}”的链接，请为我生成对应的网页内容。)`;
        await _navigateTo(prompt, action);
    }
}


export async function saveSearchResults(searchTerm, results, msgId) {
    await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        browserDb.directory = {
            title: `搜索: ${searchTerm}`,
            content: results,
            timestamp: new Date().toISOString(),
            sourceMsgId: msgId
        };
        
        if (!browserDb.pages) browserDb.pages = {};
        results.forEach(result => {
            if (!browserDb.pages[result.url]) {
                browserDb.pages[result.url] = {
                    url: result.url,
                    title: result.title,
                    type: 'page',
                    content: [], 
                    timestamp: new Date().toISOString(),
                    sourceMsgId: msgId
                };
            }
        });
        return browserDb;
    });
}

export async function savePageContent(pageData, msgId) {
    const { url, title, content } = pageData;
    
    await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        if (!browserDb.pages) browserDb.pages = {};
        browserDb.pages[url] = {
            url, title, type: 'page', content,
            timestamp: new Date().toISOString(), sourceMsgId: msgId
        };
        
        if (!browserDb.history) browserDb.history = [];
        if (browserDb.history[browserDb.history.length - 1] !== url) {
            browserDb.history.push(url);
        }
        
        return browserDb;
    });
}

export function browserGoBack() {
    if (PhoneSim_State.browserHistoryIndex > 0) {
        PhoneSim_State.browserHistoryIndex--;
        UI.renderBrowserState();
    } else {
        UI.showView('HomeScreen');
    }
}

export function browserGoToHomePage() {
    PhoneSim_State.browserHistory = [];
    PhoneSim_State.browserHistoryIndex = -1;
    PhoneSim_State.browserDirectory = {}; 
    UI.renderBrowserState();
}

export async function browserRefresh() {
    if (PhoneSim_State.browserHistoryIndex > -1) {
       const currentUrl = PhoneSim_State.browserHistory[PhoneSim_State.browserHistoryIndex];
       const currentData = PhoneSim_State.browserData[currentUrl];
       if (!currentData) return;
        await browserLoadPage(currentData.url, currentData.title);
    }
}

export async function clearPersistentHistory() {
     await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        browserDb.history = [];
        return browserDb;
     });
     await DataHandler.fetchAllBrowserData();
     PhoneSim_State.browserHistory = [];
     PhoneSim_State.browserHistoryIndex = -1;
     UI.renderBrowserState();
}

export async function clearBookmarks() {
    await DataHandler._updateWorldbook(PhoneSim_Config.WORLD_BROWSER_DATABASE, browserDb => {
        browserDb.bookmarks = [];
        return browserDb;
    });
    await DataHandler.fetchAllBrowserData();
}