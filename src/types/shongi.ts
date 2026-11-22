export type AppScreen =
  | 'home'
  | 'ai-companion'
  | 'encrypted-journal'
  | 'peer-pilot'
  | 'community-feed'
  | 'crisis-resources'
  | 'privacy-memory-hub';

export type Language = 'en' | 'bn';

export type CompanionLanguage = 'bangla' | 'banglish' | 'english';

export type CompanionMode = 'listening' | 'reflection' | 'action';

export type JournalMood = 'Calm' | 'Heavy' | 'Hopeful' | 'Restless';

export interface ApprovedMemory {
  id: string;
  text: string;
  meta: string;
  isNew?: boolean;
}

export interface MemoryProposal {
  id: string;
  text: string;
  tags: string[];
  status: 'pending' | 'approved' | 'dismissed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'companion';
  paragraphs: string[];
  italicPrompt?: string;
  timestamp: string;
  statusLabel?: string;
  modeLabel?: string;
  includesProposal?: boolean;
  detectedLanguage?: CompanionLanguage;
  isStreaming?: boolean;
  error?: string;
}

export interface JournalEntry {
  id: string;
  dateLabel: string;
  banglaDateLabel?: string;
  relativeTimeLabel: string;
  title: string;
  body: string;
  mood: JournalMood;
  tags: string[];
  aiLocked: boolean;
  updatedAtLabel: string;
}

export interface PeerSupporter {
  id: string;
  initials: string;
  name: string;
  track: string;
  summary: string;
  story: string;
  responseTime: string;
  tags: string[];
  avatarTone: 'secondary' | 'primary' | 'neutral';
}

export type VoiceConversationPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'paused';

export type VoiceConversationEvent =
  | 'START_CALL'
  | 'AUDIO_CAPTURED'
  | 'EMPTY_AUDIO'
  | 'TRANSCRIPT_READY'
  | 'REPLY_READY'
  | 'SPEAKING_ENDED'
  | 'USER_INTERRUPT'
  | 'PAUSE_MIC'
  | 'RESUME_MIC'
  | 'END_CALL';

export type AuthMethod = 'anonymous' | 'google' | 'email';

export interface AuthAccountSummary {
  uid: string;
  email: string | null;
  displayName: string;
  isAnonymous: boolean;
  emailVerified: boolean;
  authMethod: AuthMethod;
  needsEmailVerification: boolean;
  canSyncCloud: boolean;
}

export type ConversationAvailability =
  | 'available'
  | 'open_to_requests'
  | 'not_accepting'
  | 'taking_a_break';

export type AvatarTone = 'sage' | 'terracotta' | 'navy' | 'sand';

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  bio: string;
  avatarTone: AvatarTone;
  avatarInitials: string;
  photoUrl?: string;
  statusTags: string[];
  interests: string[];
  availability: ConversationAvailability;
  preferredFeedVisibility: 'community' | 'private';
  showOnlineStatus: boolean;
  isOnline?: boolean;
  isDemo?: boolean;
  updatedAtMs?: number;
}

export interface PeerMatchRecommendation {
  profile: UserPublicProfile;
  score: number;
  sharedStatusTags: string[];
  sharedInterests: string[];
  explanation: string;
}

export type PeerRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'blocked';

export interface PeerConversationRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderAvatarTone: AvatarTone;
  senderTags: string[];
  recipientUid: string;
  recipientName: string;
  recipientAvatarTone: AvatarTone;
  recipientTags: string[];
  status: PeerRequestStatus;
  introMessage: string;
  sharedContextSummary: string;
  ignoredByRecipient?: boolean;
  isDemoTarget?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PeerConversation {
  id: string;
  participantUids: string[];
  participantNames: Record<string, string>;
  participantTones: Record<string, AvatarTone>;
  requestId: string;
  status: 'active' | 'ended';
  endedByUid?: string;
  lastMessagePreview?: string;
  isDemo?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PeerChatMessage {
  id: string;
  conversationId: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAtMs: number;
}

export type FeedPostType = 'mood' | 'thought' | 'story' | 'study_life';

export type FeedVisibility = 'community' | 'private';

export type FeedReactionType =
  | 'hear_you'
  | 'sending_support'
  | 'relatable'
  | 'you_got_this';

export type FeedFilter =
  | 'for_you'
  | 'recent'
  | 'study_life'
  | 'stories'
  | 'mood_thoughts'
  | 'interests';

export interface FeedPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatarTone: AvatarTone;
  postType: FeedPostType;
  mood?: string;
  title?: string;
  body: string;
  tags: string[];
  visibility: FeedVisibility;
  reactionCounts: Record<FeedReactionType, number>;
  userReaction?: FeedReactionType | null;
  commentCount: number;
  isDemo?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface FeedComment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAtMs: number;
}

export interface ModerationReport {
  id: string;
  reporterUid: string;
  targetType: 'user' | 'post' | 'comment' | 'conversation';
  targetId: string;
  targetUid?: string;
  reason: string;
  details?: string;
  createdAtMs: number;
}

export interface InAppNotification {
  id: string;
  recipientUid: string;
  type:
    | 'peer_request'
    | 'request_accepted'
    | 'request_declined'
    | 'peer_message'
    | 'feed_support';
  title: string;
  body: string;
  relatedId?: string;
  read: boolean;
  createdAtMs: number;
}
