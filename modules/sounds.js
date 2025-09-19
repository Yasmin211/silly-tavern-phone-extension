let state;

export const PhoneSim_Sounds = {
    _sounds: {},
    
    init: function(stateModule) {
        state = stateModule;
        this._loadSound('tap', 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        this._loadSound('send', 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3');
        this._loadSound('receive', 'https://assets.mixkit.co/active_storage/sfx/3005/3005-preview.mp3');
        this._loadSound('open', 'https://files.catbox.moe/gb0so5.mp3');
        this._loadSound('close', 'https://assets.mixkit.co/active_storage/sfx/2575/2575-preview.mp3');
        this._loadSound('toggle', 'https://files.catbox.moe/b4amzm.mp3');
    },

    _loadSound: function(name, url) {
        this._sounds[name] = new Audio(url);
        this._sounds[name].preload = 'auto';
    },
    
    _vibrate: function(duration = 5) {
        if (navigator.vibrate && !state.customization.isMuted) {
            try {
                navigator.vibrate(duration);
            } catch (e) {
                // This can fail on some browsers/devices, but it's not critical.
            }
        }
    },

    play: function(name) {
        const soundsWithHaptics = ['tap', 'send', 'open', 'close', 'toggle'];
        if (soundsWithHaptics.includes(name)) {
            this._vibrate();
        }
        
        if (!state || state.customization.isMuted) return;

        const sound = this._sounds[name];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.error(`[Phone Sim] Sound playback failed for '${name}':`, e));
        }
    }
};
