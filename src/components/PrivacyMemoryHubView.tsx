import React, { useEffect, useState } from 'react';
import {
  ApprovedMemory,
  AppScreen,
  AuthAccountSummary,
  AvatarTone,
  ConversationAvailability,
  UserPublicProfile,
} from '../types/shongi';
import {
  AVAILABILITY_META,
  CAREER_GROWTH_TAGS,
  EMOTIONAL_EXPERIENCE_TAGS,
  formatMemoryUsage,
  getInitials,
  INTEREST_TAGS,
  MAX_APPROVED_MEMORIES,
  STUDENT_LIFE_TAGS,
} from '../utils/shongiLogic';
import type { BlockedUserRecord } from '../firebase';

interface PrivacyMemoryHubViewProps {
  memories: ApprovedMemory[];
  authSummary: AuthAccountSummary | null;
  myProfile: UserPublicProfile;
  blockedUsers: BlockedUserRecord[];
  proactiveCheckins: boolean;
  ephemeralMode: boolean;
  onSavePublicProfile: (profile: UserPublicProfile) => Promise<void>;
  onUnblockUser: (targetUid: string) => Promise<void>;
  onUpdateConsent: (patch: { proactiveCheckins?: boolean; ephemeralMode?: boolean }) => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onAddMemory: (text: string) => void;
  onRemoveMemory: (id: string) => void;
  onClearAllMemories: () => void;
  onNavigate: (screen: AppScreen) => void;
}

const AVATAR_TONES: Array<{ id: AvatarTone; label: string; swatchClass: string }> = [
  { id: 'sage', label: 'Sage', swatchClass: 'bg-[#2F6F63]/20 text-[#2F6F63]' },
  { id: 'terracotta', label: 'Warm Clay', swatchClass: 'bg-[#C97B5A]/20 text-[#9a442d]' },
  { id: 'navy', label: 'Padma Dusk', swatchClass: 'bg-[#1e3a4c]/15 text-[#042436]' },
  { id: 'sand', label: 'Warm Sand', swatchClass: 'bg-[#E3D9CD] text-[#2A2A28]' },
];

export const PrivacyMemoryHubView: React.FC<PrivacyMemoryHubViewProps> = ({
  memories,
  authSummary,
  myProfile,
  blockedUsers,
  proactiveCheckins,
  ephemeralMode,
  onSavePublicProfile,
  onUnblockUser,
  onUpdateConsent,
  onOpenAuth,
  onSignOut,
  onAddMemory,
  onRemoveMemory,
  onClearAllMemories,
  onNavigate,
}) => {
  const [displayName, setDisplayName] = useState(myProfile.displayName);
  const [bio, setBio] = useState(myProfile.bio);
  const [avatarTone, setAvatarTone] = useState<AvatarTone>(myProfile.avatarTone);
  const [statusTags, setStatusTags] = useState<string[]>(myProfile.statusTags);
  const [interests, setInterests] = useState<string[]>(myProfile.interests);
  const [availability, setAvailability] = useState<ConversationAvailability>(myProfile.availability);
  const [preferredFeedVisibility, setPreferredFeedVisibility] = useState<'community' | 'private'>(
    myProfile.preferredFeedVisibility
  );
  const [showOnlineStatus, setShowOnlineStatus] = useState<boolean>(myProfile.showOnlineStatus);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  const [newMemoryText, setNewMemoryText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setDisplayName(myProfile.displayName);
    setBio(myProfile.bio);
    setAvatarTone(myProfile.avatarTone);
    setStatusTags(myProfile.statusTags);
    setInterests(myProfile.interests);
    setAvailability(myProfile.availability);
    setPreferredFeedVisibility(myProfile.preferredFeedVisibility);
    setShowOnlineStatus(myProfile.showOnlineStatus);
  }, [myProfile]);

  const toggleStatusTag = (tag: string) => {
    setStatusTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= 18 ? prev : [...prev, tag]
    );
  };

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= 12 ? prev : [...prev, tag]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg(null);
    const cleanName = displayName.trim() || authSummary?.displayName || 'Sanctuary Member';
    try {
      await onSavePublicProfile({
        ...myProfile,
        displayName: cleanName,
        avatarInitials: getInitials(cleanName),
        avatarTone,
        bio: bio.trim(),
        statusTags,
        interests,
        availability,
        preferredFeedVisibility,
        showOnlineStatus,
      });
      setProfileSavedMsg('Profile & discovery preferences saved.');
      window.setTimeout(() => setProfileSavedMsg(null), 3500);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemoryText.trim();
    if (!trimmed || memories.length >= MAX_APPROVED_MEMORIES) return;
    onAddMemory(trimmed);
    setNewMemoryText('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="rounded-2xl bg-surface-container-low p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-2xl">shield_with_heart</span>
          </div>
          <div>
            <h1 className="text-[24px] font-semibold text-primary">
              Profile, Discovery &amp; Privacy Hub
            </h1>
            <p className="text-[14px] text-on-surface-variant mt-1 bangla-text">
              প্রোফাইল ও গোপনীয়তা • Control your voluntary peer tags, availability, feed defaults,
              and AI Companion memories.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => onNavigate('peer-pilot')}
            className="px-4 py-2.5 rounded-xl bg-surface text-primary text-[13px] font-medium border border-outline-variant/40 hover:bg-surface-container-high transition-colors"
          >
            Find Your People
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ai-companion')}
            className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors"
          >
            Talk to SHONGI
          </button>
        </div>
      </div>

      {/* SECTION 1: USER PROFILE, DISCOVERY TAGS & AVAILABILITY */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-xs border border-outline-variant/25 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-semibold text-primary">
              Your Discovery Profile &amp; Voluntary Tags
            </h2>
            <p className="text-[13px] text-on-surface-variant leading-[1.6]">
              Only your nickname, bio, tags, and availability appear in Find Your People. Your
              email, journal entries, and AI chats are never shown.
            </p>
          </div>
          {profileSavedMsg && (
            <span className="px-3 py-1 rounded-full bg-[#2F6F63]/15 text-[#2F6F63] text-[12px] font-semibold">
              {profileSavedMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="profile-display-name" className="block text-[12px] font-semibold text-primary mb-1.5">
              Display Name / Nickname
            </label>
            <input
              id="profile-display-name"
              data-testid="profile-name-input"
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Nusrat / Dhaka Student"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low text-[14px] text-on-surface outline-none focus:bg-surface-container"
            />
          </div>

          <div>
            <span className="block text-[12px] font-semibold text-primary mb-1.5">
              Avatar Badge Style
            </span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAvatarTone(t.id)}
                  className={`px-3 py-2 rounded-xl text-[12px] font-medium flex items-center gap-2 border transition-all ${
                    avatarTone === t.id
                      ? 'border-primary bg-surface-container'
                      : 'border-transparent bg-surface-container-low'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${t.swatchClass}`}
                  >
                    {getInitials(displayName || 'SH')}
                  </span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="profile-bio" className="block text-[12px] font-semibold text-primary mb-1.5">
              Short Bio (Optional, max 280 characters)
            </label>
            <textarea
              id="profile-bio"
              data-testid="profile-bio-input"
              rows={2}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A brief note about what you're navigating or what kind of conversations feel comfortable..."
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low text-[14px] text-on-surface outline-none focus:bg-surface-container leading-[1.6]"
            />
          </div>
        </div>

        {/* Voluntary Tag Categories */}
        <div className="space-y-4 pt-2 border-t border-outline-variant/20">
          {[
            { title: 'Emotional experiences (optional)', items: EMOTIONAL_EXPERIENCE_TAGS, isInterest: false },
            { title: 'Student life', items: STUDENT_LIFE_TAGS, isInterest: false },
            { title: 'Career and personal growth', items: CAREER_GROWTH_TAGS, isInterest: false },
            { title: 'Interests', items: INTEREST_TAGS, isInterest: true },
          ].map((group) => (
            <div key={group.title} className="space-y-2">
              <span className="text-[13px] font-semibold text-primary block">{group.title}</span>
              <div className="flex flex-wrap gap-2">
                {group.items.map((tag) => {
                  const selected = group.isInterest
                    ? interests.includes(tag)
                    : statusTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      data-testid={`profile-tag-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      onClick={() => (group.isInterest ? toggleInterest(tag) : toggleStatusTag(tag))}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                        selected
                          ? group.isInterest
                            ? 'bg-[#C97B5A] text-white'
                            : 'bg-[#2F6F63] text-white'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Availability & Privacy Defaults */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-outline-variant/20">
          <div className="space-y-2">
            <span className="text-[13px] font-semibold text-primary block">
              Conversation Availability
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(AVAILABILITY_META) as ConversationAvailability[]).map((avail) => {
                const active = availability === avail;
                return (
                  <button
                    key={avail}
                    type="button"
                    onClick={() => setAvailability(avail)}
                    className={`p-3 rounded-xl text-left text-[12px] transition-all border ${
                      active
                        ? 'border-primary bg-surface-container font-semibold text-primary'
                        : 'border-transparent bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {AVAILABILITY_META[avail].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[13px] font-semibold text-primary block mb-1.5">
                Default Feed Post Visibility
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredFeedVisibility('community')}
                  className={`flex-1 py-2 px-3 rounded-xl text-[12px] font-medium ${
                    preferredFeedVisibility === 'community'
                      ? 'bg-[#2F6F63] text-white'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Community
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredFeedVisibility('private')}
                  className={`flex-1 py-2 px-3 rounded-xl text-[12px] font-medium ${
                    preferredFeedVisibility === 'private'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  Private (Only Me)
                </button>
              </div>
            </div>

            <label className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-surface-container-low cursor-pointer">
              <div>
                <span className="text-[13px] font-medium text-primary block">
                  Show online indicator
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Off by default. Lets peers see when you are active.
                </span>
              </div>
              <input
                type="checkbox"
                checked={showOnlineStatus}
                onChange={(e) => setShowOnlineStatus(e.target.checked)}
                className="mt-1 w-4 h-4 accent-primary"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            data-testid="save-profile-btn"
            disabled={savingProfile}
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container disabled:opacity-60"
          >
            {savingProfile ? 'Saving...' : 'Save Profile & Discovery Settings'}
          </button>
        </div>
      </form>

      {/* SECTION 2: MEMORIES + ACCOUNT + BLOCKED USERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Approved Memories Inventory (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-primary">
                Ratified Context Memories
              </h2>
              <p className="text-[13px] text-on-surface-variant">
                Only approved items are available to the AI Companion. Journal entries and private
                posts remain strictly isolated.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-surface-container text-[11px] font-semibold text-on-surface-variant tabular-nums">
              {formatMemoryUsage(memories.length, MAX_APPROVED_MEMORIES)}
            </span>
          </div>

          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="Add a personal preference (e.g., Speak in gentle Bangla)..."
              aria-label="Add a personal memory preference"
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-low text-[14px] text-on-surface outline-none focus:bg-surface-container"
            />
            <button
              type="submit"
              disabled={!newMemoryText.trim() || memories.length >= MAX_APPROVED_MEMORIES}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container disabled:opacity-50"
            >
              Add Preference
            </button>
          </form>

          <div className="space-y-3">
            {memories.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-container-low text-center text-[13px] text-on-surface-variant">
                Zero memories stored. Your companion starts completely fresh in every conversation.
              </div>
            ) : (
              memories.map((mem) => (
                <div
                  key={mem.id}
                  className="p-4 rounded-xl bg-surface-container-low flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-base text-tertiary-container mt-0.5">
                      verified_user
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-on-surface">{mem.text}</p>
                      <span className="text-[11px] text-on-surface-variant">{mem.meta}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveMemory(mem.id)}
                    className="px-2.5 py-1 rounded-lg bg-surface text-secondary text-[11px] font-semibold hover:bg-secondary-fixed/50 shrink-0"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>

          {memories.length > 0 && (
            <div className="pt-2 flex justify-end">
              {confirmClear ? (
                <div className="flex items-center gap-2 bg-error-container/40 px-3 py-1.5 rounded-xl">
                  <span className="text-[12px] text-on-error-container font-medium">
                    Revoke all {memories.length} memories?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllMemories();
                      setConfirmClear(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-error text-on-error text-[11px] font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1 rounded-lg bg-surface text-on-surface text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-[12px] font-semibold text-secondary hover:underline"
                >
                  Erase All Stored Memories
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Account, Blocked Users & Consent Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[18px] font-semibold text-primary">Account &amp; Sync</h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                {!authSummary
                  ? 'Signed Out'
                  : authSummary.needsEmailVerification
                  ? 'Verify Email'
                  : authSummary.isAnonymous
                  ? 'Anonymous'
                  : authSummary.authMethod === 'google'
                  ? 'Google'
                  : 'Verified Email'}
              </span>
            </div>
            <p className="text-[13px] text-on-surface-variant leading-[1.6]">
              {!authSummary
                ? 'Sign in anonymously, with Google, or via verified email to sync across sessions.'
                : authSummary.isAnonymous
                ? 'Active anonymous sanctuary session. You can upgrade to Google or verified Email anytime without losing your memories.'
                : authSummary.needsEmailVerification
                ? `Verification pending for ${authSummary.email}. Verify your email link to enable cloud sync.`
                : `Signed in as ${authSummary.displayName}${authSummary.email ? ` (${authSummary.email})` : ''}. Your email is never visible to other users.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              {authSummary ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors"
                  >
                    Manage Account
                  </button>
                  <button
                    type="button"
                    data-testid="profile-signout-btn"
                    onClick={onSignOut}
                    className="py-2.5 px-4 rounded-xl border border-secondary/40 bg-secondary/10 text-secondary text-[13px] font-semibold hover:bg-secondary/20 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors"
                >
                  Sign In (Anonymous / Google / Email)
                </button>
              )}
            </div>
          </div>

          {/* Blocked Users Management */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-[18px] font-semibold text-primary">Blocked Users</h2>
            {blockedUsers.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant">
                You haven&apos;t blocked anyone. Blocked users cannot contact you or appear in your
                feed or peer discovery.
              </p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((b) => (
                  <div
                    key={b.targetUid}
                    className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between gap-3"
                  >
                    <span className="text-[13px] font-medium text-primary">{b.targetName}</span>
                    <button
                      type="button"
                      onClick={() => void onUnblockUser(b.targetUid)}
                      className="px-3 py-1 rounded-lg bg-surface text-primary text-[11px] font-semibold hover:bg-surface-container"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consent & Boundaries */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-[18px] font-semibold text-primary">Consent &amp; Boundaries</h2>

            <label className="flex items-start justify-between gap-4 p-4 rounded-xl bg-surface-container-low cursor-pointer">
              <div>
                <span className="text-[14px] font-medium text-primary block">
                  On-Device Ephemeral Caching
                </span>
                <span className="text-[12px] text-on-surface-variant">
                  Keep active chat drafts locally in browser storage without cloud analytics.
                </span>
              </div>
              <input
                type="checkbox"
                checked={ephemeralMode}
                onChange={(e) => onUpdateConsent({ ephemeralMode: e.target.checked })}
                className="mt-1 w-4 h-4 accent-primary"
              />
            </label>

            <label className="flex items-start justify-between gap-4 p-4 rounded-xl bg-surface-container-low cursor-pointer">
              <div>
                <span className="text-[14px] font-medium text-primary block">
                  Gentle Check-In Reminders
                </span>
                <span className="text-[12px] text-on-surface-variant">
                  Allow SHONGI to offer an optional quiet evening reflection prompt.
                </span>
              </div>
              <input
                type="checkbox"
                checked={proactiveCheckins}
                onChange={(e) => onUpdateConsent({ proactiveCheckins: e.target.checked })}
                className="mt-1 w-4 h-4 accent-primary"
              />
            </label>

            <div className="p-4 rounded-xl bg-surface-container text-[12px] text-on-surface-variant leading-relaxed">
              <strong className="text-primary block mb-1">Zero Model Training Guarantee</strong>
              Your personal reflections, journal entries, and peer messages are never used to train
              public AI models.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
