import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, TavernHelper_API, st_api, UI, DataHandler;

const PRESET_BOARDS = {
    "hot_games": { name: "Hot Games", icon: "fa-gamepad" },
    "music_station": { name: "Music Station", icon: "fa-music" },
    "life_chat": { name: "Life Chat", icon: "fa-coffee" }
};

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    st_api = deps.st;
    TavernHelper_API = deps.th;
    UI = uiObject;
    DataHandler = dataHandler;
}

export function renderLiveBoardList() {
    const content = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .live-board-list-content`).empty();
    
    for (const boardId in PRESET_BOARDS) {
        const board = PRESET_BOARDS[boardId];
        const itemHtml = `
            <div class="live-board-item" data-board-id="${boardId}" data-board-name="${board.name}">
                <i class="fas ${board.icon} live-board-icon"></i>
                <span class="live-board-name">${board.name}</span>
                <div class="live-item-actions">
                    <button class="generate-content-btn" data-type="live" data-board-id="${boardId}" data-board-name="${board.name}" title="Generate new content"><i class="fas fa-plus"></i></button>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
        content.append(itemHtml);
    }
}

export async function renderLiveStreamList(boardId) {
    const view = jQuery_API(parentWin.document.body).find('#livestreamlist-view');
    const boardName = PRESET_BOARDS[boardId]?.name || 'Stream List';
    view.find('.app-header h3').text(boardName);
    const content = view.find('.live-stream-list-content').empty();
    
    const boardData = PhoneSim_State.liveCenterData[boardId];
    const streams = boardData?.streams || [];

    const stagedStreams = PhoneSim_State.stagedPlayerActions
        .filter(a => a.type === 'new_live_stream' && a.boardName === boardName)
        .map(a => ({
            streamerId: PhoneSim_Config.PLAYER_ID,
            streamerName: PhoneSim_State.customization.playerNickname || 'Me',
            title: a.title,
            viewerCount: 0,
            isStaged: true
        }));

    const allStreams = [...stagedStreams, ...streams];

    if (allStreams.length === 0) {
        content.html('<div class="email-empty-state">No streams in this board yet</div>');
        return;
    }

    allStreams.forEach(stream => {
        const streamer = PhoneSim_State.contacts[stream.streamerId];
        const avatar = (stream.streamerId === PhoneSim_Config.PLAYER_ID) 
            ? (PhoneSim_State.customization.playerAvatar || UI.generateDefaultAvatar(stream.streamerName))
            : (streamer?.profile?.avatar || UI.generateDefaultAvatar(stream.streamerName));

        const itemHtml = `
            <div class="live-stream-item search-filterable-item ${stream.isStaged ? 'staged' : ''}" data-streamer-id="${stream.streamerId}">
                <div class="stream-thumbnail-wrapper">
                    <div class="stream-viewer-count">
                        <i class="fas fa-eye"></i>
                        <span>${stream.viewerCount}</span>
                    </div>
                </div>
                <div class="stream-info">
                    <h5 class="stream-title">${stream.title}</h5>
                    <div class="stream-streamer-info">
                         <img src="${avatar}" class="streamer-avatar-small">
                         <span class="streamer-name-small">${stream.streamerName}</span>
                    </div>
                </div>
            </div>`;
        content.append(itemHtml);
    });
}

export function renderLiveStreamRoom(streamerId) {
    const view = jQuery_API(parentWin.document.body).find('#livestreamroom-view');
    const liveData = PhoneSim_State.liveCenterData.active_stream;

    // Find static data from directory as a fallback for the header
    const streamFromDir = DataHandler.findLiveStreamById(streamerId);
    
    // Set header title: Use live data first, then directory, then a default
    const streamTitle = liveData?.title || streamFromDir?.title || 'Stream Room';
    view.find('.app-header h3').text(streamTitle);
    
    // If there's no live data from the AI yet (or it's for another stream after a quick navigation),
    // show a loading state and wait for the correct AI response.
    if (!liveData || liveData.streamerId !== streamerId) {
        view.find('.stream-video-desc').text('Connecting to the stream room...');
        view.find('.stream-danmaku-container').empty();
        return;
    } 
    
    // If we have the correct live data, render it.
    view.find('.stream-video-desc').text(liveData.videoDescription);
    const danmakuContainer = view.find('.stream-danmaku-container').empty();
    
    (liveData.danmaku || []).forEach(d => {
        const danmakuHtml = `
            <div class="danmaku-item">
                <span class="danmaku-user">${d.user}:</span>
                <span class="danmaku-text">${d.text}</span>
            </div>`;
        danmakuContainer.prepend(danmakuHtml);
    });
}
