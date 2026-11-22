import React, { useMemo, useState } from 'react';
import {
  AppScreen,
  AuthAccountSummary,
  AvatarTone,
  FeedComment,
  FeedFilter,
  FeedPost,
  FeedPostType,
  FeedReactionType,
  FeedVisibility,
  UserPublicProfile,
} from '../types/shongi';
import {
  ALL_STATUS_TAGS,
  FEED_REACTION_LABELS,
  filterAndSortFeedPosts,
  INTEREST_TAGS,
  moderateUserContent,
} from '../utils/shongiLogic';

interface CommunityFeedViewProps {
  authSummary: AuthAccountSummary | null;
  myProfile: UserPublicProfile;
  posts: FeedPost[];
  blockedUids: string[];
  commentsByPostId: Record<string, FeedComment[]>;
  onCreatePost: (post: {
    postType: FeedPostType;
    mood?: string;
    title?: string;
    body: string;
    tags: string[];
    visibility: FeedVisibility;
  }) => Promise<void>;
  onUpdatePost: (
    post: FeedPost,
    patch: {
      postType: FeedPostType;
      mood?: string;
      title?: string;
      body: string;
      tags: string[];
      visibility: FeedVisibility;
    }
  ) => Promise<void>;
  onDeletePost: (post: FeedPost) => Promise<void>;
  onToggleReaction: (post: FeedPost, reactionType: FeedReactionType) => Promise<void>;
  onLoadComments: (post: FeedPost) => Promise<void>;
  onAddComment: (post: FeedPost, body: string) => Promise<void>;
  onDeleteComment: (post: FeedPost, commentId: string) => Promise<void>;
  onReportContent: (payload: {
    targetType: 'post' | 'comment';
    targetId: string;
    targetUid?: string;
    reason: string;
    details?: string;
  }) => Promise<void>;
  onNavigate: (screen: AppScreen) => void;
}

const POST_TYPE_META: Record<FeedPostType, { label: string; bangla: string }> = {
  mood: { label: 'Mood Update', bangla: 'মনের অবস্থা' },
  thought: { label: 'Thought', bangla: 'ভাবনা' },
  story: { label: 'Story', bangla: 'অভিজ্ঞতা' },
  study_life: { label: 'Study & Life Update', bangla: 'পড়াশোনা ও জীবন' },
};

const QUICK_MOODS = ['Grounded', 'Quietly hopeful', 'Tired', 'Heavy', 'Reflective', 'Overwhelmed'];

function getAvatarClass(tone: AvatarTone): string {
  switch (tone) {
    case 'terracotta':
      return 'bg-[#C97B5A]/20 text-[#9a442d]';
    case 'navy':
      return 'bg-[#1e3a4c]/15 text-[#042436]';
    case 'sand':
      return 'bg-[#E3D9CD] text-[#2A2A28]';
    case 'sage':
    default:
      return 'bg-[#2F6F63]/15 text-[#2F6F63]';
  }
}

export const CommunityFeedView: React.FC<CommunityFeedViewProps> = ({
  authSummary,
  myProfile,
  posts,
  blockedUids,
  commentsByPostId,
  onCreatePost,
  onUpdatePost,
  onDeletePost,
  onToggleReaction,
  onLoadComments,
  onAddComment,
  onDeleteComment,
  onReportContent,
  onNavigate,
}) => {
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('for_you');

  // Composer state
  const [postType, setPostType] = useState<FeedPostType>('thought');
  const [mood, setMood] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<FeedVisibility>(myProfile.preferredFeedVisibility);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editVisibility, setEditVisibility] = useState<FeedVisibility>('community');

  // Expanded comments & drafts
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentError, setCommentError] = useState<string | null>(null);

  // Report modal
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'post' | 'comment';
    targetId: string;
    targetUid?: string;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Harassment or unkind language');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const myUid = authSummary?.uid ?? myProfile.uid;

  const visiblePosts = useMemo(
    () => filterAndSortFeedPosts(posts, myProfile, activeFilter, blockedUids),
    [posts, myProfile, activeFilter, blockedUids]
  );

  const selectableTags = useMemo(
    () => Array.from(new Set([...ALL_STATUS_TAGS.slice(0, 10), ...INTEREST_TAGS])),
    []
  );

  const toggleComposerTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= 4
        ? prev
        : [...prev, tag]
    );
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const mod = moderateUserContent(body);
    if (!mod.allowed) {
      setComposerError(mod.warningReason || 'Please check your post text.');
      return;
    }
    setCrisisDetected(mod.isCrisisDetected);
    setComposerError(null);
    setSubmittingPost(true);
    try {
      await onCreatePost({
        postType,
        mood: mood.trim() || undefined,
        title: title.trim() || undefined,
        body: body.trim(),
        tags: selectedTags,
        visibility,
      });
      setTitle('');
      setBody('');
      setMood('');
      setSelectedTags([]);
      showToast(
        visibility === 'private'
          ? 'Saved to your private space (only visible to you).'
          : 'Shared gently with the SHONGI community.'
      );
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Unable to save your post.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleSaveEdit = async (post: FeedPost) => {
    const mod = moderateUserContent(editBody);
    if (!mod.allowed) {
      showToast(mod.warningReason || 'Please adjust your text.');
      return;
    }
    await onUpdatePost(post, {
      postType: post.postType,
      mood: post.mood,
      title: post.title,
      body: editBody.trim(),
      tags: post.tags,
      visibility: editVisibility,
    });
    setEditingPostId(null);
    showToast('Post updated.');
  };

  const toggleComments = (post: FeedPost) => {
    const nextOpen = !expandedPostIds[post.id];
    setExpandedPostIds((prev) => ({ ...prev, [post.id]: nextOpen }));
    if (nextOpen) {
      void onLoadComments(post);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent, post: FeedPost) => {
    e.preventDefault();
    const draft = commentDrafts[post.id] ?? '';
    const mod = moderateUserContent(draft);
    if (!mod.allowed) {
      setCommentError(mod.warningReason || 'Please check your comment.');
      return;
    }
    setCrisisDetected(mod.isCrisisDetected);
    setCommentError(null);
    await onAddComment(post, draft.trim());
    setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      {/* Banner */}
      <div className="rounded-2xl bg-surface-container-low p-6 lg:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2F6F63]/15 text-[#2F6F63] text-[11px] font-semibold uppercase tracking-wider">
              Your Space
            </span>
            <span className="text-[12px] text-on-surface-variant bangla-text">
              শান্ত কমিউনিটি ফিড
            </span>
          </div>
          <h1 className="text-[24px] font-semibold text-primary">SHONGI Feed</h1>
          <p className="text-[14px] text-on-surface-variant leading-[1.6] max-w-2xl">
            Share a mood, thought, or quiet study update at your own pace. No follower counts or
            popularity rankings—just supportive listening. Your AI chats and journal never appear
            here automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('peer-pilot')}
          className="px-4 py-2.5 rounded-xl bg-surface text-primary text-[13px] font-medium border border-outline-variant/40 hover:bg-surface-container-high shrink-0 self-start md:self-auto"
        >
          Find Your People →
        </button>
      </div>

      {crisisDetected && (
        <div className="p-4 rounded-2xl bg-secondary-fixed/50 border border-secondary/30 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[14px] font-semibold text-on-secondary-fixed">
              If things feel too heavy right now, real human support is here.
            </p>
            <p className="text-[13px] text-on-secondary-fixed-variant leading-[1.6]">
              Kaan Pete Roi (09612-119911) and National Emergency Service (999) offer confidential
              listening and crisis support in Bangladesh.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('crisis-resources')}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-[12px] font-semibold"
          >
            Crisis Resources
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handlePublishPost}
        data-testid="feed-composer-form"
        className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs border border-outline-variant/25 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-semibold text-primary">Share on Your Terms</span>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(POST_TYPE_META) as FeedPostType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPostType(type)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                  postType === type
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {POST_TYPE_META[type].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(postType === 'story' || postType === 'study_life') && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Optional short title..."
              className="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-[14px] text-on-surface outline-none focus:bg-surface-container"
            />
          )}

          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
            <span className="text-[12px] text-on-surface-variant mr-1">Optional mood:</span>
            {QUICK_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood((prev) => (prev === m ? '' : m))}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  mood === m
                    ? 'bg-[#C97B5A] text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="feed-body-input"
          maxLength={4000}
          placeholder="What is on your mind today? Write in Bangla, Banglish, or English..."
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-[15px] text-on-surface outline-none focus:bg-surface-container leading-[1.6]"
        />

        {/* Topic Tags */}
        <div className="space-y-1.5">
          <span className="text-[12px] text-on-surface-variant block">
            Optional tags (up to 4) so people who relate can find this:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {selectableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleComposerTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#2F6F63] text-white'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {composerError && (
          <p className="text-[12px] text-secondary font-medium">{composerError}</p>
        )}

        <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-on-surface-variant">Visibility:</span>
            <button
              type="button"
              data-testid="feed-visibility-community"
              onClick={() => setVisibility('community')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                visibility === 'community'
                  ? 'bg-[#2F6F63]/15 text-[#2F6F63] font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              Community
            </button>
            <button
              type="button"
              data-testid="feed-visibility-private"
              onClick={() => setVisibility('private')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                visibility === 'private'
                  ? 'bg-primary text-on-primary font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              Private (Only Me)
            </button>
          </div>

          <button
            type="submit"
            data-testid="feed-publish-btn"
            disabled={!body.trim() || submittingPost}
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container disabled:opacity-50"
          >
            {submittingPost ? 'Sharing...' : visibility === 'private' ? 'Save Privately' : 'Share to Feed'}
          </button>
        </div>
      </form>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'for_you', label: 'For You' },
            { id: 'recent', label: 'Recent' },
            { id: 'study_life', label: 'Study & Student Life' },
            { id: 'stories', label: 'Personal Stories' },
            { id: 'mood_thoughts', label: 'Mood & Thoughts' },
            { id: 'interests', label: 'Interests' },
          ] as Array<{ id: FeedFilter; label: string }>
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid={`feed-filter-${f.id}`}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
              activeFilter === f.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed List */}
      <div className="space-y-5">
        {visiblePosts.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-lowest p-10 text-center text-[14px] text-on-surface-variant shadow-xs">
            No posts match this view yet. Share a thought above or switch filters.
          </div>
        ) : (
          visiblePosts.map((post) => {
            const isOwner = post.authorUid === myUid;
            const isEditing = editingPostId === post.id;
            const comments = commentsByPostId[post.id] ?? [];
            const isExpanded = Boolean(expandedPostIds[post.id]);

            return (
              <article
                key={post.id}
                data-testid={`feed-post-${post.id}`}
                className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs border border-outline-variant/25 space-y-4"
              >
                {/* Post Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold ${getAvatarClass(
                        post.authorAvatarTone
                      )}`}
                    >
                      {post.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-primary">
                          {post.authorName}
                        </span>
                        {post.isDemo && (
                          <span className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] text-on-surface-variant">
                            Community Preview
                          </span>
                        )}
                        {post.visibility === 'private' && (
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium">
                            Private (Only You)
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] text-on-surface-variant">
                        {POST_TYPE_META[post.postType].label} •{' '}
                        {new Date(post.createdAtMs).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {post.mood && (
                      <span className="px-2.5 py-1 rounded-full bg-[#C97B5A]/12 text-[#9a442d] text-[11px] font-medium">
                        {post.mood}
                      </span>
                    )}
                    {isOwner && !post.isDemo && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(post.id);
                            setEditBody(post.body);
                            setEditVisibility(post.visibility);
                          }}
                          className="text-[12px] text-primary hover:underline px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onDeletePost(post);
                            showToast('Post deleted.');
                          }}
                          className="text-[12px] text-secondary hover:underline px-2 py-1"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          setReportTarget({
                            targetType: 'post',
                            targetId: post.id,
                            targetUid: post.authorUid,
                            label: `${post.authorName}'s post`,
                          })
                        }
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-secondary"
                        title="Report post"
                      >
                        <span className="material-symbols-outlined text-lg">flag</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Body or Edit Form */}
                {isEditing ? (
                  <div className="space-y-3 bg-surface-container-low p-4 rounded-xl">
                    <textarea
                      rows={3}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-[14px] text-on-surface outline-none leading-[1.6]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[12px]">
                        <span>Visibility:</span>
                        <button
                          type="button"
                          onClick={() => setEditVisibility('community')}
                          className={`px-2.5 py-1 rounded-lg ${
                            editVisibility === 'community' ? 'bg-primary text-on-primary' : 'bg-surface'
                          }`}
                        >
                          Community
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditVisibility('private')}
                          className={`px-2.5 py-1 rounded-lg ${
                            editVisibility === 'private' ? 'bg-primary text-on-primary' : 'bg-surface'
                          }`}
                        >
                          Private
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(post)}
                          className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPostId(null)}
                          className="px-3 py-1.5 rounded-lg bg-surface text-[12px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {post.title && (
                      <h3 className="text-[17px] font-semibold text-primary">{post.title}</h3>
                    )}
                    <p className="text-[15px] text-on-surface leading-[1.6] whitespace-pre-wrap">
                      {post.body}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-full bg-surface-container-low text-[11px] font-medium text-primary"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Supportive Reactions & Comment Toggle */}
                <div className="pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(FEED_REACTION_LABELS) as FeedReactionType[]).map((rType) => {
                      const count = post.reactionCounts[rType] ?? 0;
                      const isActive = post.userReaction === rType;
                      return (
                        <button
                          key={rType}
                          type="button"
                          onClick={() => void onToggleReaction(post, rType)}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-[#2F6F63] text-white'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <span>{FEED_REACTION_LABELS[rType].label}</span>
                          {count > 0 && <span className="tabular-nums opacity-85">{count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleComments(post)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-primary hover:bg-surface-container-low flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">chat_bubble_outline</span>
                    <span>
                      Comments ({Math.max(post.commentCount, comments.length)})
                    </span>
                  </button>
                </div>

                {/* Comments Section */}
                {isExpanded && (
                  <div className="pt-3 border-t border-outline-variant/20 space-y-3">
                    {comments.length === 0 ? (
                      <p className="text-[12px] text-on-surface-variant">
                        No comments yet. Leave a gentle, supportive note if you&apos;d like.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {comments.map((c) => (
                          <div
                            key={c.id}
                            className="p-3 rounded-xl bg-surface-container-low flex items-start justify-between gap-3"
                          >
                            <div>
                              <span className="text-[12px] font-semibold text-primary">
                                {c.authorName}
                              </span>
                              <p className="text-[13px] text-on-surface leading-[1.6] mt-0.5">
                                {c.body}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.authorUid === myUid ? (
                                <button
                                  type="button"
                                  onClick={() => void onDeleteComment(post, c.id)}
                                  className="text-[11px] text-secondary hover:underline"
                                >
                                  Delete
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportTarget({
                                      targetType: 'comment',
                                      targetId: c.id,
                                      targetUid: c.authorUid,
                                      label: `${c.authorName}'s comment`,
                                    })
                                  }
                                  className="text-[11px] text-on-surface-variant hover:text-secondary"
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={(e) => void handleSubmitComment(e, post)} className="flex gap-2">
                      <input
                        type="text"
                        value={commentDrafts[post.id] ?? ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        maxLength={1000}
                        placeholder="Write a kind comment..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-surface-container-low text-[13px] outline-none focus:bg-surface-container"
                      />
                      <button
                        type="submit"
                        disabled={!(commentDrafts[post.id] ?? '').trim()}
                        className="px-4 py-2 rounded-xl bg-primary text-on-primary text-[12px] font-semibold disabled:opacity-50"
                      >
                        Reply
                      </button>
                    </form>
                    {commentError && (
                      <p className="text-[12px] text-secondary font-medium">{commentError}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Modal: Report Post or Comment */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-[18px] font-semibold text-primary">Report {reportTarget.label}</h3>
            <div className="space-y-2">
              {[
                'Harassment or unkind language',
                'Sharing personal contact / phone / bKash details',
                'Spam or promotional post',
                'Unsafe or triggering content',
              ].map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-low cursor-pointer text-[13px]"
                >
                  <input
                    type="radio"
                    name="feed-report-reason"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="accent-secondary"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void onReportContent({
                    targetType: reportTarget.targetType,
                    targetId: reportTarget.targetId,
                    targetUid: reportTarget.targetUid,
                    reason: reportReason,
                  });
                  setReportTarget(null);
                  showToast('Confidential report submitted.');
                }}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-on-secondary text-[13px] font-semibold"
              >
                Submit Report
              </button>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-surface-container text-[13px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl bg-primary text-on-primary text-[13px] font-medium shadow-xl z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
