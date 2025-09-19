

import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, UI, DataHandler;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    UI = uiObject;
    DataHandler = dataHandler;
}

export function renderBrowserState() {
    const currentUrl = PhoneSim_State.browserHistory[PhoneSim_State.browserHistoryIndex];
    const data = currentUrl ? PhoneSim_State.browserData[currentUrl] : null;

    if (data) {
        // If there's an active page in history, render it
        renderWebpage(data.content || []);
    } else if (PhoneSim_State.browserDirectory && Array.isArray(PhoneSim_State.browserDirectory.content) && PhoneSim_State.browserDirectory.content.length > 0) {
        // Otherwise, if there's a directory (last search result), render that
        renderSearchResults(PhoneSim_State.browserDirectory.content);
    } else {
        // Fallback to the search homepage
        showBrowserSubview('search-home');
    }

    updateNavControls();
    updateAddressBar();
}


export function renderHistoryAndBookmarks() {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const historyList = p.find('#history-list').empty();
    const bookmarksList = p.find('#bookmarks-list').empty();
    const directoryList = p.find('#directory-list').empty();
    const persistentHistory = PhoneSim_State.persistentBrowserHistory;

    // Render History from the persistent log
    if (!persistentHistory || persistentHistory.length === 0) {
        historyList.html('<div class="hb-list-empty">No history</div>');
    } else {
        const uniqueUrls = new Set();
        [...persistentHistory].reverse().forEach(url => {
            if(uniqueUrls.has(url)) return;
            const item = PhoneSim_State.browserData[url];
            if (!item) return; 
            
            uniqueUrls.add(url);
            const itemHtml = `
                <div class="hb-list-item" data-url="${item.url}">
                    <div class="item-icon"><i class="fas fa-globe"></i></div>
                    <div class="item-info" data-url="${item.url}" data-title="${item.title}">
                        <div class="item-title">${item.title || item.url}</div>
                        <div class="item-url">${item.url}</div>
                    </div>
                    <button class="delete-item-btn" data-type="history"><i class="fas fa-times"></i></button>
                </div>`;
            historyList.append(itemHtml);
        });
    }

    // Render Bookmarks
    if (PhoneSim_State.browserBookmarks.length === 0) {
        bookmarksList.html('<div class="hb-list-empty">No bookmarks</div>');
    } else {
        const sortedBookmarks = [...PhoneSim_State.browserBookmarks].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        sortedBookmarks.forEach(item => {
            const itemHtml = `
                <div class="hb-list-item" data-url="${item.url}">
                    <div class="item-icon"><i class="fas fa-star" style="color: #f7b731;"></i></div>
                    <div class="item-info" data-url="${item.url}" data-title="${item.title}">
                        <div class="item-title">${item.title}</div>
                        <div class="item-url">${item.url}</div>
                    </div>
                    <button class="delete-item-btn" data-type="bookmark"><i class="fas fa-times"></i></button>
                </div>`;
            bookmarksList.append(itemHtml);
        });
    }
    
    // Render Directory
    if (!PhoneSim_State.browserDirectory || !PhoneSim_State.browserDirectory.content || PhoneSim_State.browserDirectory.content.length === 0) {
        directoryList.html('<div class="hb-list-empty">No website directory</div>');
    } else {
        PhoneSim_State.browserDirectory.content.forEach(item => {
            const itemHtml = `
                <div class="hb-list-item" data-url="${item.url}">
                     <div class="item-icon"><i class="fas fa-list-alt"></i></div>
                     <div class="item-info" data-url="${item.url}" data-title="${item.title}">
                         <div class="item-title">${item.title}</div>
                         <div class="item-url">${item.snippet}</div>
                     </div>
                </div>`;
            directoryList.append(itemHtml);
        });
    }
}


export function showBrowserSubview(subviewName) {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    p.find('#browserapp-view .browser-subview').removeClass('active');
    p.find(`#${subviewName}-subview`).addClass('active');
}

export function renderSearchResults(results) {
    const list = jQuery_API(parentWin.document.body).find('#browser-search-results-list').empty();
     if (!Array.isArray(results) || results.length === 0) {
        list.html('<p class="browser-empty-state">No relevant results found.</p>');
        showBrowserSubview('search-results');
        return;
    }
    results.forEach(result => {
        const itemHtml = `
            <div class="search-result-item">
                <a class="result-title" data-url="${result.url}" data-title="${result.title}">${result.title}</a>
                <p class="result-url">${result.url}</p>
                <p class="result-snippet">${result.snippet}</p>
            </div>
        `;
        list.append(itemHtml);
    });
    showBrowserSubview('search-results');
}

export function renderWebpage(contentBlocks) {
    const contentArea = jQuery_API(parentWin.document.body).find('#webpage-content').empty();
    if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
        contentArea.html('<h1>Page is empty</h1><p>This page has no content.</p>');
        showBrowserSubview('webpage');
        return;
    }

    contentBlocks.forEach(block => {
        const { type, text } = block;
        if (!type) return;

        const processedHtml = UI.renderRichContent(text, { isMoment: true });
        
        const allowedTags = ['h1', 'h2', 'p', 'blockquote'];
        if (allowedTags.includes(type)) {
            const element = jQuery_API(`<${type}>`).html(processedHtml);
            contentArea.append(element);
        }
    });

    showBrowserSubview('webpage');
}


export function updateNavControls() {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const currentUrl = PhoneSim_State.browserHistory[PhoneSim_State.browserHistoryIndex];
    
    // Back button is now always enabled within the browser app. Its function is determined by the event handler.
    p.find('#browser-back-btn').prop('disabled', false);

    const bookmarkBtn = p.find('#browser-bookmark-toggle-btn');
    const bookmarkIcon = bookmarkBtn.find('i');
    
    if (currentUrl && !currentUrl.startsWith('search://')) {
        bookmarkBtn.prop('disabled', false);
        if (DataHandler.isBookmarked(currentUrl)) {
            bookmarkIcon.removeClass('far').addClass('fas');
        } else {
            bookmarkIcon.removeClass('fas').addClass('far');
        }
    } else {
        bookmarkBtn.prop('disabled', true);
        bookmarkIcon.removeClass('fas').addClass('far');
    }
}

export function updateAddressBar() {
     const currentUrl = PhoneSim_State.browserHistory[PhoneSim_State.browserHistoryIndex];
     const data = currentUrl ? PhoneSim_State.browserData[currentUrl] : null;
     let displayValue = '';
     if (data) {
         if (data.type === 'search_result') {
             displayValue = decodeURIComponent(data.url.replace('search://?q=', ''));
         } else {
             displayValue = data.url;
         }
     } else if (PhoneSim_State.browserDirectory && PhoneSim_State.browserDirectory.title) {
        displayValue = PhoneSim_State.browserDirectory.title.replace('Search: ', '');
     }
     jQuery_API(parentWin.document.body).find('#browser-address-input').val(displayValue);
}

export function setLoading(isLoading) {
    const p = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0`);
    const resultsList = p.find('#browser-search-results-list');
    const pageContent = p.find('#webpage-content');

    if (isLoading) {
        resultsList.empty();
        pageContent.empty();

        const searchSkeleton = `
            <div class="skeleton-search-result">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-url"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>`.repeat(3);

        const webpageSkeleton = `
            <div class="skeleton-webpage">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
                <br>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>`;

        const actionType = PhoneSim_State.pendingBrowserAction?.type;

        if (actionType === 'search') {
            resultsList.html(searchSkeleton);
            showBrowserSubview('search-results');
        } else { // 'pageload' or default
            pageContent.html(webpageSkeleton);
            showBrowserSubview('webpage');
        }
    }
}
