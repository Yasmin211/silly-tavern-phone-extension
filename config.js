

export const PhoneSim_Config = {
    LOREBOOK_PREFIX: 'PhoneSim_Data_',
    WORLD_DB_NAME: '手机模拟器_聊天记录',
    WORLD_DIR_NAME: '手机模拟器_联系人目录',
    WORLD_AVATAR_DB_NAME: '手机模拟器_头像存储',
    WORLD_EMAIL_DB_NAME: '手机模拟器_邮件数据库',
    WORLD_CALL_LOG_DB_NAME: '手机模拟器_通话记录',
    WORLD_BROWSER_DATABASE: '手机模拟器_浏览器数据库',
    WORLD_FORUM_DATABASE: '手机模拟器_论坛数据库',
    WORLD_LIVECENTER_DATABASE: '手机模拟器_直播数据',
    PLAYER_ID: 'PLAYER_USER',
    PANEL_ID: 'phone-sim-panel-v10-0',
    TOGGLE_BUTTON_ID: 'phone-sim-toggle-btn-v10-0',
    COMMIT_BUTTON_ID: 'phone-sim-commit-btn-v10-0',
    STORAGE_KEY_UI: 'phone-sim-ui-state-v10-0',
    STORAGE_KEY_CUSTOMIZATION: 'phone-sim-customization-v10-0',
    WORLD_STATE_REGEX: /<WorldState>[\s\S]*?时间[:：]\s*(\d{4}[年\/-]\d{1,2}[月\/-]\d{1,2}[日]?\s*(\d{1,2}:\d{2}))/s,
    INITIAL_LOREBOOK_ENTRIES: [
        { name: '手机模拟器_聊天记录', content: '{}', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_联系人目录', content: '{}', enabled: true, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_头像存储', content: '{}', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_邮件数据库', content: '[]', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_通话记录', content: '[]', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_浏览器数据库', content: '{}', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_论坛数据库', content: '{}', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
        { name: '手机模拟器_直播数据', content: '{}', enabled: false, comment: 'Managed by Phone Simulator Plugin. Do not edit manually.' },
    ]
};