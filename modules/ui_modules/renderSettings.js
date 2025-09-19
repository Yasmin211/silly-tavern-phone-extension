
import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, UI;

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    UI = uiObject;
}

export function renderSettingsView() {
    const p = jQuery_API(parentWin.document.body).find('#settingsapp-view');
    const settings = PhoneSim_State.customization;
    
    // The HTML structure is now in panel.html. This function just updates the dynamic parts.
    const muteSwitch = p.find('#mute-switch');
    if (settings.isMuted) {
        muteSwitch.addClass('active');
    } else {
        muteSwitch.removeClass('active');
    }
}