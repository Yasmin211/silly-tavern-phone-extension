import { PhoneSim_Config } from '../config.js';
import { PhoneSim_State } from './state.js';

export const PhoneSim_Parser = {
     _parseContent: function(contentStr) {
        if (typeof contentStr !== 'string' || !contentStr.trim()) return contentStr;

        const patterns = [
            { type: 'image',      regex: /\[Image:([\s\S]+?)\]/g },
            { type: 'voice',      regex: /\[Voice:([^|]+)\|([\s\S]+?)\]/g, groups: ['duration', 'text'] },
            { type: 'transfer',   regex: /\[Transfer:([^|]+)\|([\s\S]*?)\]/g, groups: ['amount', 'note'] },
            { type: 'red_packet', regex: /\[RedPacket:([^|]+)\|([\s\S]*?)\]/g, groups: ['amount', 'note'] },
            { type: 'location',   regex: /\[Location:([\s\S]+?)\]/g,      groups: ['text'] }
        ];

        const combinedRegex = new RegExp(patterns.map(p => `(${p.regex.source})`).join('|'), 'g');
        
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = combinedRegex.exec(contentStr)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', value: contentStr.substring(lastIndex, match.index) });
            }

            const matchedString = match[0];
            let foundPattern = false;

            for(let i = 0; i < patterns.length; i++) {
                const pat = patterns[i];
                const individualRegex = new RegExp(`^${pat.regex.source}$`);
                const individualMatch = matchedString.match(individualRegex);
                
                if (individualMatch) {
                    const obj = { type: pat.type };
                    if (pat.type === 'image') {
                        const imageContent = individualMatch[1].trim();
                        const catboxRegex = /([a-z0-9]{6}\.(?:jpeg|jpg|png|gif|webp))/i;
                        const catboxMatch = imageContent.match(catboxRegex);

                        if (catboxMatch && catboxMatch[1]) {
                            obj.url = 'https://files.catbox.moe/' + catboxMatch[1];
                        } else if (imageContent.startsWith('http') || /^[a-zA-Z0-9_-]+\.(?:jpeg|jpg|png|gif|webp)$/i.test(imageContent)) {
                            obj.url = imageContent.startsWith('http') ? imageContent : 'https://files.catbox.moe/' + imageContent;
                        } else {
                            obj.type = 'pseudo_image';
                            obj.text = imageContent;
                        }
                    } else {
                        pat.groups.forEach((groupName, groupIndex) => {
                            obj[groupName] = (individualMatch[groupIndex + 1] || '').trim();
                        });
                    }
                    parts.push(obj);
                    foundPattern = true;
                    break;
                }
            }
            lastIndex = combinedRegex.lastIndex;
        }

        if (lastIndex < contentStr.length) {
            parts.push({ type: 'text', value: contentStr.substring(lastIndex) });
        }

        if (parts.length === 0) return contentStr;
        if (parts.length === 1 && parts[0].type === 'text') return parts[0].value;
        if (parts.length === 1) return parts[0];

        return parts;
    },

    _parseSimpleKeyValue: function(str) {
        const params = {};
        const pairs = str.split(/,(?=\s*\w+:)/);
        for(const pair of pairs) {
            const separatorIndex = pair.indexOf(':');
            if (separatorIndex > 0) {
                const key = pair.substring(0, separatorIndex).trim();
                const value = pair.substring(separatorIndex + 1).trim();
                if (key) params[key] = value;
            }
        }
        return params;
    },

    parseCommand: function(r) {
        const trimmed = r.trim();
        const commandMatch = trimmed.match(/^\s*\[app:([^,]+),\s*([\s\S]+)\]\s*$/);
        if (!commandMatch) return null;

        const [, appName, paramsStr] = commandMatch;

        const typeMatch = /type:\s*([^,]+)/.exec(paramsStr);
        if (!typeMatch) return null;
        const type = typeMatch[1].trim();

        const isDataJsonCommand = (appName === 'WeChat' && ['New Moment', 'Update Profile', 'Update Moment'].includes(type)) 
                                || (appName === 'Forum' && ['New Post', 'New Reply'].includes(type))
                                || (appName === 'LiveCenter' && ['Directory Update', 'Stream Status'].includes(type));
        const isBrowserWebpage = (appName === 'Browser' && type === 'Webpage');

        if (isDataJsonCommand) {
            const dataMatch = /data:\s*({.*})/s.exec(paramsStr);
            if (!dataMatch || !dataMatch[1]) {
                console.error(`[Phone Sim] ERROR: '${type}' command in app '${appName}' requires 'data:{...}' JSON format. Instruction:`, r);
                return null;
            }
            try {
                const jsonData = JSON.parse(dataMatch[1]);
                if (appName === 'Forum') {
                    if (jsonData.content) jsonData.content = this._parseContent(jsonData.content);
                    return { commandType: 'Forum', app: 'Forum', type: type, data: jsonData };
                }
                if (appName === 'LiveCenter') {
                    return { commandType: 'LiveCenter', app: 'LiveCenter', type: type, data: jsonData };
                }
                if (type === 'New Moment') {
                    const commentsWithId = (jsonData.comments || []).map(c => ({...c, uid: 'comment_' + Date.now() + Math.random()}));
                    return {
                        commandType: 'Moment',
                        app: 'WeChat',
                        type: 'New Moment',
                        momentId: jsonData.moment_id,
                        posterId: jsonData.poster_id,
                        posterName: jsonData.poster_nickname,
                        time: jsonData.time,
                        content: this._parseContent(jsonData.content || ''),
                        images: jsonData.images || [],
                        location: jsonData.location,
                        likes: jsonData.likes || [],
                        comments: commentsWithId
                    };
                } else if (type === 'Update Profile') {
                    return {
                        commandType: 'ProfileUpdate',
                        app: 'WeChat',
                        type: 'Update Profile',
                        profileId: jsonData.profile_id,
                        data: jsonData
                    };
                } else if (type === 'Update Moment') {
                    return {
                        commandType: 'MomentUpdate',
                        app: 'WeChat',
                        type: 'Update Moment',
                        ...jsonData
                    };
                }
            } catch (e) {
                console.error(`[Phone Sim] Failed to parse ${appName} JSON:`, e, "\nJSON String:", dataMatch[1]);
                return null;
            }
        }
        
        if (isBrowserWebpage) {
             const urlMatch = /url:\s*([^,]+)/.exec(paramsStr);
             const titleMatch = /title:\s*([^,]+)/.exec(paramsStr);
             const contentKey = 'content:';
             const contentIndex = paramsStr.indexOf(contentKey);

             if (!urlMatch || !titleMatch || contentIndex === -1) {
                 console.error("[Phone Sim] Malformed 'Webpage' command. Missing url, title, or content.", r);
                 return null;
             }
             
             const contentStr = paramsStr.substring(contentIndex + contentKey.length).trim();

             try {
                 const content = JSON.parse(contentStr);
                 const processedContent = content.map(block => ({
                     ...block,
                     text: this._parseContent(block.text)
                 }));

                 return {
                     commandType: 'Browser',
                     app: 'Browser',
                     type: 'Webpage',
                     url: urlMatch[1].trim(),
                     title: titleMatch[1].trim(),
                     content: processedContent
                 };
             } catch (e) {
                 console.error("[Phone Sim Parser] Failed to parse browser webpage content JSON:", e, contentStr);
                 return null;
             }
        }


        const params = this._parseSimpleKeyValue(paramsStr);
        if (!params.type) return null;

        const finalMessage = { app: appName, ...params };

        if (finalMessage.app === 'Browser' && params.type === 'Search Directory') {
            return {
                commandType: 'Browser',
                app: 'Browser',
                type: 'Search Directory',
                title: params.title,
                url: params.url,
                snippet: params.snippet
            };
        }
        
        if (finalMessage.app === 'WeChat') {
             if (params.type === 'Private Message') {
                if (params.from_id && params.to_id) { // New directed message format
                    const isFromPlayer = params.from_id === '{{user}}' || params.from_id === PhoneSim_Config.PLAYER_ID;
                    const isToPlayer = params.to_id === '{{user}}' || params.to_id === PhoneSim_Config.PLAYER_ID;

                    if (isFromPlayer && !isToPlayer) { // Player -> NPC
                        finalMessage.commandType = 'Chat';
                        finalMessage.contactId = params.to_id;
                        finalMessage.senderId = PhoneSim_Config.PLAYER_ID;
                        finalMessage.content = this._parseContent(params.content || '');
                    } else if (!isFromPlayer && isToPlayer) { // NPC -> Player
                        finalMessage.commandType = 'Chat';
                        finalMessage.contactId = params.from_id;
                        finalMessage.senderId = params.from_id;
                        let nickname = params.from_name, note = params.from_name;
                        const nameMatch = params.from_name.match(/(.*?)\s*\(([^)]+)\)/);
                        if (nameMatch) { nickname = nameMatch[1].trim(); note = nameMatch[2].trim(); }
                        finalMessage.profile = { nickname: nickname, note: note };
                        finalMessage.content = this._parseContent(params.content || '');
                    } else {
                        console.warn(`[Phone Sim] Unsupported directed message: ${params.from_id} to ${params.to_id}`);
                        return null;
                    }
                } else { // Legacy format for backwards compatibility (NPC -> Player)
                    finalMessage.commandType = 'Chat';
                    finalMessage.contactId = params.id;
                    finalMessage.senderId = params.id; // Sender is the contact
                    let nickname = params.name, note = params.name;
                    const nameMatch = params.name.match(/(.*?)\s*\(([^)]+)\)/);
                    if (nameMatch) { nickname = nameMatch[1].trim(); note = nameMatch[2].trim(); }
                    finalMessage.profile = { nickname: nickname, note: note };
                    finalMessage.content = this._parseContent(params.content || '');
                }
            } else if (params.type === 'Group Chat') {
                finalMessage.commandType = 'Chat';
                finalMessage.groupId = params.group_id;
                finalMessage.groupName = params.group_name;
                finalMessage.senderId = params.sender_id;
                finalMessage.senderProfile = { nickname: params.sender_name, note: params.sender_name };
                finalMessage.content = this._parseContent(params.content || '');
            } else if (params.type === 'Voice') {
                finalMessage.commandType = 'VoiceCall';
                finalMessage.id = params.id;
                finalMessage.name = params.name;
                finalMessage.content = params.content;
                finalMessage.contactId = params.id;
            } else if (params.type === 'System Prompt') {
                const content = params.content || '';
                if (content.includes('requests to add you as a friend')) {
                    const nameMatch = content.match(/“(.+)” requests to add you as a friend/);
                    finalMessage.interactiveType = 'friend_request';
                    finalMessage.from_id = params.contact_id;
                    finalMessage.from_name = nameMatch ? nameMatch[1] : params.contact_id;
                    finalMessage.content = 'requests to add you as a friend';
                } else {
                    finalMessage.commandType = 'Chat';
                    finalMessage.isSystemNotification = true;
                    finalMessage.contactId = params.contact_id;
                    finalMessage.content = this._parseContent(content);
                }
            } else if (params.type === 'Friend Request') {
                finalMessage.interactiveType = 'friend_request';
                // BUG FIX: Add backward compatibility and fallbacks to prevent undefined names
                if (params.id && !params.from_id) finalMessage.from_id = params.id;
                if (params.name && !params.from_name) finalMessage.from_name = params.name;
                if (!finalMessage.from_name) finalMessage.from_name = finalMessage.from_id;

            } else {
                return null;
            }
            return finalMessage;
        }

        if (finalMessage.app === 'Phone' && params.type === 'Phone') {
            finalMessage.commandType = 'PhoneCall';
            finalMessage.id = params.id;
            finalMessage.name = params.name;
            finalMessage.content = params.content;
            finalMessage.contactId = params.id;
            return finalMessage;
        }
        
        if (finalMessage.app === 'Email' && params.type === 'New') {
            finalMessage.commandType = 'App';
            return finalMessage;
        }
        
        if (finalMessage.app === 'Phone' && params.type === 'IncomingCall') {
            finalMessage.commandType = 'App';
            return finalMessage;
        }

        return null;
    },
    
    updateWorldDate: function(r) {
        const m = r.match(PhoneSim_Config.WORLD_STATE_REGEX);
        if (m && m[1] && m[2]) {
            PhoneSim_State.worldTime = m[2].trim();
            const datePart = m[1].match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
            if (datePart) {
                const [, y, M, D] = datePart.map(Number);
                const p = new Date(y, M - 1, D, 12, 0, 0);
                if (!isNaN(p.getTime())) PhoneSim_State.worldDate = p;
            }
        }
    },
    buildTimestamp: function(t, lastTimestampStr) {
        if (isNaN(PhoneSim_State.worldDate.getTime())) {
            PhoneSim_State.worldDate = new Date();
        }
        const [h, m] = t.split(':').map(Number);
    
        let baseDate = new Date(PhoneSim_State.worldDate);
    
        if (lastTimestampStr) {
            const lastDate = new Date(lastTimestampStr);
            const lastTime = lastDate.getHours() * 60 + lastDate.getMinutes();
            const currentTime = h * 60 + m;
    
            if (currentTime < lastTime) {
                baseDate = new Date(lastDate.getTime());
                baseDate.setDate(baseDate.getDate() + 1);
            } else {
                baseDate = new Date(lastDate.getTime());
            }
        }
    
        baseDate.setHours(h, m, 0, 0);
        return baseDate.toISOString();
    },
    getNextPlayerTimestamp: function() {
        let l = new Date();
        if (PhoneSim_State.activeContactId && PhoneSim_State.contacts[PhoneSim_State.activeContactId]) {
            const c = PhoneSim_State.contacts[PhoneSim_State.activeContactId];
            const allMessages = [ ...(c.app_data?.WeChat?.messages || []), ...(PhoneSim_State.stagedPlayerMessages.filter(msg => msg.contactId === PhoneSim_State.activeContactId).map(m => m.tempMessageObject) || []) ];
            allMessages.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            const a = allMessages.slice(-1)[0];
            if (a) { l = new Date(a.timestamp); l.setMinutes(l.getMinutes() + 1); }
        }
        return l.toISOString();
    }
};
