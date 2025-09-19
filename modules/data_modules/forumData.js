

import { PhoneSim_State } from '../state.js';

export function init(deps, uiHandler, dataHandler) {
    // No initialization needed for this utility module
}

export function findForumPostById(postId) {
    // First, check staged new posts
    const stagedPostAction = PhoneSim_State.stagedPlayerActions.find(a => a.type === 'new_forum_post' && a.postId === postId);
    if (stagedPostAction) {
        return {
            postId: stagedPostAction.postId,
            authorId: PhoneSim_Config.PLAYER_ID,
            title: stagedPostAction.title,
            content: stagedPostAction.content,
            timestamp: new Date().toISOString(),
            replies: [],
            likes: [],
            isStaged: true
        };
    }

    // Then, check persisted data
    for (const boardId in PhoneSim_State.forumData) {
        const board = PhoneSim_State.forumData[boardId];
        const post = board.posts?.find(p => p.postId === postId);
        if (post) {
            return post;
        }
    }
    return null;
}


export function findForumReplyById(replyId) {
    // First, check staged new replies
    const stagedReplyAction = PhoneSim_State.stagedPlayerActions.find(a => a.type === 'new_forum_reply' && a.replyId === replyId);
    if (stagedReplyAction) {
        return {
            replyId: stagedReplyAction.replyId,
            postId: stagedReplyAction.postId,
            authorId: 'PLAYER_USER',
            content: stagedReplyAction.content,
            timestamp: new Date().toISOString(),
            isStaged: true
        };
    }

    // Then, check persisted data
    for (const boardId in PhoneSim_State.forumData) {
        const board = PhoneSim_State.forumData[boardId];
        for (const post of (board.posts || [])) {
            const reply = post.replies?.find(r => r.replyId === replyId);
            if (reply) return reply;
        }
    }
    return null;
}