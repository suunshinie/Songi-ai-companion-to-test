import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ApprovedMemory,
  AppScreen,
  ChatMessage,
  CompanionMode,
  FeedComment,
  FeedPost,
  FeedPostType,
  FeedReactionType,
  FeedVisibility,
  InAppNotification,
  JournalEntry,
  Language,
  MemoryProposal,
  PeerChatMessage,
  PeerConversation,
  PeerConversationRequest,
  UserPublicProfile,
} from './types/shongi';
import {
  DEMO_FEED_POSTS,
  DEMO_PEER_PROFILES,
  INITIAL_APPROVED_MEMORIES,
  INITIAL_CHAT_MESSAGES,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_MEMORY_PROPOSAL,
} from './data/seedData';
import {
  approveMemoryProposal,
  canSendPeerRequest,
  computeWordRevealDelay,
  deriveAuthSummary,
  detectCompanionLanguage,
  getInitials,
  MAX_APPROVED_MEMORIES,
  sanitizeChatHistory,
  splitParagraphsFromText,
} from './utils/shongiLogic';
import {
  acceptPeerRequestAndCreateConversation,
  addFeedCommentDoc,
  type BlockedUserRecord,
  blockUserDoc,
  clearAllMemoryDocs,
  createFeedPostDoc,
  createModerationReportDoc,
  createNotificationDoc,
  createPeerRequestDoc,
  deleteFeedCommentDoc,
  deleteFeedPostDoc,
  deleteJournalDoc,
  deleteMemoryDoc,
  endPeerConversationDoc,
  ensurePublicProfile,
  ensureUserProfile,
  fetchFeedComments,
  ignorePeerRequestDoc,
  markNotificationReadDoc,
  saveJournalDoc,
  saveMemoryDoc,
  savePublicProfileDoc,
  sendPeerMessageDoc,
  signInAnonymouslyPrivate,
  signOutSanctuary,
  subscribeAuthUser,
  subscribeFeedPosts,
  subscribePeerConversations,
  subscribePeerMessages,
  subscribePeerRequests,
  subscribePublicProfiles,
  subscribeUserBlocks,
  subscribeUserJournal,
  subscribeUserMemories,
  subscribeUserNotifications,
  toggleFeedReactionDoc,
  unblockUserDoc,
  updateFeedPostDoc,
  updatePeerRequestStatusDoc,
  updateUserConsentPreferences,
} from './firebase';
import { PublicHomepage } from './components/PublicHomepage';
import { DashboardShell } from './components/DashboardShell';
import { AiCompanionView } from './components/AiCompanionView';
import { EncryptedJournalView } from './components/EncryptedJournalView';
import { PeerPilotView } from './components/PeerPilotView';
import { CommunityFeedView } from './components/CommunityFeedView';
import { CrisisResourcesView } from './components/CrisisResourcesView';
import { PrivacyMemoryHubView } from './components/PrivacyMemoryHubView';
import { AuthModal } from './components/AuthModal';

const STORAGE_KEYS = {
  memories: 'shongi_approved_memories_v1',
  journal: 'shongi_journal_entries_v1',
  proposal: 'shongi_memory_proposal_v1',
};

const VALID_SCREENS: AppScreen[] = [
  'home',
  'ai-companion',
  'encrypted-journal',
  'peer-pilot',
  'community-feed',
  'crisis-resources',
  'privacy-memory-hub',
];

const INITIAL_DEMO_COMMENTS: Record<string, FeedComment[]> = {
  'demo-post-1': [
    {
      id: 'demo-cmt-1',
      postId: 'demo-post-1',
      authorUid: 'demo_riya',
      authorName: 'Riya Sultana',
      body: 'Really needed this reminder today. That 20-minute walk sounds so grounding.',
      createdAtMs: Date.now() - 1000 * 60 * 50,
    },
  ],
};

function getInitialScreen(): AppScreen {
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get('screen') as AppScreen | null;
  if (screenParam && VALID_SCREENS.includes(screenParam)) {
    return screenParam;
  }
  if (params.get('autostart') === '1') {
    return 'ai-companion';
  }
  return 'home';
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getModeLabel(mode: CompanionMode): string {
  if (mode === 'reflection') return 'Reflection Mode';
  if (mode === 'action') return 'Action Mode';
  return 'Listening Mode';
}

function buildFallbackProfile(uid: string, displayName: string): UserPublicProfile {
  return {
    uid,
    displayName,
    bio: '',
    avatarTone: 'sage',
    avatarInitials: getInitials(displayName),
    statusTags: [],
    interests: [],
    availability: 'open_to_requests',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
    isOnline: false,
  };
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
  const [language, setLanguage] = useState<Language>('en');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [memories, setMemories] = useState<ApprovedMemory[]>(() =>
    loadFromStorage(STORAGE_KEYS.memories, INITIAL_APPROVED_MEMORIES)
  );
  const [proposal, setProposal] = useState<MemoryProposal>(() =>
    loadFromStorage(STORAGE_KEYS.proposal, INITIAL_MEMORY_PROPOSAL)
  );
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() =>
    loadFromStorage(STORAGE_KEYS.journal, INITIAL_JOURNAL_ENTRIES)
  );
  const [isStreamingReply, setIsStreamingReply] = useState(false);
  const [lastCompletedReply, setLastCompletedReply] = useState<{
    id: string;
    text: string;
    language: 'bangla' | 'banglish' | 'english';
  } | null>(null);

  // Firebase Auth & Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    screen: AppScreen;
    thought?: string;
  } | null>(null);
  const [proactiveCheckins, setProactiveCheckins] = useState(false);
  const [ephemeralMode, setEphemeralMode] = useState(true);
  const profileReadyUidRef = useRef<string | null>(null);

  // Peer Discovery, Community Feed & Safety State
  const [myPublicProfile, setMyPublicProfile] = useState<UserPublicProfile | null>(null);
  const [cloudPublicProfiles, setCloudPublicProfiles] = useState<UserPublicProfile[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [cloudPeerRequests, setCloudPeerRequests] = useState<PeerConversationRequest[]>([]);
  const [demoRequests, setDemoRequests] = useState<PeerConversationRequest[]>([]);
  const [cloudConversations, setCloudConversations] = useState<PeerConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messagesByConvId, setMessagesByConvId] = useState<Record<string, PeerChatMessage[]>>({});
  const [cloudFeedPosts, setCloudFeedPosts] = useState<FeedPost[]>([]);
  const [localUnverifiedPosts, setLocalUnverifiedPosts] = useState<FeedPost[]>([]);
  const [commentsByPostId, setCommentsByPostId] =
    useState<Record<string, FeedComment[]>>(INITIAL_DEMO_COMMENTS);
  const [userReactions, setUserReactions] = useState<Record<string, FeedReactionType | null>>({});
  const [demoReactionOverrides, setDemoReactionOverrides] = useState<
    Record<string, { counts: Record<FeedReactionType, number>; userReaction: FeedReactionType | null }>
  >({});

  const authSummary = useMemo(() => {
    if (!firebaseUser) return null;
    return deriveAuthSummary({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      isAnonymous: firebaseUser.isAnonymous,
      emailVerified: firebaseUser.emailVerified,
      providerData: firebaseUser.providerData,
    });
  }, [firebaseUser]);

  const effectiveMyProfile = useMemo(() => {
    if (myPublicProfile) return myPublicProfile;
    if (authSummary) {
      return buildFallbackProfile(authSummary.uid, authSummary.displayName);
    }
    return buildFallbackProfile('guest', 'Sanctuary Guest');
  }, [myPublicProfile, authSummary]);

  const blockedUids = useMemo(() => blockedUsers.map((b) => b.targetUid), [blockedUsers]);

  const candidateProfiles = useMemo(() => {
    const map = new Map<string, UserPublicProfile>();
    for (const p of cloudPublicProfiles) {
      map.set(p.uid, p);
    }
    for (const demo of DEMO_PEER_PROFILES) {
      if (!map.has(demo.uid)) {
        map.set(demo.uid, demo);
      }
    }
    return Array.from(map.values());
  }, [cloudPublicProfiles]);

  const allPeerRequests = useMemo(() => {
    return [...cloudPeerRequests, ...demoRequests].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [cloudPeerRequests, demoRequests]);

  const allFeedPosts = useMemo(() => {
    const combined = [...cloudFeedPosts, ...localUnverifiedPosts, ...DEMO_FEED_POSTS];
    return combined.map((post) => {
      if (post.isDemo) {
        const override = demoReactionOverrides[post.id];
        return {
          ...post,
          reactionCounts: override ? override.counts : post.reactionCounts,
          userReaction: override ? override.userReaction : null,
        };
      }
      return {
        ...post,
        userReaction: userReactions[post.id] ?? null,
      };
    });
  }, [cloudFeedPosts, localUnverifiedPosts, demoReactionOverrides, userReactions]);

  const pendingReceivedCount = useMemo(() => {
    if (!authSummary) return 0;
    return allPeerRequests.filter(
      (r) =>
        r.recipientUid === authSummary.uid &&
        r.status === 'pending' &&
        !r.ignoredByRecipient &&
        !blockedUids.includes(r.senderUid)
    ).length;
  }, [allPeerRequests, authSummary, blockedUids]);

  const streamAbortRef = useRef<AbortController | null>(null);
  const wordTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser || !authSummary?.canSyncCloud) {
      profileReadyUidRef.current = null;
      return;
    }

    let cancelled = false;
    let unsubMemories: (() => void) | undefined;
    let unsubJournal: (() => void) | undefined;
    let unsubPublicProfiles: (() => void) | undefined;
    let unsubBlocks: (() => void) | undefined;
    let unsubNotifs: (() => void) | undefined;
    let unsubRequests: (() => void) | undefined;
    let unsubConvs: (() => void) | undefined;
    let unsubFeed: (() => void) | undefined;

    Promise.all([ensureUserProfile(firebaseUser, language), ensurePublicProfile(firebaseUser)])
      .then(([prefs, pubProfile]) => {
        if (cancelled) return;
        profileReadyUidRef.current = firebaseUser.uid;
        setProactiveCheckins(prefs.proactiveCheckins);
        setEphemeralMode(prefs.ephemeralMode);
        setMyPublicProfile(pubProfile);

        unsubMemories = subscribeUserMemories(firebaseUser.uid, (cloudMemories) => {
          if (cloudMemories.length > 0) {
            setMemories(cloudMemories);
          }
        });
        unsubJournal = subscribeUserJournal(firebaseUser.uid, (cloudEntries) => {
          if (cloudEntries.length > 0) {
            setJournalEntries(cloudEntries);
          }
        });
        unsubPublicProfiles = subscribePublicProfiles((profiles) => {
          setCloudPublicProfiles(profiles);
          const own = profiles.find((p) => p.uid === firebaseUser.uid);
          if (own) {
            setMyPublicProfile(own);
          }
        });
        unsubBlocks = subscribeUserBlocks(firebaseUser.uid, setBlockedUsers);
        unsubNotifs = subscribeUserNotifications(firebaseUser.uid, setNotifications);
        unsubRequests = subscribePeerRequests(firebaseUser.uid, setCloudPeerRequests);
        unsubConvs = subscribePeerConversations(firebaseUser.uid, setCloudConversations);
        unsubFeed = subscribeFeedPosts(firebaseUser.uid, setCloudFeedPosts);
      })
      .catch((err) => {
        console.error('Failed to initialize sanctuary profile:', err);
      });

    return () => {
      cancelled = true;
      unsubMemories?.();
      unsubJournal?.();
      unsubPublicProfiles?.();
      unsubBlocks?.();
      unsubNotifs?.();
      unsubRequests?.();
      unsubConvs?.();
      unsubFeed?.();
    };
  }, [authReady, firebaseUser, authSummary?.canSyncCloud]);

  useEffect(() => {
    if (
      !selectedConversationId ||
      !authReady ||
      !firebaseUser ||
      !authSummary?.canSyncCloud
    ) {
      return;
    }
    const conv = cloudConversations.find((c) => c.id === selectedConversationId);
    if (!conv || conv.isDemo) return;

    const unsub = subscribePeerMessages(selectedConversationId, firebaseUser.uid, (msgs) => {
      setMessagesByConvId((prev) => ({
        ...prev,
        [selectedConversationId]: msgs,
      }));
    });
    return () => unsub();
  }, [selectedConversationId, authReady, firebaseUser, authSummary?.canSyncCloud, cloudConversations]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories));
    } catch {
      // Ignore storage quota errors
    }
  }, [memories]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.proposal, JSON.stringify(proposal));
    } catch {
      // Ignore storage quota errors
    }
  }, [proposal]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(journalEntries));
    } catch {
      // Ignore storage quota errors
    }
  }, [journalEntries]);

  useEffect(() => {
    const onPopState = () => {
      setScreen(getInitialScreen());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      if (wordTimerRef.current !== null) {
        window.clearTimeout(wordTimerRef.current);
      }
    };
  }, []);

  const cancelActiveStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    if (wordTimerRef.current !== null) {
      window.clearTimeout(wordTimerRef.current);
      wordTimerRef.current = null;
    }
    setIsStreamingReply(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming
          ? {
              ...m,
              isStreaming: false,
              statusLabel: m.paragraphs.length > 0 ? 'Stopped' : m.statusLabel,
            }
          : m
      )
    );
  }, []);

  const navigate = useCallback((nextScreen: AppScreen) => {
    setScreen(nextScreen);
    const url = new URL(window.location.href);
    if (nextScreen === 'home') {
      url.searchParams.delete('screen');
      url.searchParams.delete('autostart');
    } else {
      url.searchParams.set('screen', nextScreen);
    }
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const resetSessionSocialState = useCallback(() => {
    profileReadyUidRef.current = null;
    setMyPublicProfile(null);
    setCloudPublicProfiles([]);
    setBlockedUsers([]);
    setNotifications([]);
    setCloudPeerRequests([]);
    setDemoRequests([]);
    setCloudConversations([]);
    setSelectedConversationId(null);
    setMessagesByConvId({});
    setCloudFeedPosts([]);
    setLocalUnverifiedPosts([]);
    setCommentsByPostId(INITIAL_DEMO_COMMENTS);
    setUserReactions({});
    setDemoReactionOverrides({});
    setPendingNavigation(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    cancelActiveStream();
    try {
      await signOutSanctuary();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      resetSessionSocialState();
      setAuthModalOpen(false);
      navigate('home');
    }
  }, [cancelActiveStream, navigate, resetSessionSocialState]);

  const handleSignOutComplete = useCallback(() => {
    cancelActiveStream();
    resetSessionSocialState();
    navigate('home');
  }, [cancelActiveStream, navigate, resetSessionSocialState]);

  const streamCompanionResponse = useCallback(
    async (
      text: string,
      mode: CompanionMode,
      historyPayload: Array<{ role: 'user' | 'model'; text: string }>,
      compId: string,
      detectedLanguage: 'bangla' | 'banglish' | 'english',
      isVoiceTurn = false
    ) => {
      streamAbortRef.current?.abort();
      if (wordTimerRef.current !== null) {
        window.clearTimeout(wordTimerRef.current);
        wordTimerRef.current = null;
      }

      const controller = new AbortController();
      streamAbortRef.current = controller;
      setIsStreamingReply(true);

      const wordQueue: string[] = [];
      let accumulated = '';
      let streamFinished = false;
      let streamErrored = false;
      let activeLang = detectedLanguage;

      const flushWordLoop = () => {
        if (controller.signal.aborted || streamErrored) return;

        if (wordQueue.length > 0) {
          const nextWord = wordQueue.shift()!;
          accumulated += nextWord;
          const paragraphs = splitParagraphsFromText(accumulated);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === compId
                ? {
                    ...m,
                    paragraphs,
                    detectedLanguage: activeLang,
                    isStreaming: true,
                  }
                : m
            )
          );

          const delay = computeWordRevealDelay(nextWord);
          wordTimerRef.current = window.setTimeout(flushWordLoop, delay);
          return;
        }

        if (streamFinished) {
          const finalText = accumulated.trim();
          if (!finalText) {
            setIsStreamingReply(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === compId
                  ? {
                      ...m,
                      isStreaming: false,
                      error: 'SHONGI could not generate a reply right now. Please tap Try Again.',
                      statusLabel: 'Needs attention',
                    }
                  : m
              )
            );
            return;
          }

          const finalParagraphs = splitParagraphsFromText(finalText);
          const nowDone = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === compId
                ? {
                    ...m,
                    paragraphs: finalParagraphs,
                    detectedLanguage: activeLang,
                    isStreaming: false,
                    timestamp: nowDone,
                    statusLabel: 'Companion Safe',
                  }
                : m
            )
          );
          setIsStreamingReply(false);
          setLastCompletedReply({
            id: compId,
            text: finalText,
            language: activeLang,
          });
          return;
        }

        wordTimerRef.current = window.setTimeout(flushWordLoop, 18);
      };

      wordTimerRef.current = window.setTimeout(flushWordLoop, 20);

      try {
        const response = await fetch('/api/companion/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: historyPayload,
            mode,
            memories,
            isVoiceTurn,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMsg = `Request failed (${response.status})`;
          try {
            const errJson = (await response.json()) as { error?: string };
            if (errJson.error) errorMsg = errJson.error;
          } catch {
            // Use status fallback
          }
          throw new Error(errorMsg);
        }

        if (!response.body) {
          throw new Error('Streaming response body unavailable.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEventBlock = (rawEvent: string) => {
          const lines = rawEvent
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());

          for (const jsonLine of lines) {
            if (!jsonLine) continue;
            const parsed = JSON.parse(jsonLine) as {
              type?: string;
              text?: string;
              language?: 'bangla' | 'banglish' | 'english';
              message?: string;
            };

            if (parsed.type === 'meta' && parsed.language) {
              activeLang = parsed.language;
            } else if (parsed.type === 'chunk' && parsed.text) {
              const tokens = parsed.text.match(/\S+\s*|\s+/g) ?? [parsed.text];
              wordQueue.push(...tokens);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message || 'Unable to generate reply right now.');
            } else if (parsed.type === 'done') {
              if (parsed.language) activeLang = parsed.language;
              streamFinished = true;
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              processEventBlock(buffer);
              buffer = '';
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? '';

          for (const rawEvent of events) {
            processEventBlock(rawEvent);
          }
        }

        streamFinished = true;
      } catch (err) {
        if (controller.signal.aborted) return;
        streamErrored = true;
        if (wordTimerRef.current !== null) {
          window.clearTimeout(wordTimerRef.current);
          wordTimerRef.current = null;
        }
        const messageText =
          err instanceof Error ? err.message : 'Unable to connect to SHONGI companion service.';
        setIsStreamingReply(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === compId
              ? {
                  ...m,
                  isStreaming: false,
                  error: messageText,
                  statusLabel: 'Needs attention',
                }
              : m
          )
        );
      }
    },
    [memories]
  );

  const handleSendMessage = useCallback(
    (text: string, mode: CompanionMode, options?: { isVoiceTurn?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (streamAbortRef.current) {
        cancelActiveStream();
      }

      const nowStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const detectedLanguage = detectCompanionLanguage(trimmed);

      const historyPayload = sanitizeChatHistory(
        messages
          .filter((m) => !m.error && m.paragraphs.length > 0)
          .map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('model' as const),
            text: m.paragraphs.join('\n\n'),
          }))
      );

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        paragraphs: [trimmed],
        timestamp: nowStr,
        statusLabel: options?.isVoiceTurn ? 'Spoken' : 'Delivered',
        detectedLanguage,
      };

      const compId = `comp-${Date.now() + 1}`;
      const companionMsg: ChatMessage = {
        id: compId,
        role: 'companion',
        paragraphs: [],
        timestamp: nowStr,
        modeLabel: getModeLabel(mode),
        detectedLanguage,
        isStreaming: true,
        statusLabel: 'Typing...',
      };

      setMessages((prev) => [...prev, userMsg, companionMsg]);
      void streamCompanionResponse(
        trimmed,
        mode,
        historyPayload,
        compId,
        detectedLanguage,
        Boolean(options?.isVoiceTurn)
      );
    },
    [cancelActiveStream, messages, streamCompanionResponse]
  );

  const handleRetryMessage = (failedCompId: string, mode: CompanionMode) => {
    const failedIdx = messages.findIndex((m) => m.id === failedCompId);
    if (failedIdx <= 0) return;

    let precedingUserText = '';
    for (let i = failedIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        precedingUserText = messages[i].paragraphs.join(' ').trim();
        break;
      }
    }
    if (!precedingUserText) return;

    const detectedLanguage = detectCompanionLanguage(precedingUserText);
    const historyPayload = sanitizeChatHistory(
      messages
        .slice(0, Math.max(0, failedIdx - 1))
        .filter((m) => !m.error && m.paragraphs.length > 0)
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('model' as const),
          text: m.paragraphs.join('\n\n'),
        }))
    );

    setMessages((prev) =>
      prev.map((m) =>
        m.id === failedCompId
          ? {
              ...m,
              paragraphs: [],
              error: undefined,
              isStreaming: true,
              modeLabel: getModeLabel(mode),
              detectedLanguage,
              statusLabel: 'Typing...',
            }
          : m
      )
    );

    void streamCompanionResponse(
      precedingUserText,
      mode,
      historyPayload,
      failedCompId,
      detectedLanguage
    );
  };

  const handleContinueAnonymously = async () => {
    const destination = pendingNavigation?.screen ?? 'ai-companion';
    const queuedThought = pendingNavigation?.thought;

    if (firebaseUser) {
      if (queuedThought && destination === 'ai-companion') {
        handleSendMessage(queuedThought, 'listening');
      }
      setPendingNavigation(null);
      navigate(destination);
      return;
    }

    try {
      await signInAnonymouslyPrivate();
      if (queuedThought && destination === 'ai-companion') {
        handleSendMessage(queuedThought, 'listening');
      }
      setPendingNavigation(null);
      navigate(destination);
    } catch {
      setAuthModalOpen(true);
    }
  };

  const handleEnterWorkspaceFromHome = (targetScreen: AppScreen, initialThought?: string) => {
    if (targetScreen === 'crisis-resources') {
      navigate(targetScreen);
      return;
    }

    if (!firebaseUser) {
      setPendingNavigation({ screen: targetScreen, thought: initialThought });
      setAuthModalOpen(true);
      return;
    }

    if (initialThought && targetScreen === 'ai-companion') {
      handleSendMessage(initialThought, 'listening');
    }
    navigate(targetScreen);
  };

  const handleAuthSuccess = () => {
    if (pendingNavigation) {
      const { screen: targetScreen, thought } = pendingNavigation;
      setPendingNavigation(null);
      if (thought && targetScreen === 'ai-companion') {
        handleSendMessage(thought, 'listening');
      }
      navigate(targetScreen);
    }
  };

  const syncMemoryCreateIfReady = (mem: ApprovedMemory) => {
    if (firebaseUser && authSummary?.canSyncCloud && profileReadyUidRef.current === firebaseUser.uid) {
      void saveMemoryDoc(firebaseUser.uid, mem).catch((err) => {
        console.error('Memory sync error:', err);
      });
    }
  };

  const handleApproveProposal = (customText?: string) => {
    const res = approveMemoryProposal(memories, proposal, customText);
    setMemories(res.memories);
    setProposal(res.proposal);
    const latest = res.memories[res.memories.length - 1];
    if (latest) syncMemoryCreateIfReady(latest);
  };

  const handleEditProposalText = (newText: string) => {
    setProposal((prev) => ({ ...prev, text: newText }));
  };

  const handleDismissProposal = () => {
    setProposal((prev) => ({ ...prev, status: 'dismissed' }));
  };

  const handleAddMemory = (text: string) => {
    if (memories.length >= MAX_APPROVED_MEMORIES) return;
    const newMem: ApprovedMemory = {
      id: `mem-${Date.now()}`,
      text,
      meta: 'Added in Privacy Hub • Persistent',
      isNew: true,
    };
    setMemories((prev) => [...prev, newMem]);
    syncMemoryCreateIfReady(newMem);
  };

  const handleRemoveMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    if (firebaseUser && authSummary?.canSyncCloud && profileReadyUidRef.current === firebaseUser.uid) {
      void deleteMemoryDoc(firebaseUser.uid, id).catch((err) => {
        console.error('Memory delete sync error:', err);
      });
    }
  };

  const handleClearAllMemories = () => {
    const ids = memories.map((m) => m.id);
    setMemories([]);
    if (firebaseUser && authSummary?.canSyncCloud && profileReadyUidRef.current === firebaseUser.uid) {
      void clearAllMemoryDocs(firebaseUser.uid, ids).catch((err) => {
        console.error('Memory clear sync error:', err);
      });
    }
  };

  const handleSaveJournalEntry = (entry: JournalEntry) => {
    setJournalEntries((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      if (exists) {
        return prev.map((e) => (e.id === entry.id ? entry : e));
      }
      return [entry, ...prev];
    });
    if (firebaseUser && authSummary?.canSyncCloud && profileReadyUidRef.current === firebaseUser.uid) {
      void saveJournalDoc(firebaseUser.uid, entry).catch((err) => {
        console.error('Journal save sync error:', err);
      });
    }
  };

  const handleDeleteJournalEntry = (id: string) => {
    setJournalEntries((prev) => prev.filter((e) => e.id !== id));
    if (firebaseUser && authSummary?.canSyncCloud && profileReadyUidRef.current === firebaseUser.uid) {
      void deleteJournalDoc(firebaseUser.uid, id).catch((err) => {
        console.error('Journal delete sync error:', err);
      });
    }
  };

  const handleUpdateConsent = (patch: { proactiveCheckins?: boolean; ephemeralMode?: boolean }) => {
    if (patch.proactiveCheckins !== undefined) {
      setProactiveCheckins(patch.proactiveCheckins);
    }
    if (patch.ephemeralMode !== undefined) {
      setEphemeralMode(patch.ephemeralMode);
    }
    if (firebaseUser && authSummary?.canSyncCloud && profileReadyUidRef.current === firebaseUser.uid) {
      void updateUserConsentPreferences(firebaseUser.uid, patch).catch((err) => {
        console.error('Consent preference sync error:', err);
      });
    }
  };

  const handleSavePublicProfile = async (updated: UserPublicProfile) => {
    setMyPublicProfile(updated);
    if (firebaseUser && authSummary?.canSyncCloud) {
      await savePublicProfileDoc({ ...updated, uid: firebaseUser.uid });
    }
  };

  const handleSendPeerRequest = async (
    recipient: UserPublicProfile,
    introMessage: string,
    sharedSummary: string
  ) => {
    if (!authSummary) {
      setAuthModalOpen(true);
      throw new Error('Please sign in first.');
    }

    const check = canSendPeerRequest(authSummary.uid, recipient, allPeerRequests, blockedUids);
    if (!check.allowed) {
      throw new Error(check.reason || 'Unable to send request right now.');
    }

    const reqId = `preq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const senderTags = [...effectiveMyProfile.statusTags, ...effectiveMyProfile.interests];
    const recipientTags = [...recipient.statusTags, ...recipient.interests];

    if (recipient.isDemo) {
      const demoReq: PeerConversationRequest = {
        id: reqId,
        senderUid: authSummary.uid,
        senderName: effectiveMyProfile.displayName,
        senderAvatarTone: effectiveMyProfile.avatarTone,
        senderTags,
        recipientUid: recipient.uid,
        recipientName: recipient.displayName,
        recipientAvatarTone: recipient.avatarTone,
        recipientTags,
        status: 'pending',
        introMessage,
        sharedContextSummary: sharedSummary,
        ignoredByRecipient: false,
        isDemoTarget: true,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      setDemoRequests((prev) => [demoReq, ...prev]);
      return;
    }

    if (!authSummary.canSyncCloud) {
      setAuthModalOpen(true);
      throw new Error('Please verify your email address before connecting with community members.');
    }

    await createPeerRequestDoc({
      id: reqId,
      senderUid: authSummary.uid,
      senderName: effectiveMyProfile.displayName,
      senderAvatarTone: effectiveMyProfile.avatarTone,
      senderTags,
      recipientUid: recipient.uid,
      recipientName: recipient.displayName,
      recipientAvatarTone: recipient.avatarTone,
      recipientTags,
      status: 'pending',
      introMessage,
      sharedContextSummary: sharedSummary,
      ignoredByRecipient: false,
    });

    await createNotificationDoc(recipient.uid, authSummary.uid, {
      type: 'peer_request',
      title: 'New conversation request',
      body: `${effectiveMyProfile.displayName} sent a gentle introduction.`,
      relatedId: reqId,
    });
  };

  const handleAcceptPeerRequest = async (
    req: PeerConversationRequest
  ): Promise<PeerConversation | null> => {
    if (!authSummary || !authSummary.canSyncCloud || req.isDemoTarget) return null;
    const conv = await acceptPeerRequestAndCreateConversation(req);
    await createNotificationDoc(req.senderUid, authSummary.uid, {
      type: 'request_accepted',
      title: 'Conversation request accepted',
      body: `${effectiveMyProfile.displayName} accepted your conversation request.`,
      relatedId: conv.id,
    });
    return conv;
  };

  const handleDeclinePeerRequest = async (req: PeerConversationRequest) => {
    if (req.isDemoTarget) {
      setDemoRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: 'declined', updatedAtMs: Date.now() } : r
        )
      );
      return;
    }
    await updatePeerRequestStatusDoc(req.id, 'declined');
  };

  const handleCancelPeerRequest = async (req: PeerConversationRequest) => {
    if (req.isDemoTarget) {
      setDemoRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: 'cancelled', updatedAtMs: Date.now() } : r
        )
      );
      return;
    }
    await updatePeerRequestStatusDoc(req.id, 'cancelled');
  };

  const handleIgnorePeerRequest = async (req: PeerConversationRequest) => {
    if (req.isDemoTarget) {
      setDemoRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, ignoredByRecipient: true } : r))
      );
      return;
    }
    await ignorePeerRequestDoc(req.id);
  };

  const handleSendPeerMessage = async (conv: PeerConversation, text: string) => {
    if (!authSummary || !authSummary.canSyncCloud) {
      throw new Error('Please sign in with cloud sync enabled to message.');
    }
    await sendPeerMessageDoc(conv, authSummary.uid, effectiveMyProfile.displayName, text);
    const otherUid = conv.participantUids.find((id) => id !== authSummary.uid);
    if (otherUid) {
      await createNotificationDoc(otherUid, authSummary.uid, {
        type: 'peer_message',
        title: `Message from ${effectiveMyProfile.displayName}`,
        body: text.slice(0, 120),
        relatedId: conv.id,
      });
    }
  };

  const handleEndPeerConversation = async (conv: PeerConversation) => {
    if (!authSummary) return;
    await endPeerConversationDoc(conv.id, authSummary.uid);
  };

  const handleBlockUser = async (
    targetUid: string,
    targetName: string,
    relatedRequest?: PeerConversationRequest,
    relatedConv?: PeerConversation
  ) => {
    if (!authSummary || !authSummary.canSyncCloud) return;
    await blockUserDoc(authSummary.uid, targetUid, targetName);
    if (relatedRequest && relatedRequest.status === 'pending') {
      if (relatedRequest.isDemoTarget) {
        setDemoRequests((prev) =>
          prev.map((r) => (r.id === relatedRequest.id ? { ...r, status: 'blocked' } : r))
        );
      } else {
        await updatePeerRequestStatusDoc(relatedRequest.id, 'blocked');
      }
    }
    if (relatedConv && relatedConv.status === 'active') {
      await endPeerConversationDoc(relatedConv.id, authSummary.uid);
    }
  };

  const handleUnblockUser = async (targetUid: string) => {
    if (!authSummary || !authSummary.canSyncCloud) return;
    await unblockUserDoc(authSummary.uid, targetUid);
  };

  const handleMarkNotificationRead = (notifId: string) => {
    if (!authSummary || !authSummary.canSyncCloud) return;
    void markNotificationReadDoc(authSummary.uid, notifId).catch((err) => {
      console.error('Mark notification read error:', err);
    });
  };

  const handleCreatePost = async (input: {
    postType: FeedPostType;
    mood?: string;
    title?: string;
    body: string;
    tags: string[];
    visibility: FeedVisibility;
  }) => {
    if (!authSummary) {
      setAuthModalOpen(true);
      throw new Error('Please sign in first.');
    }

    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const basePost: FeedPost = {
      id: postId,
      authorUid: authSummary.uid,
      authorName: effectiveMyProfile.displayName,
      authorAvatarTone: effectiveMyProfile.avatarTone,
      postType: input.postType,
      mood: input.mood,
      title: input.title,
      body: input.body,
      tags: input.tags,
      visibility: input.visibility,
      reactionCounts: {
        hear_you: 0,
        sending_support: 0,
        relatable: 0,
        you_got_this: 0,
      },
      commentCount: 0,
      isDemo: false,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    if (!authSummary.canSyncCloud) {
      setLocalUnverifiedPosts((prev) => [basePost, ...prev]);
      return;
    }

    await createFeedPostDoc(basePost);
  };

  const handleUpdatePost = async (
    post: FeedPost,
    patch: {
      postType: FeedPostType;
      mood?: string;
      title?: string;
      body: string;
      tags: string[];
      visibility: FeedVisibility;
    }
  ) => {
    if (localUnverifiedPosts.some((p) => p.id === post.id)) {
      setLocalUnverifiedPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, ...patch, updatedAtMs: Date.now() } : p))
      );
      return;
    }
    await updateFeedPostDoc(post.id, patch);
  };

  const handleDeletePost = async (post: FeedPost) => {
    if (localUnverifiedPosts.some((p) => p.id === post.id)) {
      setLocalUnverifiedPosts((prev) => prev.filter((p) => p.id !== post.id));
      return;
    }
    await deleteFeedPostDoc(post.id);
  };

  const handleToggleReaction = async (post: FeedPost, reactionType: FeedReactionType) => {
    if (!authSummary) {
      setAuthModalOpen(true);
      return;
    }

    if (post.isDemo || localUnverifiedPosts.some((p) => p.id === post.id)) {
      setDemoReactionOverrides((prev) => {
        const current = prev[post.id] ?? {
          counts: { ...post.reactionCounts },
          userReaction: null,
        };
        const nextCounts = { ...current.counts };
        let nextUserReaction: FeedReactionType | null = reactionType;
        if (current.userReaction) {
          nextCounts[current.userReaction] = Math.max(0, (nextCounts[current.userReaction] ?? 0) - 1);
          if (current.userReaction === reactionType) {
            nextUserReaction = null;
          } else {
            nextCounts[reactionType] = (nextCounts[reactionType] ?? 0) + 1;
          }
        } else {
          nextCounts[reactionType] = (nextCounts[reactionType] ?? 0) + 1;
        }
        return {
          ...prev,
          [post.id]: { counts: nextCounts, userReaction: nextUserReaction },
        };
      });
      return;
    }

    const prevReaction = userReactions[post.id] ?? null;
    const nextReaction = prevReaction === reactionType ? null : reactionType;
    setUserReactions((prev) => ({ ...prev, [post.id]: nextReaction }));
    await toggleFeedReactionDoc(post, authSummary.uid, reactionType);
  };

  const handleLoadComments = async (post: FeedPost) => {
    if (post.isDemo || !authSummary?.canSyncCloud) return;
    const loaded = await fetchFeedComments(post.id);
    setCommentsByPostId((prev) => ({ ...prev, [post.id]: loaded }));
  };

  const handleAddComment = async (post: FeedPost, body: string) => {
    if (!authSummary) {
      setAuthModalOpen(true);
      return;
    }

    if (post.isDemo || !authSummary.canSyncCloud) {
      const localCmt: FeedComment = {
        id: `local-cmt-${Date.now()}`,
        postId: post.id,
        authorUid: authSummary.uid,
        authorName: effectiveMyProfile.displayName,
        body,
        createdAtMs: Date.now(),
      };
      setCommentsByPostId((prev) => ({
        ...prev,
        [post.id]: [...(prev[post.id] ?? []), localCmt],
      }));
      return;
    }

    const saved = await addFeedCommentDoc(
      post,
      authSummary.uid,
      effectiveMyProfile.displayName,
      body
    );
    setCommentsByPostId((prev) => ({
      ...prev,
      [post.id]: [...(prev[post.id] ?? []), saved],
    }));
  };

  const handleDeleteComment = async (post: FeedPost, commentId: string) => {
    setCommentsByPostId((prev) => ({
      ...prev,
      [post.id]: (prev[post.id] ?? []).filter((c) => c.id !== commentId),
    }));
    if (!post.isDemo && authSummary?.canSyncCloud && !commentId.startsWith('local-cmt-')) {
      await deleteFeedCommentDoc(post, commentId);
    }
  };

  const handleReportContent = async (payload: {
    targetType: 'user' | 'post' | 'comment' | 'conversation';
    targetId: string;
    targetUid?: string;
    reason: string;
    details?: string;
  }) => {
    if (!authSummary || !authSummary.canSyncCloud) return;
    await createModerationReportDoc({
      reporterUid: authSummary.uid,
      ...payload,
    });
  };

  const isProtectedScreen = screen !== 'home' && screen !== 'crisis-resources';

  return (
    <>
      {screen === 'home' ? (
        <PublicHomepage
          language={language}
          authSummary={authSummary}
          onToggleLanguage={() => setLanguage((prev) => (prev === 'en' ? 'bn' : 'en'))}
          onEnterWorkspace={handleEnterWorkspaceFromHome}
          onOpenAuth={() => setAuthModalOpen(true)}
          onContinueAnonymously={() => void handleContinueAnonymously()}
          onSignOut={() => void handleSignOut()}
        />
      ) : (
        <DashboardShell
          activeScreen={screen}
          language={language}
          authSummary={authSummary}
          pendingRequestsCount={pendingReceivedCount}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onNavigate={navigate}
          onSetLanguage={setLanguage}
          onOpenAuth={() => setAuthModalOpen(true)}
          onSignOut={() => void handleSignOut()}
        >
          {isProtectedScreen && !authReady ? (
            <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-surface-container animate-pulse" />
              <p className="text-[14px] text-on-surface-variant">
                Restoring your private sanctuary session...
              </p>
            </div>
          ) : isProtectedScreen && !authSummary ? (
            <div
              data-testid="auth-required-gate"
              className="max-w-xl mx-auto px-6 py-16"
            >
              <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-8 shadow-sm text-center space-y-5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#2F6F63]/12 text-[#2F6F63] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">lock</span>
                </div>
                <div className="space-y-2">
                  <h1 className="text-[22px] font-semibold text-primary">
                    Sign in to enter your SHONGI space
                  </h1>
                  <p className="text-[14px] text-on-surface-variant leading-[1.6]">
                    Your conversations, discovery tags, community posts, and encrypted journal stay
                    strictly tied to your session. Start anonymously in one tap or sign in with
                    Google or verified email.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    data-testid="gate-anon-btn"
                    onClick={() => {
                      setPendingNavigation({ screen });
                      void handleContinueAnonymously();
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors"
                  >
                    Start Privately (Anonymous)
                  </button>
                  <button
                    type="button"
                    data-testid="gate-signin-btn"
                    onClick={() => {
                      setPendingNavigation({ screen });
                      setAuthModalOpen(true);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-surface-container text-primary text-[13px] font-semibold hover:bg-surface-container-high transition-colors"
                  >
                    Google / Email Login
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('home')}
                  className="text-[12px] font-medium text-on-surface-variant hover:text-primary"
                >
                  ← Return to SHONGI Home
                </button>
              </div>
            </div>
          ) : (
            <>
              {screen === 'ai-companion' && (
                <AiCompanionView
                  language={language}
                  messages={messages}
                  memories={memories}
                  proposal={proposal}
                  isStreamingReply={isStreamingReply}
                  lastCompletedReply={lastCompletedReply}
                  onSendMessage={handleSendMessage}
                  onRetryMessage={handleRetryMessage}
                  onStopStreaming={cancelActiveStream}
                  onPurgeMessages={() => {
                    cancelActiveStream();
                    setMessages([]);
                  }}
                  onApproveProposal={handleApproveProposal}
                  onEditProposalText={handleEditProposalText}
                  onDismissProposal={handleDismissProposal}
                  onRemoveMemory={handleRemoveMemory}
                  onNavigate={navigate}
                />
              )}

              {screen === 'encrypted-journal' && (
                <EncryptedJournalView
                  entries={journalEntries}
                  onSaveEntry={handleSaveJournalEntry}
                  onDeleteEntry={handleDeleteJournalEntry}
                />
              )}

              {screen === 'peer-pilot' && (
                <PeerPilotView
                  authSummary={authSummary}
                  myProfile={effectiveMyProfile}
                  candidates={candidateProfiles}
                  blockedUids={blockedUids}
                  requests={allPeerRequests}
                  conversations={cloudConversations}
                  activeMessagesByConvId={messagesByConvId}
                  onSelectConversation={setSelectedConversationId}
                  onSendRequest={handleSendPeerRequest}
                  onAcceptRequest={handleAcceptPeerRequest}
                  onDeclineRequest={handleDeclinePeerRequest}
                  onCancelRequest={handleCancelPeerRequest}
                  onIgnoreRequest={handleIgnorePeerRequest}
                  onSendMessage={handleSendPeerMessage}
                  onEndConversation={handleEndPeerConversation}
                  onBlockUser={handleBlockUser}
                  onReportContent={handleReportContent}
                  onNavigate={navigate}
                />
              )}

              {screen === 'community-feed' && (
                <CommunityFeedView
                  authSummary={authSummary}
                  myProfile={effectiveMyProfile}
                  posts={allFeedPosts}
                  blockedUids={blockedUids}
                  commentsByPostId={commentsByPostId}
                  onCreatePost={handleCreatePost}
                  onUpdatePost={handleUpdatePost}
                  onDeletePost={handleDeletePost}
                  onToggleReaction={handleToggleReaction}
                  onLoadComments={handleLoadComments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onReportContent={handleReportContent}
                  onNavigate={navigate}
                />
              )}

              {screen === 'crisis-resources' && <CrisisResourcesView onNavigate={navigate} />}

              {screen === 'privacy-memory-hub' && (
                <PrivacyMemoryHubView
                  memories={memories}
                  authSummary={authSummary}
                  myProfile={effectiveMyProfile}
                  blockedUsers={blockedUsers}
                  proactiveCheckins={proactiveCheckins}
                  ephemeralMode={ephemeralMode}
                  onSavePublicProfile={handleSavePublicProfile}
                  onUnblockUser={handleUnblockUser}
                  onUpdateConsent={handleUpdateConsent}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onSignOut={() => void handleSignOut()}
                  onAddMemory={handleAddMemory}
                  onRemoveMemory={handleRemoveMemory}
                  onClearAllMemories={handleClearAllMemories}
                  onNavigate={navigate}
                />
              )}
            </>
          )}
        </DashboardShell>
      )}

      <AuthModal
        isOpen={authModalOpen}
        authSummary={authSummary}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingNavigation(null);
        }}
        onAuthSuccess={handleAuthSuccess}
        onSignOutComplete={handleSignOutComplete}
      />
    </>
  );
}
