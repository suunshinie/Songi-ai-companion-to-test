import React, { useEffect, useMemo, useState } from 'react';
import {
  AppScreen,
  AuthAccountSummary,
  AvatarTone,
  PeerChatMessage,
  PeerConversation,
  PeerConversationRequest,
  UserPublicProfile,
} from '../types/shongi';
import {
  ALL_STATUS_TAGS,
  AVAILABILITY_META,
  canSendPeerRequest,
  canTransitionRequestStatus,
  computePeerRecommendations,
  INTEREST_TAGS,
  moderateUserContent,
} from '../utils/shongiLogic';

interface PeerPilotViewProps {
  authSummary: AuthAccountSummary | null;
  myProfile: UserPublicProfile;
  candidates: UserPublicProfile[];
  blockedUids: string[];
  requests: PeerConversationRequest[];
  conversations: PeerConversation[];
  activeMessagesByConvId: Record<string, PeerChatMessage[]>;
  onSelectConversation: (conversationId: string | null) => void;
  onSendRequest: (recipient: UserPublicProfile, introMessage: string, sharedSummary: string) => Promise<void>;
  onAcceptRequest: (req: PeerConversationRequest) => Promise<PeerConversation | null>;
  onDeclineRequest: (req: PeerConversationRequest) => Promise<void>;
  onCancelRequest: (req: PeerConversationRequest) => Promise<void>;
  onIgnoreRequest: (req: PeerConversationRequest) => Promise<void>;
  onSendMessage: (conversation: PeerConversation, text: string) => Promise<void>;
  onEndConversation: (conversation: PeerConversation) => Promise<void>;
  onBlockUser: (targetUid: string, targetName: string, relatedRequest?: PeerConversationRequest, relatedConv?: PeerConversation) => Promise<void>;
  onReportContent: (payload: {
    targetType: 'user' | 'conversation';
    targetId: string;
    targetUid?: string;
    reason: string;
    details?: string;
  }) => Promise<void>;
  onNavigate: (screen: AppScreen) => void;
}

type PeerTab = 'discover' | 'received' | 'sent' | 'chats';

function getAvatarToneClass(tone: AvatarTone): string {
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

export const PeerPilotView: React.FC<PeerPilotViewProps> = ({
  authSummary,
  myProfile,
  candidates,
  blockedUids,
  requests,
  conversations,
  activeMessagesByConvId,
  onSelectConversation,
  onSendRequest,
  onAcceptRequest,
  onDeclineRequest,
  onCancelRequest,
  onIgnoreRequest,
  onSendMessage,
  onEndConversation,
  onBlockUser,
  onReportContent,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<PeerTab>('discover');
  const [filterTag, setFilterTag] = useState<string>('');
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  // Send request modal
  const [requestTarget, setRequestTarget] = useState<{
    profile: UserPublicProfile;
    explanation: string;
  } | null>(null);
  const [introMessage, setIntroMessage] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [crisisDetectedNotice, setCrisisDetectedNotice] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Active conversation selection & composer
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Report modal
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'user' | 'conversation';
    targetId: string;
    targetUid?: string;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Boundary or safety concern');
  const [reportDetails, setReportDetails] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    onSelectConversation(activeTab === 'chats' ? selectedConvId : null);
  }, [activeTab, selectedConvId, onSelectConversation]);

  const myUid = authSummary?.uid ?? myProfile.uid;

  const recommendations = useMemo(
    () => computePeerRecommendations(myProfile, candidates, blockedUids, filterTag),
    [myProfile, candidates, blockedUids, filterTag]
  );

  const receivedRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.recipientUid === myUid &&
          !blockedUids.includes(r.senderUid) &&
          !(r.status === 'pending' && r.ignoredByRecipient)
      ),
    [requests, myUid, blockedUids]
  );

  const pendingReceivedCount = useMemo(
    () => receivedRequests.filter((r) => r.status === 'pending').length,
    [receivedRequests]
  );

  const sentRequests = useMemo(
    () => requests.filter((r) => r.senderUid === myUid),
    [requests, myUid]
  );

  const visibleConversations = useMemo(
    () =>
      conversations.filter((c) => {
        const otherUid = c.participantUids.find((id) => id !== myUid);
        return !otherUid || !blockedUids.includes(otherUid);
      }),
    [conversations, myUid, blockedUids]
  );

  const activeConv =
    visibleConversations.find((c) => c.id === selectedConvId) ?? visibleConversations[0] ?? null;

  useEffect(() => {
    if (activeTab === 'chats' && !selectedConvId && visibleConversations.length > 0) {
      setSelectedConvId(visibleConversations[0].id);
    }
  }, [activeTab, selectedConvId, visibleConversations]);

  const handleOpenSendModal = (profile: UserPublicProfile, explanation: string) => {
    const check = canSendPeerRequest(myUid, profile, requests, blockedUids);
    if (!check.allowed) {
      showToast(check.reason || 'Unable to send request right now.');
      return;
    }
    setRequestTarget({ profile, explanation });
    setIntroMessage('');
    setRequestError(null);
    setCrisisDetectedNotice(false);
  };

  const handleConfirmSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTarget) return;
    const textToValidate = introMessage.trim() || 'Hi, I noticed we share some similar experiences and would be glad to talk when you have time.';
    const mod = moderateUserContent(textToValidate);
    if (!mod.allowed) {
      setRequestError(mod.warningReason || 'Please adjust your message before sending.');
      return;
    }
    setCrisisDetectedNotice(mod.isCrisisDetected);
    setSendingRequest(true);
    setRequestError(null);
    try {
      await onSendRequest(requestTarget.profile, textToValidate, requestTarget.explanation);
      setRequestTarget(null);
      setIntroMessage('');
      showToast(`Conversation request sent to ${requestTarget.profile.displayName}.`);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Unable to send request right now.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAccept = async (req: PeerConversationRequest) => {
    if (!canTransitionRequestStatus(req.status, 'accepted', 'recipient')) return;
    const createdConv = await onAcceptRequest(req);
    showToast(`Connected with ${req.senderName}.`);
    if (createdConv) {
      setSelectedConvId(createdConv.id);
      setActiveTab('chats');
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || activeConv.status !== 'active') return;
    const mod = moderateUserContent(messageDraft);
    if (!mod.allowed) {
      setMessageError(mod.warningReason || 'Please revise your message.');
      return;
    }
    setCrisisDetectedNotice(mod.isCrisisDetected);
    setMessageError(null);
    setSendingMessage(true);
    try {
      await onSendMessage(activeConv, messageDraft.trim());
      setMessageDraft('');
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    await onReportContent({
      targetType: reportTarget.targetType,
      targetId: reportTarget.targetId,
      targetUid: reportTarget.targetUid,
      reason: reportReason,
      details: reportDetails.trim() || undefined,
    });
    setReportTarget(null);
    setReportDetails('');
    showToast('Confidential report recorded. Thank you for helping keep SHONGI safe.');
  };

  const popularFilterTags = useMemo(() => {
    const combined = Array.from(
      new Set([...myProfile.statusTags, ...myProfile.interests, ...ALL_STATUS_TAGS.slice(0, 6), ...INTEREST_TAGS.slice(0, 4)])
    );
    return combined.slice(0, 12);
  }, [myProfile.statusTags, myProfile.interests]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-surface-container-low p-6 lg:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-semibold uppercase tracking-wider">
              Find Your People
            </span>
            <span className="text-[12px] text-on-surface-variant bangla-text">
              একই পথের সহযাত্রী খুঁজুন
            </span>
          </div>
          <h1 className="text-[24px] font-semibold text-primary">
            People You May Relate To
          </h1>
          <p className="text-[14px] text-on-surface-variant max-w-3xl leading-[1.6]">
            Discover others based on shared experiences, student life, career questions, or interests
            you choose to share. Connections only open after both sides accept—never random, and not
            a replacement for clinical therapy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('privacy-memory-hub')}
            className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-medium hover:bg-primary-container transition-colors"
          >
            Edit My Tags ({myProfile.statusTags.length + myProfile.interests.length})
          </button>
          <button
            type="button"
            onClick={() => setGuidelinesOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-surface text-primary text-[13px] font-medium border border-outline-variant/40 hover:bg-surface-container-high transition-colors"
          >
            Safety Code
          </button>
        </div>
      </div>

      {/* Gentle Crisis Support Banner when crisis keywords are typed */}
      {crisisDetectedNotice && (
        <div className="p-4 rounded-2xl bg-secondary-fixed/50 border border-secondary/30 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[14px] font-semibold text-on-secondary-fixed">
              You don&apos;t have to carry something this heavy alone.
            </p>
            <p className="text-[13px] text-on-secondary-fixed-variant leading-[1.6]">
              If you&apos;re feeling overwhelmed or unsafe right now, Kaan Pete Roi (09612-119911)
              and National Emergency Service (999) are available for immediate support.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('crisis-resources')}
            className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-[12px] font-semibold hover:bg-on-secondary-fixed-variant"
          >
            View BD Helplines
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant/30 pb-3">
        {(
          [
            { id: 'discover', label: 'Discover People', count: recommendations.length },
            { id: 'received', label: 'Received Requests', count: pendingReceivedCount },
            { id: 'sent', label: 'Sent Requests', count: sentRequests.filter((r) => r.status === 'pending').length },
            { id: 'chats', label: 'Active Conversations', count: visibleConversations.filter((c) => c.status === 'active').length },
          ] as Array<{ id: PeerTab; label: string; count: number }>
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`peer-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                    isActive
                      ? 'bg-surface/20 text-on-primary'
                      : 'bg-surface-container-highest text-primary'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DISCOVER PEOPLE */}
      {activeTab === 'discover' && (
        <div className="space-y-6">
          {myProfile.statusTags.length === 0 && myProfile.interests.length === 0 && (
            <div className="p-4 rounded-2xl bg-secondary-fixed/40 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-on-secondary-fixed leading-[1.6]">
                Select a few optional status tags or interests in your profile so SHONGI can explain
                why someone relates to your situation.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('privacy-memory-hub')}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold"
              >
                Choose My Tags
              </button>
            </div>
          )}

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-on-surface-variant mr-1">Filter by:</span>
            <button
              type="button"
              onClick={() => setFilterTag('')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                filterTag === ''
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Best Matches
            </button>
            {popularFilterTags.map((tag) => {
              const active = filterTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilterTag((prev) => (prev === tag ? '' : tag))}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {recommendations.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-lowest p-10 text-center space-y-3 shadow-xs">
              <p className="text-[16px] font-medium text-primary">
                No matching peers found for this filter right now.
              </p>
              <p className="text-[13px] text-on-surface-variant max-w-md mx-auto leading-[1.6]">
                Try clearing the filter or adding more interests in your profile. Remember, you can
                also talk with SHONGI Companion or reflect in the Community Feed anytime.
              </p>
              {filterTag && (
                <button
                  type="button"
                  onClick={() => setFilterTag('')}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-[13px] font-medium"
                >
                  Show All Available Peers
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recommendations.map((rec) => {
                const { profile, sharedStatusTags, sharedInterests, explanation } = rec;
                const availMeta = AVAILABILITY_META[profile.availability];
                const existingPairReq = requests.find(
                  (r) =>
                    ((r.senderUid === myUid && r.recipientUid === profile.uid) ||
                      (r.senderUid === profile.uid && r.recipientUid === myUid)) &&
                    (r.status === 'pending' || r.status === 'accepted')
                );

                return (
                  <div
                    key={profile.uid}
                    data-testid={`peer-card-${profile.uid}`}
                    className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs border border-outline-variant/25 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="relative">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[16px] font-semibold ${getAvatarToneClass(
                                profile.avatarTone
                              )}`}
                            >
                              {profile.avatarInitials}
                            </div>
                            {profile.showOnlineStatus && profile.isOnline && (
                              <span
                                title="Online now"
                                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#2F6F63] border-2 border-white"
                              />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-[17px] font-semibold text-primary">
                                {profile.displayName}
                              </h3>
                              {profile.isDemo ? (
                                <span className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-medium text-on-surface-variant">
                                  Sample Profile (Preview)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-[#2F6F63]/10 text-[11px] font-medium text-[#2F6F63]">
                                  Community Member
                                </span>
                              )}
                            </div>
                            <span
                              className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${availMeta.badgeClass}`}
                            >
                              {availMeta.label}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setReportTarget({
                              targetType: 'user',
                              targetId: profile.uid,
                              targetUid: profile.uid,
                              label: profile.displayName,
                            })
                          }
                          aria-label={`Report ${profile.displayName}`}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-surface-container"
                          title="Report profile"
                        >
                          <span className="material-symbols-outlined text-lg">flag</span>
                        </button>
                      </div>

                      {/* Transparent Match Explanation */}
                      <div className="p-3 rounded-xl bg-[#2F6F63]/8 border border-[#2F6F63]/20 text-[13px] text-[#2F6F63] font-medium flex items-start gap-2">
                        <span className="material-symbols-outlined text-base mt-0.5 shrink-0">
                          diversity_3
                        </span>
                        <span>{explanation}</span>
                      </div>

                      {/* Bio */}
                      {profile.bio && (
                        <p className="text-[14px] text-on-surface-variant leading-[1.6]">
                          {profile.bio}
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {profile.statusTags.map((tag) => {
                          const isShared = sharedStatusTags.includes(tag);
                          return (
                            <span
                              key={tag}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                isShared
                                  ? 'bg-[#2F6F63] text-white'
                                  : 'bg-surface-container text-primary'
                              }`}
                            >
                              {tag}
                            </span>
                          );
                        })}
                        {profile.interests.map((interest) => {
                          const isShared = sharedInterests.includes(interest);
                          return (
                            <span
                              key={interest}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                isShared
                                  ? 'bg-[#C97B5A] text-white'
                                  : 'bg-surface-container-low text-on-surface-variant'
                              }`}
                            >
                              {interest}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-3">
                      {existingPairReq?.status === 'accepted' ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab('chats')}
                          className="w-full py-2.5 px-4 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed text-[13px] font-semibold hover:opacity-90"
                        >
                          Connected • Open Chat
                        </button>
                      ) : existingPairReq?.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTab(
                              existingPairReq.senderUid === myUid ? 'sent' : 'received'
                            )
                          }
                          className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface-variant text-[13px] font-medium"
                        >
                          {existingPairReq.senderUid === myUid
                            ? 'Request Pending • View in Sent'
                            : 'Sent You a Request • View in Received'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`send-request-btn-${profile.uid}`}
                          onClick={() => handleOpenSendModal(profile, explanation)}
                          className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors"
                        >
                          Send Request
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECEIVED REQUESTS */}
      {activeTab === 'received' && (
        <div className="space-y-4">
          {receivedRequests.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-lowest p-10 text-center space-y-2 shadow-xs">
              <p className="text-[16px] font-medium text-primary">No received requests yet.</p>
              <p className="text-[13px] text-on-surface-variant">
                When someone relates to your tags and sends an introduction, you can accept,
                decline, or ignore it here.
              </p>
            </div>
          ) : (
            receivedRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl bg-surface-container-lowest p-6 shadow-xs border border-outline-variant/25 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[17px] font-semibold text-primary">{req.senderName}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-fixed text-on-secondary-fixed capitalize">
                        {req.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#2F6F63] mt-1">{req.sharedContextSummary}</p>
                  </div>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(req.createdAtMs).toLocaleString()}
                  </span>
                </div>

                {req.introMessage && (
                  <div className="p-4 rounded-xl bg-surface-container-low text-[14px] text-on-surface leading-[1.6]">
                    &ldquo;{req.introMessage}&rdquo;
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => void handleAccept(req)}
                      className="px-4 py-2 rounded-xl bg-[#2F6F63] text-white text-[13px] font-semibold hover:bg-[#24594f]"
                    >
                      Accept &amp; Start Conversation
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onDeclineRequest(req);
                        showToast('Request declined.');
                      }}
                      className="px-4 py-2 rounded-xl bg-surface-container text-primary text-[13px] font-medium hover:bg-surface-container-high"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onIgnoreRequest(req);
                        showToast('Request dismissed.');
                      }}
                      className="px-4 py-2 rounded-xl bg-surface text-on-surface-variant text-[13px] hover:bg-surface-container-low"
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onBlockUser(req.senderUid, req.senderName, req);
                        showToast(`${req.senderName} has been blocked.`);
                      }}
                      className="px-3.5 py-2 rounded-xl text-secondary text-[12px] font-semibold hover:bg-secondary-fixed/40 ml-auto"
                    >
                      Block Sender
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: SENT REQUESTS */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sentRequests.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-lowest p-10 text-center space-y-3 shadow-xs">
              <p className="text-[16px] font-medium text-primary">No sent requests yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('discover')}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-[13px] font-medium"
              >
                Browse Discover People
              </button>
            </div>
          ) : (
            sentRequests.map((req) => (
              <div
                key={req.id}
                data-testid={`sent-request-${req.recipientUid}`}
                className="rounded-2xl bg-surface-container-lowest p-5 shadow-xs border border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-primary">{req.recipientName}</h3>
                    {req.isDemoTarget && (
                      <span className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] text-on-surface-variant">
                        Sample Profile Preview
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        req.status === 'accepted'
                          ? 'bg-[#2F6F63]/15 text-[#2F6F63]'
                          : req.status === 'pending'
                          ? 'bg-secondary-fixed text-on-secondary-fixed'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-on-surface-variant">{req.sharedContextSummary}</p>
                  {req.introMessage && (
                    <p className="text-[13px] text-on-surface italic">&ldquo;{req.introMessage}&rdquo;</p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <button
                    type="button"
                    data-testid={`cancel-request-${req.recipientUid}`}
                    onClick={() => {
                      void onCancelRequest(req);
                      showToast('Pending request cancelled.');
                    }}
                    className="px-4 py-2 rounded-xl border border-secondary/40 text-secondary text-[12px] font-semibold hover:bg-secondary/10 shrink-0"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: ACTIVE CONVERSATIONS */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Conversation list */}
          <div className="lg:col-span-4 space-y-3">
            {visibleConversations.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-lowest p-6 text-center space-y-2 shadow-xs">
                <p className="text-[15px] font-medium text-primary">No active chats yet.</p>
                <p className="text-[13px] text-on-surface-variant leading-[1.6]">
                  Conversations begin only after a peer request is accepted.
                </p>
              </div>
            ) : (
              visibleConversations.map((conv) => {
                const otherUid = conv.participantUids.find((id) => id !== myUid) ?? '';
                const otherName = conv.participantNames[otherUid] ?? 'Peer Connection';
                const isSelected = activeConv?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-lowest border-outline-variant/25 hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold truncate">{otherName}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                          conv.status === 'active'
                            ? isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[#2F6F63]/15 text-[#2F6F63]'
                            : 'bg-surface-container-highest text-on-surface-variant'
                        }`}
                      >
                        {conv.status}
                      </span>
                    </div>
                    {conv.lastMessagePreview && (
                      <p
                        className={`text-[12px] mt-1 truncate ${
                          isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'
                        }`}
                      >
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Active Chat Pane */}
          <div className="lg:col-span-8">
            {!activeConv ? (
              <div className="rounded-2xl bg-surface-container-lowest p-10 text-center text-[14px] text-on-surface-variant shadow-xs">
                Select a conversation on the left or accept a peer request to begin talking.
              </div>
            ) : (
              (() => {
                const otherUid = activeConv.participantUids.find((id) => id !== myUid) ?? '';
                const otherName = activeConv.participantNames[otherUid] ?? 'Peer Connection';
                const chatMessages = activeMessagesByConvId[activeConv.id] ?? [];

                return (
                  <div className="rounded-2xl bg-surface-container-lowest shadow-xs border border-outline-variant/25 flex flex-col min-h-[460px]">
                    {/* Top chat bar */}
                    <div className="p-5 border-b border-outline-variant/25 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[17px] font-semibold text-primary">{otherName}</h3>
                        <p className="text-[12px] text-on-surface-variant">
                          Peer conversation • Do not share phone numbers, addresses, or financial details
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setReportTarget({
                              targetType: 'conversation',
                              targetId: activeConv.id,
                              targetUid: otherUid,
                              label: otherName,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-[12px] font-medium hover:text-secondary"
                        >
                          Report
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onBlockUser(otherUid, otherName, undefined, activeConv);
                            showToast(`${otherName} blocked and conversation ended.`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary text-[12px] font-semibold hover:bg-secondary/20"
                        >
                          Block User
                        </button>
                        {activeConv.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => {
                              void onEndConversation(activeConv);
                              showToast('Conversation ended.');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-outline-variant/40 text-[12px] font-medium text-on-surface-variant hover:text-primary"
                          >
                            Leave Conversation
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-5 space-y-3 max-h-[380px] overflow-y-auto bg-surface/40">
                      {chatMessages.length === 0 ? (
                        <p className="text-center text-[13px] text-on-surface-variant py-8">
                          You are connected with {otherName}. Say hello gently whenever you are ready.
                        </p>
                      ) : (
                        chatMessages.map((msg) => {
                          const isMine = msg.senderUid === myUid;
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-[80%] px-4 py-3 rounded-2xl text-[14px] leading-[1.6] ${
                                  isMine
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface-container-low text-on-surface'
                                }`}
                              >
                                <p>{msg.text}</p>
                              </div>
                              <span className="text-[11px] text-on-surface-variant mt-1 px-1">
                                {isMine ? 'You' : msg.senderName} •{' '}
                                {new Date(msg.createdAtMs).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Composer */}
                    {activeConv.status === 'active' ? (
                      <form
                        onSubmit={handleSendChatMessage}
                        className="p-4 border-t border-outline-variant/25 space-y-2"
                      >
                        {messageError && (
                          <p className="text-[12px] text-secondary font-medium">{messageError}</p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={messageDraft}
                            onChange={(e) => setMessageDraft(e.target.value)}
                            placeholder={`Write a supportive message to ${otherName}...`}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-low text-[14px] text-on-surface outline-none focus:bg-surface-container"
                          />
                          <button
                            type="submit"
                            disabled={!messageDraft.trim() || sendingMessage}
                            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container disabled:opacity-50"
                          >
                            {sendingMessage ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-4 border-t border-outline-variant/25 text-center text-[13px] text-on-surface-variant">
                        This conversation has been ended.
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Modal: Send Conversation Request */}
      {requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmSendRequest}
            className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-semibold text-primary">
                  Send Request to {requestTarget.profile.displayName}
                </h3>
                <p className="text-[12px] text-[#2F6F63] mt-1">{requestTarget.explanation}</p>
              </div>
              <button
                type="button"
                onClick={() => setRequestTarget(null)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                ✕
              </button>
            </div>

            {requestTarget.profile.isDemo && (
              <div className="p-3 rounded-xl bg-surface-container text-[12px] text-on-surface-variant leading-[1.5]">
                This is a <strong>Sample Profile (Preview)</strong> so you can experience how SHONGI
                peer requests work. Real community members also appear here as they join.
              </div>
            )}

            <div>
              <label htmlFor="peer-intro-msg" className="block text-[12px] font-medium text-primary mb-1.5">
                Optional short introduction
              </label>
              <textarea
                id="peer-intro-msg"
                rows={3}
                maxLength={500}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="e.g., Hi! I noticed we're both navigating exam pressure right now and wanted to say hello."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-[14px] text-on-surface outline-none focus:bg-surface-container leading-[1.6]"
              />
            </div>

            {requestError && (
              <p className="text-[12px] text-secondary font-medium">{requestError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={sendingRequest}
                data-testid="confirm-send-request-btn"
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container disabled:opacity-60"
              >
                {sendingRequest ? 'Sending...' : 'Send Conversation Request'}
              </button>
              <button
                type="button"
                onClick={() => setRequestTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface text-[13px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Safety Guidelines */}
      {guidelinesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-primary">SHONGI Community Safety Code</h3>
              <button
                type="button"
                onClick={() => setGuidelinesOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-[13px] text-on-surface-variant leading-[1.6]">
              <p>
                <strong>1. Protect your privacy:</strong> Never share phone numbers, WhatsApp,
                home addresses, or bKash/Nagad accounts.
              </p>
              <p>
                <strong>2. Consensual pacing:</strong> Conversation only starts when both people
                accept. You can decline, ignore, leave, or block anytime.
              </p>
              <p>
                <strong>3. Peer support is not therapy:</strong> Peers share empathy and lived
                experience—never medical diagnoses or clinical treatment.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGuidelinesOpen(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Modal: Report User or Conversation */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitReport}
            className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-primary">
                Report {reportTarget.label}
              </h3>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {[
                'Boundary or safety concern',
                'Asked for phone number / contact / money',
                'Harassment or disrespectful remarks',
                'Spam or promotional behavior',
              ].map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-low cursor-pointer text-[13px]"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="accent-secondary"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <textarea
              rows={2}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional details..."
              className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-[13px] outline-none"
            />
            <div className="flex gap-2.5">
              <button
                type="submit"
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
          </form>
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
