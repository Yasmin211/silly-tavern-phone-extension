
import { PhoneSim_State } from '../state.js';

export function init(deps, uiHandler, dataHandler) {
    // No initialization needed for this utility module
}

export function findLiveStreamById(streamerId) {
    for (const boardId in PhoneSim_State.liveCenterData) {
        const board = PhoneSim_State.liveCenterData[boardId];
        const stream = board.streams?.find(s => s.streamerId === streamerId);
        if (stream) {
            return { ...stream, boardId };
        }
    }
    return null;
}
