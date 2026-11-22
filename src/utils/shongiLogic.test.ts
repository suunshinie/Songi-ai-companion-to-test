import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approveMemoryProposal,
  BREATH_PHASES,
  buildCompanionSystemInstruction,
  canSendPeerRequest,
  canTransitionRequestStatus,
  computePeerRecommendations,
  computeWordRevealDelay,
  createInitialBreathState,
  deriveAuthSummary,
  detectCompanionLanguage,
  filterAndSortFeedPosts,
  filterJournalEntries,
  formatMemoryUsage,
  generateCompanionReply,
  isNoiseOnlyTranscript,
  mapFirebaseAuthError,
  moderateUserContent,
  reduceVoiceConversationPhase,
  sanitizeChatHistory,
  sanitizeFirestoreId,
  shouldTriggerSilenceStop,
  stepBreathState,
  stripMarkdownForSpeech,
} from './shongiLogic';
import {
  ApprovedMemory,
  FeedPost,
  JournalEntry,
  MemoryProposal,
  PeerConversationRequest,
  UserPublicProfile,
  VoiceConversationPhase,
} from '../types/shongi';

const sampleEntries: JournalEntry[] = [
  {
    id: 'j1',
    dateLabel: 'October 24, 2024',
    relativeTimeLabel: 'Today • 11:30 PM',
    title: 'Dealing with family expectations after mock test results',
    body: 'আজকের রেজাল্ট দেখার পর আব্বুর চেহারার দিকে তাকানো যাচ্ছিল না।',
    mood: 'Heavy',
    tags: ['#AdmissionStress', '#FamilyWeight'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 11:42 PM',
  },
  {
    id: 'j2',
    dateLabel: 'October 23, 2024',
    relativeTimeLabel: 'Yesterday • 1:15 AM',
    title: 'রাত দুইটায় ঢাকা শহরের বৃষ্টি আর শূন্যতা',
    body: 'সবাই ঘুমাচ্ছে। বারান্দায় দাঁড়িয়ে ভেজা মাটির গন্ধ নিচ্ছিলাম।',
    mood: 'Restless',
    tags: ['#MidnightThoughts'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 1:30 AM',
  },
  {
    id: 'j3',
    dateLabel: 'October 21, 2024',
    relativeTimeLabel: 'Oct 21 • 5:40 PM',
    title: 'Dhanmondi Lake walk & finding rhythm',
    body: 'Took a 40-minute walk by the water. No phone, just watching children feeding ducks.',
    mood: 'Calm',
    tags: ['#Grounding', '#Gratitude'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 6:05 PM',
  },
];

test('filterJournalEntries filters by tag preset and Bangla/English search', () => {
  assert.equal(filterJournalEntries(sampleEntries, '', 'All').length, 3);
  assert.equal(filterJournalEntries(sampleEntries, '', 'Admission').length, 1);
  assert.equal(filterJournalEntries(sampleEntries, '', 'Midnight').length, 1);
  assert.equal(filterJournalEntries(sampleEntries, '', 'Gratitude').length, 1);
  assert.equal(filterJournalEntries(sampleEntries, 'Dhanmondi', 'All').length, 1);
  assert.equal(filterJournalEntries(sampleEntries, 'বৃষ্টি', 'All').length, 1);
});

test('4-7-8 breathing cycle transitions correctly through Inhale -> Hold -> Exhale -> Inhale', () => {
  let state = createInitialBreathState();
  assert.equal(BREATH_PHASES[state.phaseIndex].label, 'Inhale');
  assert.equal(state.timeRemaining, 4);

  // Step 3 times -> still Inhale with 1s left
  for (let i = 0; i < 3; i++) state = stepBreathState(state);
  assert.equal(BREATH_PHASES[state.phaseIndex].label, 'Inhale');
  assert.equal(state.timeRemaining, 1);

  // Step once more -> Hold with 7s left
  state = stepBreathState(state);
  assert.equal(BREATH_PHASES[state.phaseIndex].label, 'Hold');
  assert.equal(state.timeRemaining, 7);

  // Paused state should not advance
  const paused = stepBreathState({ ...state, isRunning: false });
  assert.equal(paused.timeRemaining, 7);
  assert.equal(paused.phaseIndex, 1);

  // Step 7 times -> Exhale with 8s left
  for (let i = 0; i < 7; i++) state = stepBreathState(state);
  assert.equal(BREATH_PHASES[state.phaseIndex].label, 'Exhale');
  assert.equal(state.timeRemaining, 8);
});

test('approveMemoryProposal appends memory without duplicating and updates proposal status', () => {
  const existing: ApprovedMemory[] = [
    {
      id: 'm1',
      text: 'Prefers gentle, non-authoritarian tone',
      meta: 'Approved 3 days ago • Persistent',
    },
  ];
  const proposal: MemoryProposal = {
    id: 'p1',
    text: 'Feeling anxious about university admission tests.',
    tags: ['#VarsityPrep'],
    status: 'pending',
  };

  const result = approveMemoryProposal(existing, proposal);
  assert.equal(result.memories.length, 2);
  assert.equal(result.proposal.status, 'approved');
  assert.equal(formatMemoryUsage(result.memories.length), '2 of 10 limit used');

  // Re-approving same text should not duplicate
  const dup = approveMemoryProposal(result.memories, proposal);
  assert.equal(dup.memories.length, 2);
});

test('detectCompanionLanguage distinguishes Bangla, Banglish, and English', () => {
  assert.equal(detectCompanionLanguage('আমার আজকে মনটা খুব ভারী লাগছে।'), 'bangla');
  assert.equal(detectCompanionLanguage('BUET এর exam নিয়ে খুব টেনশন হচ্ছে'), 'bangla');
  assert.equal(
    detectCompanionLanguage('Shongi, ami ajke khub exhausted lagchhe, kotha bolte chai.'),
    'banglish'
  );
  assert.equal(detectCompanionLanguage('mon kharap hoye ache'), 'banglish');
  assert.equal(
    detectCompanionLanguage('I feel completely overwhelmed by tomorrow exams.'),
    'english'
  );
  assert.equal(detectCompanionLanguage('I just want a cup of chai and quiet.'), 'english');
  assert.equal(detectCompanionLanguage('Hey Shongi, I feel tired today.'), 'english');
});

test('generateCompanionReply and system instruction match detected language and mode', () => {
  const peerReply = generateCompanionReply('Can I talk to a peer?', 'listening', [], 'en');
  assert.equal(peerReply.detectedLanguage, 'english');
  assert.ok(peerReply.paragraphs[0].includes('Peer Pilot'));
  assert.ok(!/[\u0980-\u09FF]/.test(peerReply.paragraphs[0]));

  const banglishReply = generateCompanionReply(
    'Ami khub tired lagchhe, IBA prep niye bhabchi.',
    'action',
    [],
    'en'
  );
  assert.equal(banglishReply.detectedLanguage, 'banglish');
  assert.ok(!/[\u0980-\u09FF]/.test(banglishReply.paragraphs.join(' ')));

  const banglaReply = generateCompanionReply('আম্মুকে কীভাবে বোঝাবো?', 'listening', [], 'bn');
  assert.equal(banglaReply.detectedLanguage, 'bangla');
  assert.ok(/[\u0980-\u09FF]/.test(banglaReply.paragraphs[0]));

  const sysBanglish = buildCompanionSystemInstruction('listening', [], 'banglish');
  assert.ok(sysBanglish.includes('Banglish'));
  assert.ok(computeWordRevealDelay('hello.') > computeWordRevealDelay('hello'));
});

test('two-way voice conversation state machine transitions cleanly for both-side talking', () => {
  let phase: VoiceConversationPhase = 'idle';
  phase = reduceVoiceConversationPhase(phase, 'START_CALL');
  assert.equal(phase, 'listening');

  phase = reduceVoiceConversationPhase(phase, 'AUDIO_CAPTURED');
  assert.equal(phase, 'transcribing');

  phase = reduceVoiceConversationPhase(phase, 'TRANSCRIPT_READY');
  assert.equal(phase, 'thinking');

  phase = reduceVoiceConversationPhase(phase, 'REPLY_READY');
  assert.equal(phase, 'speaking');

  // Auto-loops back to listening after bot finishes speaking
  phase = reduceVoiceConversationPhase(phase, 'SPEAKING_ENDED');
  assert.equal(phase, 'listening');

  // Supports barge-in / user interrupting bot speech
  phase = reduceVoiceConversationPhase('speaking', 'USER_INTERRUPT');
  assert.equal(phase, 'listening');

  // Pause and resume
  phase = reduceVoiceConversationPhase(phase, 'PAUSE_MIC');
  assert.equal(phase, 'paused');
  phase = reduceVoiceConversationPhase(phase, 'RESUME_MIC');
  assert.equal(phase, 'listening');

  // End call from any phase
  assert.equal(reduceVoiceConversationPhase('speaking', 'END_CALL'), 'idle');
});

test('shouldTriggerSilenceStop waits until speech started and silence threshold elapsed', () => {
  assert.equal(shouldTriggerSilenceStop(false, 1000, 3000, 1400), false);
  assert.equal(shouldTriggerSilenceStop(true, null, 3000, 1400), false);
  assert.equal(shouldTriggerSilenceStop(true, 1000, 2000, 1400), false);
  assert.equal(shouldTriggerSilenceStop(true, 1000, 2400, 1400), true);
});

test('deriveAuthSummary and mapFirebaseAuthError handle anonymous, Google, and verified/unverified email accounts', () => {
  const anon = deriveAuthSummary({ uid: 'anon_1', isAnonymous: true });
  assert.equal(anon.authMethod, 'anonymous');
  assert.equal(anon.needsEmailVerification, false);
  assert.equal(anon.canSyncCloud, true);

  const google = deriveAuthSummary({
    uid: 'g_1',
    email: 'user@gmail.com',
    displayName: 'Nusrat',
    isAnonymous: false,
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }],
  });
  assert.equal(google.authMethod, 'google');
  assert.equal(google.canSyncCloud, true);

  const unverifiedEmail = deriveAuthSummary({
    uid: 'e_1',
    email: 'student@dhaka.edu',
    isAnonymous: false,
    emailVerified: false,
    providerData: [{ providerId: 'password' }],
  });
  assert.equal(unverifiedEmail.authMethod, 'email');
  assert.equal(unverifiedEmail.needsEmailVerification, true);
  assert.equal(unverifiedEmail.canSyncCloud, false);

  const verifiedEmail = deriveAuthSummary({
    uid: 'e_1',
    email: 'student@dhaka.edu',
    isAnonymous: false,
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  });
  assert.equal(verifiedEmail.needsEmailVerification, false);
  assert.equal(verifiedEmail.canSyncCloud, true);

  assert.equal(sanitizeFirestoreId('mem.1/bad id!'), 'mem_1_bad_id_');
  assert.ok(mapFirebaseAuthError('FirebaseError: (auth/operation-not-allowed)').includes('Firebase Console'));
});

test('sanitizeChatHistory enforces alternating user->model turns and drops orphan turns', () => {
  const result = sanitizeChatHistory([
    { role: 'model', text: 'Leading model greeting should drop' },
    { role: 'user', text: 'Hi' },
    { role: 'user', text: 'Are you there?' },
    { role: 'model', text: 'Yes, listening.' },
    { role: 'user', text: 'Trailing failed turn user text' },
  ]);

  assert.deepEqual(result, [
    { role: 'user', text: 'Hi\n\nAre you there?' },
    { role: 'model', text: 'Yes, listening.' },
  ]);
  assert.deepEqual(sanitizeChatHistory([{ role: 'user', text: 'Only user' }]), []);
});

test('stripMarkdownForSpeech and isNoiseOnlyTranscript clean voice payloads', () => {
  assert.equal(stripMarkdownForSpeech('**Hello**, _friend_! Try `breathing`.'), 'Hello, friend! Try breathing.');
  assert.equal(isNoiseOnlyTranscript(''), true);
  assert.equal(isNoiseOnlyTranscript('[silence]'), true);
  assert.equal(isNoiseOnlyTranscript('(no speech)'), true);
  assert.equal(isNoiseOnlyTranscript('...'), true);
  assert.equal(isNoiseOnlyTranscript('Ami tired lagche'), false);
  assert.equal(reduceVoiceConversationPhase('thinking', 'USER_INTERRUPT'), 'listening');
  assert.equal(reduceVoiceConversationPhase('transcribing', 'USER_INTERRUPT'), 'listening');
});

test('computePeerRecommendations scores shared tags/interests, filters blocked/unavailable peers, and builds clear explanation', () => {
  const me: UserPublicProfile = {
    uid: 'u-me',
    displayName: 'Anisur',
    bio: '',
    avatarTone: 'sage',
    avatarInitials: 'AN',
    statusTags: ['Student', 'Study stress', 'Exam pressure'],
    interests: ['Technology', 'Music'],
    availability: 'available',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
  };

  const candidates: UserPublicProfile[] = [
    me,
    {
      uid: 'u-high',
      displayName: 'Nadia',
      bio: 'CS undergrad trying to stay steady.',
      avatarTone: 'terracotta',
      avatarInitials: 'NA',
      statusTags: ['Student', 'Study stress'],
      interests: ['Technology'],
      availability: 'available',
      preferredFeedVisibility: 'community',
      showOnlineStatus: false,
    },
    {
      uid: 'u-low',
      displayName: 'Tariq',
      bio: 'Early career.',
      avatarTone: 'navy',
      avatarInitials: 'TA',
      statusTags: ['Job seeker'],
      interests: ['Music'],
      availability: 'open_to_requests',
      preferredFeedVisibility: 'community',
      showOnlineStatus: false,
    },
    {
      uid: 'u-blocked',
      displayName: 'Blocked',
      bio: '',
      avatarTone: 'sand',
      avatarInitials: 'BL',
      statusTags: ['Student', 'Study stress'],
      interests: ['Technology'],
      availability: 'available',
      preferredFeedVisibility: 'community',
      showOnlineStatus: false,
    },
    {
      uid: 'u-break',
      displayName: 'On Break',
      bio: '',
      avatarTone: 'sand',
      avatarInitials: 'OB',
      statusTags: ['Student', 'Study stress'],
      interests: ['Technology'],
      availability: 'taking_a_break',
      preferredFeedVisibility: 'community',
      showOnlineStatus: false,
    },
  ];

  const recs = computePeerRecommendations(me, candidates, ['u-blocked']);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].profile.uid, 'u-high');
  assert.ok(recs[0].score > recs[1].score);
  assert.ok(recs[0].explanation.includes('Student'));
  assert.ok(recs[0].explanation.includes('Study stress'));
});

test('canSendPeerRequest and canTransitionRequestStatus enforce duplicates, rate limits, and terminal lock', () => {
  const recipient: UserPublicProfile = {
    uid: 'u-2',
    displayName: 'Riya',
    bio: '',
    avatarTone: 'sage',
    avatarInitials: 'RI',
    statusTags: ['Student'],
    interests: ['Reading'],
    availability: 'open_to_requests',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
  };

  const now = 1_700_000_000_000;
  const pendingReq: PeerConversationRequest = {
    id: 'req-1',
    senderUid: 'u-1',
    senderName: 'Me',
    senderAvatarTone: 'sage',
    senderTags: ['Student'],
    recipientUid: 'u-2',
    recipientName: 'Riya',
    recipientAvatarTone: 'sage',
    recipientTags: ['Student'],
    status: 'pending',
    introMessage: 'Hi!',
    sharedContextSummary: 'You both selected Student.',
    createdAtMs: now - 10_000,
    updatedAtMs: now - 10_000,
  };

  assert.equal(canSendPeerRequest('u-1', recipient, [], [], now).allowed, true);
  assert.equal(canSendPeerRequest('u-1', recipient, [pendingReq], [], now).allowed, false);
  assert.equal(canSendPeerRequest('u-1', recipient, [], ['u-2'], now).allowed, false);
  assert.equal(
    canSendPeerRequest('u-1', { ...recipient, availability: 'not_accepting' }, [], [], now).allowed,
    false
  );

  // Rate limit check
  const spamReqs = Array.from({ length: 6 }, (_, i) => ({
    ...pendingReq,
    id: `spam-${i}`,
    recipientUid: `u-other-${i}`,
    createdAtMs: now - 5_000,
  }));
  assert.equal(canSendPeerRequest('u-1', recipient, spamReqs, [], now).allowed, false);

  // State transition rules
  assert.equal(canTransitionRequestStatus('pending', 'accepted', 'recipient'), true);
  assert.equal(canTransitionRequestStatus('pending', 'declined', 'recipient'), true);
  assert.equal(canTransitionRequestStatus('pending', 'accepted', 'sender'), false);
  assert.equal(canTransitionRequestStatus('pending', 'cancelled', 'sender'), true);
  assert.equal(canTransitionRequestStatus('accepted', 'cancelled', 'sender'), false);
  assert.equal(canTransitionRequestStatus('declined', 'accepted', 'recipient'), false);
});

test('moderateUserContent catches PII/abuse and detects crisis gently without claiming emergency dispatch', () => {
  assert.equal(moderateUserContent('Call me at 01712345678').allowed, false);
  assert.equal(moderateUserContent('Hey, feeling a bit tired from exam prep tonight.').allowed, true);

  const crisisRes = moderateUserContent('I feel like I want to end my life tonight.');
  assert.equal(crisisRes.allowed, true);
  assert.equal(crisisRes.isCrisisDetected, true);
});

test('filterAndSortFeedPosts enforces private visibility, blocked authors, and For You overlap', () => {
  const posts: FeedPost[] = [
    {
      id: 'p-private-other',
      authorUid: 'u-other',
      authorName: 'Other',
      authorAvatarTone: 'navy',
      postType: 'thought',
      body: 'Secret',
      tags: ['Student'],
      visibility: 'private',
      reactionCounts: { hear_you: 0, sending_support: 0, relatable: 0, you_got_this: 0 },
      commentCount: 0,
      createdAtMs: 300,
      updatedAtMs: 300,
    },
    {
      id: 'p-blocked',
      authorUid: 'u-blocked',
      authorName: 'Blocked',
      authorAvatarTone: 'sand',
      postType: 'mood',
      body: 'Should hide',
      tags: ['Student'],
      visibility: 'community',
      reactionCounts: { hear_you: 0, sending_support: 0, relatable: 0, you_got_this: 0 },
      commentCount: 0,
      createdAtMs: 400,
      updatedAtMs: 400,
    },
    {
      id: 'p-match',
      authorUid: 'u-friend',
      authorName: 'Friend',
      authorAvatarTone: 'sage',
      postType: 'study_life',
      body: 'Exam stress is real today.',
      tags: ['Student', 'Exam pressure'],
      visibility: 'community',
      reactionCounts: { hear_you: 1, sending_support: 0, relatable: 0, you_got_this: 0 },
      commentCount: 0,
      createdAtMs: 100,
      updatedAtMs: 100,
    },
    {
      id: 'p-mine-private',
      authorUid: 'u-me',
      authorName: 'Me',
      authorAvatarTone: 'sage',
      postType: 'thought',
      body: 'My private reflection',
      tags: ['Personal growth'],
      visibility: 'private',
      reactionCounts: { hear_you: 0, sending_support: 0, relatable: 0, you_got_this: 0 },
      commentCount: 0,
      createdAtMs: 200,
      updatedAtMs: 200,
    },
  ];

  const viewer = {
    uid: 'u-me',
    statusTags: ['Student', 'Exam pressure'],
    interests: ['Technology'],
  };

  const forYou = filterAndSortFeedPosts(posts, viewer, 'for_you', ['u-blocked']);
  assert.equal(forYou.length, 2);
  assert.equal(forYou[0].id, 'p-match');
  assert.equal(forYou[1].id, 'p-mine-private');

  const studyOnly = filterAndSortFeedPosts(posts, viewer, 'study_life', ['u-blocked']);
  assert.deepEqual(
    studyOnly.map((p) => p.id),
    ['p-match']
  );
});



