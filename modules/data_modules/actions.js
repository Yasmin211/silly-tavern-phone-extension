
import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';
import { PhoneSim_Parser } from '../parser.js';

let SillyTavern_Main_API, SillyTavern_Context_API, TavernHelper_API;
let parentWin;
let UI, DataHandler;

// Cache the current lorebook name to avoid repeated async calls within a single operation.
let currentCharacterLorebookName = null;
let currentCharacterName = null;

export function init(deps, uiHandler, dataHandler) {
    SillyTavern_Main_API = deps.st;
    SillyTavern_Context_API = deps.st_context;
    TavernHelper_API = deps.th;
    parentWin = deps.win;
    UI = uiHandler;
    DataHandler = dataHandler;
}

export function clearLorebookCache() {
    currentCharacterLorebookName = null;
    currentCharacterName = null;
}

export async function getOrCreatePhoneLorebook() {
    const characterName = SillyTavern_Main_API.getContext().name2;
    // If character hasn't changed and lorebook name is cached, return it.
    if (currentCharacterName === characterName && currentCharacterLorebookName) {
        return currentCharacterLorebookName;
    }

    currentCharacterName = characterName;
    const lorebookName = `${PhoneSim_Config.LOREBOOK_PREFIX}${characterName}`;

    // 1. Check if lorebook exists. If not, create it.
    const allLorebooks = await TavernHelper_API.getWorldbookNames();
    if (!allLorebooks.includes(lorebookName)) {
        await TavernHelper_API.createOrReplaceWorldbook(lorebookName, PhoneSim_Config.INITIAL_LOREBOOK_ENTRIES);
    }

    // 2. Check if lorebook is bound. If not, bind it safely.
    const charLorebooks = await TavernHelper_API.getCharWorldbookNames('current');
    if (charLorebooks && !charLorebooks.additional.includes(lorebookName)) {
        // Read-Modify-Write to safely add our lorebook without removing others.
        const updatedAdditional = [...charLorebooks.additional, lorebookName];
        await TavernHelper_API.rebindCharWorldbooks('current', {
            primary: charLorebooks.primary,
            additional: updatedAdditional
        });
    }
    
    // Cache and return the name
    currentCharacterLorebookName = lorebookName;
    return lorebookName;
}


export async function _updateWorldbook(dbName, updaterFn) {
    const lorebookName = await getOrCreatePhoneLorebook();
    if (!lorebookName) {
        console.error("[Phone Sim] Cannot update worldbook: Could not get or create a dedicated lorebook.");
        return false;
    }

    try {
        let entries = await TavernHelper_API.getWorldbook(lorebookName);
        if (!Array.isArray(entries)) {
            entries = [];
        }
        
        let dbIndex = entries.findIndex(e => e.name === dbName);
        
        const isArrayDb = [
            PhoneSim_Config.WORLD_EMAIL_DB_NAME, 
            PhoneSim_Config.WORLD_CALL_LOG_DB_NAME
        ].includes(dbName);
        const defaultContent = isArrayDb ? '[]' : '{}';

        if (dbIndex === -1) {
            console.warn(`[Phone Sim] Entry '${dbName}' not found in lorebook '${lorebookName}'. This should not happen with the new creation logic. Re-creating.`);
            const newEntry = { 
                name: dbName, 
                content: defaultContent, 
                enabled: false,
                comment: `Managed by Phone Simulator Plugin. Do not edit manually.` 
            };
            entries.push(newEntry);
            dbIndex = entries.length - 1;
        }

        let dbData;
        try {
            const content = entries[dbIndex].content;
            dbData = JSON.parse(content || defaultContent);
        } catch(e) {
            console.warn(`[Phone Sim] Could not parse content for ${dbName}, resetting to default. Content was:`, entries[dbIndex].content, e);
            dbData = JSON.parse(defaultContent);
        }

        const updatedData = updaterFn(dbData);
        entries[dbIndex].content = JSON.stringify(updatedData, null, 2);
        
        await TavernHelper_API.replaceWorldbook(lorebookName, entries);
        return true;

    } catch (er) {
        console.error(`[Phone Sim] Error updating worldbook (${dbName}):`, er);
        return false;
    }
}

export async function deleteContact(contactId) {
    // 1. Delete from main database (contains profile, messages, moments)
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        delete dbData[contactId];
        return dbData;
    });

    // 2. Delete from avatar storage
    await _updateWorldbook(PhoneSim_Config.WORLD_AVATAR_DB_NAME, avatarData => {
        delete avatarData[contactId];
        return avatarData;
    });
    
    // 3. Delete from contacts directory (maps names to IDs)
    await _updateWorldbook(PhoneSim_Config.WORLD_DIR_NAME, dirData => {
        if (dirData && dirData.contacts) {
            for (const name in dirData.contacts) {
                if (dirData.contacts[name] === contactId) {
                    delete dirData.contacts[name];
                }
            }
        }
        return dirData;
    });

    await DataHandler.fetchAllData();
}

export async function addContactManually(id, nickname) {
    // 1. Update the main DB to add the new contact profile
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        if (!dbData[id]) {
            dbData[id] = {
                profile: { nickname: nickname, note: nickname },
                app_data: { WeChat: { messages: [] } },
                moments: []
            };
        }
        return dbData;
    });

    // 2. Update the directory DB for name->ID mapping
    await _updateWorldbook(PhoneSim_Config.WORLD_DIR_NAME, dirData => {
        if (!dirData.contacts) dirData.contacts = {};
        dirData.contacts[nickname] = id;
        return dirData;
    });
    
    // 3. Stage the action for the AI to be notified on the next commit
    stagePlayerAction({
        type: 'manual_add_friend',
        id: id,
        nickname: nickname
    });

    // 4. Refresh the application state from the worldbook to reflect the change immediately
    await DataHandler.fetchAllData();
    
    // 5. Re-render the UI to make the new contact visible everywhere
    UI.rerenderCurrentView({ chatUpdated: true });
}

export async function logCallRecord(callData) {
    await _updateWorldbook(PhoneSim_Config.WORLD_CALL_LOG_DB_NAME, callLogs => {
        callLogs.push(callData);
        if (callLogs.length > 100) {
            callLogs.shift();
        }
        return callLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
}

export async function addWeChatCallEndMessage(contactId, duration) {
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        const contact = dbData[contactId];
        if (contact && contact.app_data && contact.app_data.WeChat) {
            const endMessage = {
                uid: `call_end_${Date.now()}`,
                timestamp: new Date().toISOString(),
                sender_id: PhoneSim_Config.PLAYER_ID, // An action from the player
                content: {
                    type: 'call_end',
                    duration: duration
                }
            };
            contact.app_data.WeChat.messages.push(endMessage);
        }
        return dbData;
    });
}

export async function initiateVoiceCall(contactId) {
    const contactName = UI._getContactName(contactId);
    const prompt = `(系统提示：{{user}}向${contactName}发起了微信语音通话...)`;
    await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`);
    SillyTavern_Context_API.generate();
}

export async function initiatePhoneCall(callTarget) {
    const prompt = `(系统提示：{{user}}正在呼叫${callTarget.name}的电话...)`;
    await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(prompt)}`);
    SillyTavern_Context_API.generate();
    UI.closeCallUI();
    UI.showView('PhoneApp');
}


export async function resetUnreadCount(contactId) {
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        if (dbData[contactId]) {
            dbData[contactId].unread = 0;
        }
        return dbData;
    });
}

export function stagePlayerMessage(contactId, messageContent, replyingToUid = null, descriptionForAI = null) {
    // FIX: Set status to 'unclaimed' for player-sent transactions
    if (typeof messageContent === 'object' && (messageContent.type === 'transfer' || messageContent.type === 'red_packet')) {
        messageContent.status = 'unclaimed';
    }

    const tempMessageObject = {
        uid: `staged_${Date.now()}_${Math.random()}`,
        timestamp: PhoneSim_Parser.getNextPlayerTimestamp(),
        sender_id: PhoneSim_Config.PLAYER_ID,
        content: messageContent,
        isStaged: true,
        replyingTo: replyingToUid
    };
    PhoneSim_State.stagedPlayerMessages.push({ contactId, content: messageContent, descriptionForAI, tempMessageObject });
    UI.renderChatView(contactId, 'WeChat');
    UI.renderContactsList();
    UI.updateCommitButton();
}

export function stagePlayerAction(action) {
    PhoneSim_State.stagedPlayerActions.push(action);
    UI.rerenderCurrentView({ momentsUpdated: true, forumUpdated: true, liveCenterUpdated: true, chatUpdated: true });
    UI.updateCommitButton();
}

export async function stageFriendRequestResponse(uid, action, from_id, from_name) {
    // Find the request in the state and update it visually first
    const request = PhoneSim_State.pendingFriendRequests.find(req => req.uid === uid);
    if (request) {
        request.status = action === 'accept' ? 'accepted' : (action === 'ignore' ? 'declined' : 'pending');
    }
    UI.rerenderCurrentView({ chatUpdated: true });
    
    // Immediately update the worldbook to make the change permanent
    await _updateWorldbook(PhoneSim_Config.WORLD_DIR_NAME, dirData => {
        if (dirData.friend_requests) {
            const reqIndex = dirData.friend_requests.findIndex(r => r.uid === uid);
            if (reqIndex > -1) {
                dirData.friend_requests[reqIndex].status = action === 'accept' ? 'accepted' : 'declined';
            }
        }
        return dirData;
    });
    
    // Stage the action for commit to inform the AI
    PhoneSim_State.stagedPlayerActions.push({ 
        type: 'friend_request_response', 
        uid: uid,
        action: action,
        from_id: from_id,
        from_name: from_name
    });
    
    UI.updateCommitButton();
}

export async function commitStagedActions() {
    const messagesToCommit = [...PhoneSim_State.stagedPlayerMessages];
    const playerActionsToCommit = [...PhoneSim_State.stagedPlayerActions];
    if (messagesToCommit.length === 0 && playerActionsToCommit.length === 0) return;

    PhoneSim_State.stagedPlayerMessages = [];
    PhoneSim_State.stagedPlayerActions = [];
    UI.updateCommitButton();

    let textPrompt = `(系统提示：{{user}}刚刚在手机上进行了如下操作：\\n`;
    let hasActionsForAI = false;
    
    const finalMessagesToPersist = [];
    
    if (messagesToCommit.length > 0) {
        hasActionsForAI = true;
        messagesToCommit.forEach(msg => {
            const contact = PhoneSim_State.contacts[msg.contactId];
            if (!contact) return;
    
            const contactName = contact.profile.groupName || contact.profile.note || contact.profile.nickname || msg.contactId;
            const contentForAI = msg.descriptionForAI || (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            
            if (msg.tempMessageObject.replyingTo) {
                const originalMsg = DataHandler.findMessageByUid(msg.tempMessageObject.replyingTo);
                const originalSender = originalMsg ? UI._getContactName(originalMsg.sender_id) : '某人';
                textPrompt += `- 在[${contact.profile.groupName ? '群聊' : '私聊'}:${contactName}]中回复了${originalSender}的消息，并发送：“${contentForAI}”\\n`;
            } else {
                textPrompt += `- 在[${contact.profile.groupName ? '群聊' : '私聊'}:${contactName}]中发送消息：“${contentForAI}”\\n`;
            }
            
            const finalMessage = { ...msg.tempMessageObject };
            delete finalMessage.isStaged;
            finalMessage.sourceMsgId = null; 
            finalMessagesToPersist.push({ contactId: msg.contactId, message: finalMessage });
        });
    }


    playerActionsToCommit.forEach(action => {
        const isPlayerAction = (
            (action.type === 'delete_moment' && PhoneSim_State.moments.find(m => m.momentId === action.momentId)?.posterId === PhoneSim_Config.PLAYER_ID) ||
            (action.type === 'edit_moment') ||
            (action.type === 'delete_comment' && DataHandler.findMomentCommentByUid(action.commentId)?.commenterId === PhoneSim_Config.PLAYER_ID) ||
            (action.type === 'edit_comment') ||
            (action.type === 'delete_forum_post' && DataHandler.findForumPostById(action.postId)?.authorId === PhoneSim_Config.PLAYER_ID) ||
            (action.type === 'edit_forum_post') ||
            (action.type === 'delete_forum_reply' && DataHandler.findForumReplyById(action.replyId)?.authorId === PhoneSim_Config.PLAYER_ID) ||
            (action.type === 'edit_forum_reply')
        );

        if (action.type.startsWith('delete_') && !isPlayerAction) {
            return; // Skip sending deletion notifications for non-player content
        }
        if (action.type.startsWith('edit_') && !isPlayerAction) {
            return; // Skip sending edit notifications for non-player content
        }

        const group = PhoneSim_State.contacts[action.groupId];
        const groupName = group?.profile.groupName || action.groupId;

        hasActionsForAI = true;
        switch(action.type) {
            case 'manual_add_friend':
                textPrompt += `- 通过手机号“${action.id}”添加了新联系人“${action.nickname}”。\n`;
                break;
            case 'accept_transaction': {
                const transactionMsg = DataHandler.findMessageByUid(action.uid);
                if (transactionMsg) {
                    const senderName = UI._getContactName(transactionMsg.sender_id);
                    const typeText = transactionMsg.content.type === 'red_packet' ? '红包' : '转账';
                    textPrompt += `- 接收了${senderName}的${typeText}。\\n`;
                }
                break;
            }
            case 'create_group': {
                const memberNames = action.memberIds.map(id => `“${UI._getContactName(id)}”`).join('、');
                textPrompt += `- 创建了群聊“${action.groupName}”，并邀请了${memberNames}加入。\\n`;
                break;
            }
            case 'kick_member': {
                const memberName = UI._getContactName(action.memberId);
                textPrompt += `- 在群聊“${groupName}”中将“${memberName}”移出群聊。\\n`;
                break;
            }
            case 'invite_members': {
                const invitedNames = action.memberIds.map(id => `“${UI._getContactName(id)}”`).join('、');
                textPrompt += `- 在群聊“${groupName}”中邀请了${invitedNames}加入群聊。\\n`;
                break;
            }
            case 'new_moment': {
                textPrompt += `- 发表了新动态：“${action.data.content}”` + (action.data.images?.length > 0 ? ' [附图片]' : '') + `\\n`;
                break;
            }
            case 'like': {
                const moment = PhoneSim_State.moments.find(m => m.momentId === action.momentId);
                if (moment) {
                    const posterName = UI._getContactName(moment.posterId);
                    textPrompt += `- 点赞了${posterName}的动态\\n`;
                }
                break;
            }
            case 'comment': {
                const moment = PhoneSim_State.moments.find(m => m.momentId === action.momentId);
                if (moment) {
                    const posterName = UI._getContactName(moment.posterId);
                    textPrompt += `- 评论了${posterName}的动态：“${action.content}”\\n`;
                }
                break;
            }
            case 'edit_comment': {
                const moment = PhoneSim_State.moments.find(m => m.momentId === action.momentId);
                if (moment) {
                    const posterName = UI._getContactName(moment.posterId);
                    textPrompt += `- 修改了对${posterName}动态的评论为：“${action.content}”\\n`;
                }
                break;
            }
            case 'recall_comment': {
                const moment = PhoneSim_State.moments.find(m => m.momentId === action.momentId);
                if (moment) {
                    textPrompt += `- 撤回了对${UI._getContactName(moment.posterId)}动态的一条评论\\n`;
                }
                break;
            }
            case 'delete_comment': {
                textPrompt += `- 删除了自己在一条动态下的评论\\n`;
                break;
            }
            case 'edit_moment': {
                textPrompt += `- 修改了自己的动态：“${action.content}”\\n`;
                break;
            }
            case 'delete_moment': {
                textPrompt += `- 删除了自己发布的一条动态\\n`;
                break;
            }
            case 'friend_request_response': {
                const responseText = action.action === 'accept' ? '接受了' : '忽略了';
                textPrompt += `- ${responseText}${action.from_name}的好友请求\\n`;
                break;
            }
            case 'new_forum_post': {
                textPrompt += `- 在论坛“${action.boardName}”板块发表了新帖子（帖子ID: ${action.postId}），标题为“${action.title}”，内容为“${action.content}”\\n`;
                break;
            }
            case 'new_live_stream': {
                textPrompt += `- 在直播中心“${action.boardName}”板块创建了新的直播间，标题为“${action.title}”，直播简介为“${action.content}”\\n`;
                break;
            }
            case 'new_forum_reply': {
                const post = DataHandler.findForumPostById(action.postId);
                if (post) {
                    const postAuthorName = UI._getContactName(post.authorId);
                    textPrompt += `- 回复了${postAuthorName}的论坛帖子“${post.title}”：“${action.content}”\\n`;
                }
                break;
            }
            case 'like_forum_post': {
                const likedPost = DataHandler.findForumPostById(action.postId);
                if (likedPost) {
                     textPrompt += `- 点赞了${UI._getContactName(likedPost.authorId)}的论坛帖子“${likedPost.title}”\\n`;
                }
                break;
            }
            case 'edit_forum_post': {
                 const editedPost = DataHandler.findForumPostById(action.postId);
                 if(editedPost) {
                    textPrompt += `- 修改了论坛帖子“${editedPost.title}”的内容为：“${action.content}”\\n`;
                 }
                 break;
            }
            case 'delete_forum_post': {
                textPrompt += `- 删除了自己在论坛发表的帖子\\n`;
                break;
            }
            case 'edit_forum_reply': {
                textPrompt += `- 修改了在论坛中的一条回复为：“${action.content}”\\n`;
                break;
            }
            case 'delete_forum_reply': {
                textPrompt += `- 删除了自己在论坛发表的一条回复\\n`;
                break;
            }
            case 'new_danmaku': {
                const stream = DataHandler.findLiveStreamById(action.streamerId);
                if (stream) {
                    textPrompt += `- 在${stream.streamerName}的直播间发送了弹幕：“${action.content}”\\n`;
                }
                break;
            }
        }
    });

    textPrompt += `请根据以上操作，继续推演角色的反应和接下来的剧情。)`;

    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        finalMessagesToPersist.forEach(item => {
            const contactObject = dbData[item.contactId];
            if (contactObject?.app_data?.WeChat) {
                if (!contactObject.app_data.WeChat.messages) contactObject.app_data.WeChat.messages = [];
                contactObject.app_data.WeChat.messages.push(item.message);
            }
        });
        
        playerActionsToCommit.forEach(action => {
             switch(action.type) {
                case 'delete_moment':
                    for (const contactId in dbData) {
                        if(dbData[contactId].moments) {
                            dbData[contactId].moments = dbData[contactId].moments.filter(m => m.momentId !== action.momentId);
                        }
                    }
                    break;
                case 'delete_comment':
                    for (const contactId in dbData) {
                        const moment = dbData[contactId].moments?.find(m => m.momentId === action.momentId);
                        if(moment && moment.comments) {
                            moment.comments = moment.comments.filter(c => c.uid !== action.commentId);
                        }
                    }
                    break;
                case 'edit_moment':
                    for (const contactId in dbData) {
                        const moment = dbData[contactId].moments?.find(m => m.momentId === action.momentId);
                        if (moment) { moment.content = action.content; break; }
                    }
                    break;
                case 'edit_comment':
                     for (const contactId in dbData) {
                        const moment = dbData[contactId].moments?.find(m => m.momentId === action.momentId);
                        if (moment) {
                            const comment = moment.comments?.find(c => c.uid === action.commentId);
                            if (comment) { comment.text = action.content; break; }
                        }
                    }
                    break;
             }
        });

        return dbData;
    });

    const forumActions = playerActionsToCommit.filter(a => a.type.includes('forum'));
    if (forumActions.length > 0) {
        await _updateWorldbook(PhoneSim_Config.WORLD_FORUM_DATABASE, forumDb => {
            forumActions.forEach(action => {
                 if (action.type === 'new_forum_post') {
                    const boardId = action.boardId || action.boardName.toLowerCase().replace(/\s/g, '_');
                    if (!forumDb[boardId]) {
                        forumDb[boardId] = { boardName: action.boardName, posts: [] };
                    }
                    const newPost = {
                        postId: action.postId, boardId: boardId, authorId: PhoneSim_Config.PLAYER_ID,
                        authorName: PhoneSim_State.customization.playerNickname || '我', title: action.title,
                        content: action.content, timestamp: new Date().toISOString(), replies: [], likes: [],
                    };
                    forumDb[boardId].posts.push(newPost);
                } else if (action.type === 'new_forum_reply') {
                    for (const boardId in forumDb) {
                        const post = forumDb[boardId].posts?.find(p => p.postId === action.postId);
                        if (post) {
                            if (!post.replies) post.replies = [];
                            post.replies.push({
                                replyId: action.replyId, postId: action.postId, authorId: PhoneSim_Config.PLAYER_ID,
                                authorName: PhoneSim_State.customization.playerNickname || '我', content: action.content,
                                timestamp: new Date().toISOString()
                            });
                            break;
                        }
                    }
                } else if (action.type === 'like_forum_post') {
                     for (const boardId in forumDb) {
                        const post = forumDb[boardId].posts?.find(p => p.postId === action.postId);
                         if (post) {
                             if (!post.likes) post.likes = [];
                             if (!post.likes.includes(PhoneSim_Config.PLAYER_ID)) {
                                 post.likes.push(PhoneSim_Config.PLAYER_ID);
                             }
                             break;
                         }
                     }
                } else if (action.type === 'delete_forum_post') {
                     for (const boardId in forumDb) {
                         if (forumDb[boardId].posts) {
                             forumDb[boardId].posts = forumDb[boardId].posts.filter(p => p.postId !== action.postId);
                         }
                     }
                } else if (action.type === 'delete_forum_reply') {
                    for (const boardId in forumDb) {
                        for (const post of (forumDb[boardId].posts || [])) {
                            if (post.replies) {
                                post.replies = post.replies.filter(r => r.replyId !== action.replyId);
                            }
                        }
                    }
                } else if (action.type === 'edit_forum_post') {
                    for (const boardId in forumDb) {
                        const post = forumDb[boardId].posts?.find(p => p.postId === action.postId);
                        if (post) { post.content = action.content; break; }
                    }
                } else if (action.type === 'edit_forum_reply') {
                     for (const boardId in forumDb) {
                        for (const post of (forumDb[boardId].posts || [])) {
                            const reply = post.replies?.find(r => r.replyId === action.replyId);
                            if (reply) { reply.content = action.content; break; }
                        }
                    }
                }
            });
            return forumDb;
        });
    }

    if (hasActionsForAI) {
        try {
            await TavernHelper_API.triggerSlash(`/setinput ${JSON.stringify(textPrompt)}`);
            SillyTavern_Context_API.generate();
        } catch (error) {
            console.error('[Phone Sim] Failed to commit actions:', error);
        }
    }
    
    await DataHandler.fetchAllData();
    UI.rerenderCurrentView({ forceRerender: true });
}

export async function saveCustomization() {
    try {
        parentWin.localStorage.setItem(PhoneSim_Config.STORAGE_KEY_CUSTOMIZATION, JSON.stringify(PhoneSim_State.customization));
        UI.applyCustomizations();
        // Also re-render relevant views if visible
        if(PhoneSim_State.isPanelVisible) {
            if (PhoneSim_State.currentView === 'ChatApp' && PhoneSim_State.activeSubviews.chatapp === 'me') {
                UI.renderMeView();
            }
            if (PhoneSim_State.activeContactId) {
                UI.renderChatView(PhoneSim_State.activeContactId, 'WeChat');
            }
        }

    } catch (er) {
        console.error('[Phone Sim] Failed to save customization to localStorage:', er);
    }
}

export async function savePlayerNickname(newName) {
    PhoneSim_State.customization.playerNickname = newName;
    saveCustomization();
}

export async function resetAllData() {
    const lorebookName = await getOrCreatePhoneLorebook();
    if (!lorebookName) {
        console.error("[Phone Sim] Cannot reset data: Could not determine lorebook.");
        return;
    }

    try {
        // We replace the content of the existing lorebook with a fresh structure.
        await TavernHelper_API.replaceWorldbook(lorebookName, PhoneSim_Config.INITIAL_LOREBOOK_ENTRIES);

        // Clear customization from local storage
        parentWin.localStorage.removeItem(PhoneSim_Config.STORAGE_KEY_CUSTOMIZATION);
        PhoneSim_State.loadCustomization(); // Reload defaults
        UI.applyCustomizations();
        
        console.log('[Phone Sim] All data has been reset.');

    } catch (err) {
        console.error('[Phone Sim] An error occurred during data reset:', err);
    }
}


export async function saveContactAvatar(contactId, base64data) {
    await _updateWorldbook(PhoneSim_Config.WORLD_AVATAR_DB_NAME, avatarData => {
        avatarData[contactId] = base64data;
        return avatarData;
    });

    if (contactId !== PhoneSim_Config.PLAYER_ID) {
        await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
            if (dbData[contactId] && dbData[contactId].profile) {
                // For both users and groups, we set a flag. The fetcher will handle loading.
                dbData[contactId].profile.has_custom_avatar = true;
            }
            return dbData;
        });
    }
    
    await DataHandler.fetchAllContacts();

    // Rerender UI based on visibility
    if (PhoneSim_State.isPanelVisible) {
        const currentView = PhoneSim_State.currentView;
        if (currentView === 'ChatConversation' && PhoneSim_State.activeContactId === contactId) {
            UI.renderChatView(contactId, 'WeChat');
        } else if (currentView === 'Homepage' && PhoneSim_State.activeProfileId === contactId) {
            UI.renderHomepage(contactId);
        }
        UI.renderContactsList();
        UI.renderContactsView();
        UI.renderPhoneContactList();
    }
}

export async function updateContactNote(contactId, newNote) {
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        const contact = dbData[contactId];
        if (contact && contact.profile) {
            contact.profile.note = newNote;
        }
        return dbData;
    });
}

// --- MESSAGE ACTION FUNCTIONS ---
export function findMessageByUid(messageUid, dbData = null) {
    const data = dbData || PhoneSim_State.contacts;
    
    const stagedMsgContainer = PhoneSim_State.stagedPlayerMessages.find(m => m.tempMessageObject.uid === messageUid);
    if (stagedMsgContainer) {
        return stagedMsgContainer.tempMessageObject;
    }

    for (const contactId in data) {
        const messages = data[contactId].app_data?.WeChat?.messages;
        if (messages) {
            const msg = messages.find(msg => msg.uid === messageUid);
            if (msg) return msg;
        }
    }
    return null;
}

export function findMomentCommentByUid(commentUid) {
    for (const moment of PhoneSim_State.moments) {
        const comment = moment.comments?.find(c => c.uid === commentUid);
        if (comment) return comment;
    }
    // Also check staged actions
    for (const action of PhoneSim_State.stagedPlayerActions) {
        if (action.type === 'comment' && action.commentId === commentUid) {
            return { uid: action.commentId, commenterId: PhoneSim_Config.PLAYER_ID, text: action.content, isStaged: true };
        }
    }
    return null;
}

async function _findAndModifyMessage(messageUid, modifierFn) {
    const stagedIndex = PhoneSim_State.stagedPlayerMessages.findIndex(m => m.tempMessageObject.uid === messageUid);
    if (stagedIndex > -1) {
        const result = modifierFn(PhoneSim_State.stagedPlayerMessages[stagedIndex].tempMessageObject);
        if (result === null) { 
            PhoneSim_State.stagedPlayerMessages.splice(stagedIndex, 1);
        } else {
            PhoneSim_State.stagedPlayerMessages[stagedIndex].tempMessageObject = result;
            if (typeof result.content === 'string') {
                PhoneSim_State.stagedPlayerMessages[stagedIndex].content = result.content;
            }
        }
        return 'staged';
    }

    let messageFoundInWorldbook = false;
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        for (const contactId in dbData) {
            const messages = dbData[contactId].app_data?.WeChat?.messages;
            if (messages) {
                const msgIndex = messages.findIndex(msg => msg.uid === messageUid);
                if (msgIndex > -1) {
                    const result = modifierFn(messages[msgIndex]);
                    if (result === null) {
                        messages.splice(msgIndex, 1);
                    } else {
                        messages[msgIndex] = result;
                    }
                    messageFoundInWorldbook = true;
                    break;
                }
            }
        }
        return dbData;
    });

    return messageFoundInWorldbook ? 'worldbook' : null;
}

export async function deleteMessageByUid(uid) {
    return await _findAndModifyMessage(uid, () => null);
}

export async function editMessageByUid(uid, newContent) {
    return await _findAndModifyMessage(uid, (msg) => {
        msg.content = newContent;
        if (msg.recalled) { delete msg.recalled; }
        return msg;
    });
}

export async function recallMessageByUid(uid) {
    return await _findAndModifyMessage(uid, (msg) => {
        const senderName = msg.sender_id === PhoneSim_Config.PLAYER_ID ? '你' : UI._getContactName(msg.sender_id);
        msg.content = `${senderName}撤回了一条消息`;
        msg.recalled = true;
        return msg;
    });
}

export async function markEmailAsRead(emailId) {
    await _updateWorldbook(PhoneSim_Config.WORLD_EMAIL_DB_NAME, emails => {
        const email = emails.find(e => e.id === emailId);
        if (email) {
            email.read = true;
        }
        return emails;
    });
}

// --- NEWLY IMPLEMENTED FUNCTIONS ---

export async function deleteEmailById(emailId) {
    await _updateWorldbook(PhoneSim_Config.WORLD_EMAIL_DB_NAME, emails => {
        return emails.filter(e => e.id !== emailId);
    });
}

export async function deleteCallLogByTimestamp(timestamp) {
    await _updateWorldbook(PhoneSim_Config.WORLD_CALL_LOG_DB_NAME, callLogs => {
        return callLogs.filter(log => log.timestamp !== timestamp);
    });
}

export async function deleteForumBoard(boardId) {
    await _updateWorldbook(PhoneSim_Config.WORLD_FORUM_DATABASE, forumData => {
        delete forumData[boardId];
        return forumData;
    });
}

export async function clearAllChatHistory() {
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        for (const contactId in dbData) {
            const contact = dbData[contactId];
            if (contact?.app_data?.WeChat) {
                contact.app_data.WeChat.messages = [];
            }
            if (contact) {
                contact.unread = 0;
            }
        }
        return dbData;
    });
}

export async function clearAllMoments() {
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        for (const contactId in dbData) {
            if (dbData[contactId]) {
                dbData[contactId].moments = [];
            }
        }
        return dbData;
    });
}

export async function clearAllForumData() {
    await _updateWorldbook(PhoneSim_Config.WORLD_FORUM_DATABASE, () => ({}));
}

export async function clearAllLiveData() {
    await _updateWorldbook(PhoneSim_Config.WORLD_LIVECENTER_DATABASE, () => ({}));
}

export async function clearChatHistoryForContact(contactId) {
    await _updateWorldbook(PhoneSim_Config.WORLD_DB_NAME, dbData => {
        const contact = dbData[contactId];
        if (contact?.app_data?.WeChat) {
            contact.app_data.WeChat.messages = [];
        }
        if (contact) {
            contact.unread = 0;
        }
        return dbData;
    });
}
