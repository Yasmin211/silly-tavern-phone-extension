

import { PhoneSim_Config } from '../../config.js';
import { PhoneSim_State } from '../state.js';

let jQuery_API, parentWin, TavernHelper_API, st_api, UI, DataHandler;

const PRESET_BOARDS = {
    "campus_life": "Campus Life",
    "academic_exchange": "Academic Exchange"
};

export function init(deps, dataHandler, uiObject) {
    jQuery_API = deps.jq;
    parentWin = deps.win;
    TavernHelper_API = deps.th;
    st_api = deps.st; // Use a module-local variable to prevent scope conflicts
    UI = uiObject;
    DataHandler = dataHandler;
}

function getPostDetailSkeleton() {
    return `
    <div class="skeleton-forum-post-detail">
        <div class="skeleton title"></div>
        <div class="skeleton meta"></div>
        <div class="skeleton text"></div>
        <div class="skeleton text long"></div>
        <div class="skeleton text"></div>
        <div class="skeleton text short"></div>
    </div>`;
}

function _getSnippetFromRichContent(content) {
    let text = '';
    if (typeof content === 'string') {
        text = content;
    } else if (Array.isArray(content)) {
        text = content.map(part => {
            if (part.type === 'text') return part.value;
            if (part.type === 'image' || part.type === 'pseudo_image') return '[Image]';
            return '';
        }).join(' ');
    } else if (typeof content === 'object' && content !== null) {
        if (content.type === 'image' || content.type === 'pseudo_image') return '[Image]';
    }
    const cleanedText = text.replace(/\\n/g, ' ');
    return cleanedText.substring(0, 50) + (cleanedText.length > 50 ? '...' : '');
}

export function renderForumBoardList() {
    const content = jQuery_API(parentWin.document.body).find(`#phone-sim-panel-v10-0 .forum-board-list-content`).empty();
    const forumData = PhoneSim_State.forumData;
    
    const boardIcons = {
        "campus_life": "fa-comments",
        "academic_exchange": "fa-flask",
        "default": "fa-list-alt"
    };

    // Render Preset "Hot" Boards
    content.append('<div class="forum-board-group-title">Hot Boards</div>');
    for (const boardId in PRESET_BOARDS) {
        const boardName = PRESET_BOARDS[boardId];
        const icon = boardIcons[boardId] || boardIcons["default"];
        const itemHtml = `
            <div class="forum-board-item" data-board-id="${boardId}">
                <i class="fas ${icon} forum-board-icon"></i>
                <span class="forum-board-name">${boardName}</span>
                <div class="forum-item-actions">
                    <button class="generate-content-btn" data-type="forum" data-board-id="${boardId}" data-board-name="${boardName}" title="Generate new content"><i class="fas fa-plus"></i></button>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
        content.append(itemHtml);
    }

    // Render User-created boards
    const customBoards = Object.keys(forumData).filter(id => !PRESET_BOARDS[id]);
    if (customBoards.length > 0) {
        content.append('<div class="forum-board-group-title">My Boards</div>');
        customBoards.forEach(boardId => {
            const board = forumData[boardId];
            const icon = boardIcons["default"];
             const itemHtml = `
                <div class="forum-board-item" data-board-id="${boardId}" data-board-name="${board.boardName}">
                    <i class="fas ${icon} forum-board-icon"></i>
                    <span class="forum-board-name">${board.boardName}</span>
                    <div class="forum-item-actions">
                        <button class="delete-board-btn" title="Delete board"><i class="fas fa-trash-alt"></i></button>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
            content.append(itemHtml);
        });
    }
}

export async function renderForumPostList(boardId) {
    const view = jQuery_API(parentWin.document.body).find('#forumpostlist-view');
    const boardName = PRESET_BOARDS[boardId] || PhoneSim_State.forumData[boardId]?.boardName || 'Board';
    view.find('.app-header h3').text(boardName);
    const content = view.find('.forum-post-list-content').empty();
    
    const boardData = PhoneSim_State.forumData[boardId];
    let posts = boardData?.posts || [];
    
    const stagedPosts = PhoneSim_State.stagedPlayerActions
        .filter(a => a.type === 'new_forum_post' && (a.boardId === boardId || a.boardName === boardName))
        .map(a => ({
            postId: a.postId,
            authorId: PhoneSim_Config.PLAYER_ID,
            title: a.title,
            content: a.content,
            timestamp: new Date().toISOString(),
            replies: [],
            likes: [],
            isStaged: true
        }));
        
    const deletedPostIds = new Set(PhoneSim_State.stagedPlayerActions.filter(a => a.type === 'delete_forum_post').map(a => a.postId));
    posts = posts.filter(p => !deletedPostIds.has(p.postId));

    const allPosts = [...stagedPosts, ...posts].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (allPosts.length === 0) {
        content.html('<div class="email-empty-state">This board has no posts yet</div>');
        return;
    }

    allPosts.forEach(post => {
        const authorName = UI._getContactName(post.authorId);
        const authorAvatar = UI.generateDefaultAvatar(authorName);
        const snippet = _getSnippetFromRichContent(post.content);
        const replyCount = post.replies?.length || 0;
        const likeCount = post.likes?.length || 0;

        const itemHtml = `
            <div class="forum-post-item search-filterable-item ${post.isStaged ? 'staged' : ''}" data-post-id="${post.postId}">
                <h4 class="post-item-title">${post.title}</h4>
                <p class="post-item-snippet">${snippet}</p>
                <div class="post-item-meta">
                    <div class="post-item-author">
                        <img src="${authorAvatar}" class="post-item-author-avatar">
                        <span>${authorName}</span>
                    </div>
                    <div class="post-item-stats">
                        <span><i class="fas fa-thumbs-up"></i> ${likeCount}</span>
                        <span><i class="fas fa-comment"></i> ${replyCount}</span>
                    </div>
                </div>
            </div>
        `;
        content.append(itemHtml);
    });
}

export function renderForumPostDetail(postId) {
    const view = jQuery_API(parentWin.document.body).find('#forumpostdetail-view');
    const content = view.find('.forum-post-detail-content').empty();
    const postFromState = DataHandler.findForumPostById(postId);

    if (!postFromState) {
        content.html(getPostDetailSkeleton());
        return;
    }
    
    if (PhoneSim_State.stagedPlayerActions.some(a => a.type === 'delete_forum_post' && a.postId === postId)) {
        content.html('<p style="text-align:center; padding: 20px;">Post has been deleted.</p>');
        return;
    }

    const post = JSON.parse(JSON.stringify(postFromState));

    PhoneSim_State.stagedPlayerActions.forEach(action => {
        if (action.postId === postId) {
            if (action.type === 'edit_forum_post') {
                post.content = action.content;
                post.isStaged = true;
            }
        }
    });
    
    const stagedReplies = PhoneSim_State.stagedPlayerActions
        .filter(a => a.type === 'new_forum_reply' && a.postId === postId)
        .map(a => ({
            replyId: a.replyId,
            authorId: PhoneSim_Config.PLAYER_ID,
            authorName: PhoneSim_State.customization.playerNickname || 'Me',
            content: a.content,
            timestamp: new Date().toISOString(),
            isStaged: true
        }));
    
    if (PhoneSim_State.stagedPlayerActions.some(a => a.type === 'like_forum_post' && a.postId === postId)) {
        if (!post.likes) post.likes = [];
        if (!post.likes.includes(PhoneSim_Config.PLAYER_ID)) {
            post.likes.push(PhoneSim_Config.PLAYER_ID);
        }
    }
    
    const deletedReplyIds = new Set(PhoneSim_State.stagedPlayerActions.filter(a => a.type === 'delete_forum_reply').map(a => a.replyId));
    let finalReplies = (post.replies || []).filter(r => !deletedReplyIds.has(r.replyId));

    PhoneSim_State.stagedPlayerActions.forEach(action => {
        if(action.type === 'edit_forum_reply') {
            const reply = finalReplies.find(r => r.replyId === action.replyId);
            if(reply) {
                reply.content = action.content;
                reply.isStaged = true;
            }
        }
    });
    
    const allReplies = [...stagedReplies, ...finalReplies].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    const authorName = UI._getContactName(post.authorId);
    const authorAvatar = UI.generateDefaultAvatar(authorName);
    const postBodyHtml = UI.renderRichContent(post.content);

    const actionsTriggerHtml = `<div class="forum-actions-trigger" data-author-id="${post.authorId}" data-post-id="${post.postId}"><i class="fas fa-ellipsis-h"></i></div>`;

    let tagsHtml = '';
    if (post.tags && Array.isArray(post.tags) && post.tags.length > 0) {
        tagsHtml = `<div class="post-detail-tags">
            ${post.tags.map(tag => `<span>${jQuery_API('<div>').text(tag).html()}</span>`).join('')}
        </div>`;
    }

    const postHtml = `
        <div class="post-main-content">
            <div class="post-detail-header">
                <h3 class="post-detail-title">${post.title}</h3>
                ${actionsTriggerHtml}
            </div>
            ${tagsHtml}
            <div class="post-detail-author-info">
                <img src="${authorAvatar}" class="post-detail-author-avatar">
                <div>
                    <div class="post-detail-author-name">${authorName}</div>
                    <div class="post-detail-timestamp">${new Date(post.timestamp).toLocaleString()}</div>
                </div>
            </div>
            <div class="post-detail-body">${postBodyHtml}</div>
            <div class="post-actions-bar">
                <button class="post-like-btn ${post.likes.includes(PhoneSim_Config.PLAYER_ID) ? 'liked' : ''}" data-post-id="${postId}">
                    <i class="fas fa-thumbs-up"></i>
                    <span>${post.likes.length}</span>
                </button>
            </div>
        </div>
        <div class="post-replies-section">
            <h4>${allReplies.length} Replies</h4>
            <div class="post-replies-list"></div>
        </div>
    `;
    content.html(postHtml);

    const repliesList = content.find('.post-replies-list');
    if (allReplies.length > 0) {
        allReplies.forEach(reply => {
            const replyAuthorName = UI._getContactName(reply.authorId);
            const replyAuthorAvatar = UI.generateDefaultAvatar(replyAuthorName);
            const replyActionsHtml = `<div class="forum-actions-trigger" data-author-id="${reply.authorId}" data-reply-id="${reply.replyId}"><i class="fas fa-ellipsis-h"></i></div>`;
            
            const replyHtml = `
                <div class="post-reply-item ${reply.isStaged ? 'staged' : ''}" data-reply-id="${reply.replyId}">
                    <img src="${replyAuthorAvatar}" class="reply-author-avatar">
                    <div class="reply-body">
                        <div class="reply-header">
                            <span class="reply-author-name">${replyAuthorName}</span>
                            ${replyActionsHtml}
                        </div>
                        <div class="reply-timestamp">${new Date(reply.timestamp).toLocaleString()}</div>
                        <div class="reply-content">${UI.renderRichContent(reply.content)}</div>
                    </div>
                </div>
            `;
            repliesList.append(replyHtml);
        });
    }
}
