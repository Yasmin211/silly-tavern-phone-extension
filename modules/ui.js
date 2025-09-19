

import * as Core from './ui_modules/core.js';
import * as Events from './ui_modules/events.js';
import * as RenderChat from './ui_modules/renderChat.js';
import * as RenderMoments from './ui_modules/renderMoments.js';
import * as RenderCall from './ui_modules/renderCall.js';
import * as RenderPhoneEmail from './ui_modules/renderPhoneEmail.js';
import * as RenderGroup from './ui_modules/renderGroup.js';
import * as RenderBrowser from './ui_modules/renderBrowser.js';
import * as RenderForum from './ui_modules/renderForum.js';
import * as RenderLiveCenter from './ui_modules/renderLiveCenter.js';
import * as RenderSettings from './ui_modules/renderSettings.js';
import * as Components from './ui_modules/components.js';
import * as Utils from './ui_modules/utils.js';

const modules = [Core, Events, RenderChat, RenderMoments, RenderCall, RenderPhoneEmail, RenderGroup, RenderBrowser, RenderForum, RenderLiveCenter, RenderSettings, Components, Utils];

// Aggregate all functions from sub-modules into this single object.
export const PhoneSim_UI = {};

// Combine functions from each module into the main UI object.
modules.forEach(module => {
    Object.keys(module).forEach(key => {
        // We only add functions, and avoid overwriting the init function we'll define below.
        if (typeof module[key] === 'function' && key !== 'init') {
            PhoneSim_UI[key] = module[key];
        }
    });
});

/**
 * Initializes all sub-modules with necessary dependencies, including the data handler.
 * This is called from the main script after both UI and Data handlers are fully constructed.
 * @param {object} dependencies - Core APIs (SillyTavern, jQuery, etc.).
 * @param {object} dataHandler - The fully constructed Data handler object.
 */
PhoneSim_UI.init = (dependencies, dataHandler) => {
    modules.forEach(module => {
        if (typeof module.init === 'function') {
            // Pass dependencies, the Data handler, and a reference to the complete UI handler itself.
            module.init(dependencies, dataHandler, PhoneSim_UI);
        }
    });
};
