import {
  ApprovedMemory,
  ChatMessage,
  FeedPost,
  JournalEntry,
  MemoryProposal,
  PeerSupporter,
  UserPublicProfile,
} from '../types/shongi';

export const SHONGI_IMAGES = {
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhL4AMrhsNJbb82dvg-Alu6JvhwbUInqg0C_0tWBvKbwsY89pHCOgTGnrdyKa6d3-4ZkDC86DglJWUWOW0Qvj91bz-nr8PvQSE5JqQCBmOAdz2MYtgTN9v3OPG2H2ABMmyPXDuWpIc7zYFAvVovqswFQlu-4SgVTICpGPPcqZnhRyBLx0XPpiEoA-BB2q7Wnx49jM2M0Ow0R6gmTrxbmZiEUgT8LcsqYV2adVrmg',
  userAvatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCmIlOrXqbfIjqu2ZAf1A98oWyKymvhFhK8OXL0H5LoByxxLzoyFnJbjZMcM5EsNDdcqrQDhMk890mcM5J3LEUhEcIg4owaiaImr8al_av0i9zJk2H7ufjwOKPB8CPRLiXsG3WlYClTuWQnXX0tmCxicg7gVSTdHbMizENYJnUu4YG59DTK1Wf7-Og_eq1f3RKo6V7w7v7qiWdYa_fzx1_L0aFZsV3YmW9fTCJakg',
  heroPortrait:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAc0sqieX5Iv83pwIgLD7L_MITofmVI65jvgFkDhvmTpFmqbrFLLwoDxK5xcZcKuN5vCnuaoK1Y9uqImhfX17Q_KMMrv9Zp1qiFAnklRGFnCHAAzB5h-NcO-fKn9H3ZYpgkROygl_gk2RKmBX6XyTGGTzRXFRsblpVzXvE-ICo5DaMr_pkmxOqe25G9U7SPeIGrWxKStUvV5olIWwVA8oGIPXm3PqmzQs0VRqhftQ',
  peerStudentsBench:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCqS7GXPjocEOnb-q0jc42YLRVUPy77_dQqhhCBQKqTQsvvH_j1RjPMIbWPKIW8CrfKm3KLrKYMXOQQYv5KghUfUsXPKjajPw1UyM7Xttk-VF5azfu_MMaass-FCPxptjPC_OniioyzJtda2AYF61UAGoy0D4pj_qjDrtkyo2R4E-T4P8wjmcvmuiVlveV-RriKzY9eWutmyw5szmbgTM6I429Wv4yyBCfkNC0shA',
};

export const INITIAL_APPROVED_MEMORIES: ApprovedMemory[] = [
  {
    id: 'mem-1',
    text: 'Prefers gentle, non-authoritarian tone',
    meta: 'Approved 3 days ago • Persistent',
  },
  {
    id: 'mem-2',
    text: 'Preparing for varsity admissions (Session 2024-25)',
    meta: 'Approved Oct 12 • Educational context',
  },
];

export const INITIAL_MEMORY_PROPOSAL: MemoryProposal = {
  id: 'prop-1',
  text: 'Feeling anxious about university admission tests and considering shifting focus to IBA or public alternatives instead of forced engineering track.',
  tags: ['#VarsityPrep', '#CareerClarity', '#FamilyPressure'],
  status: 'pending',
};

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    paragraphs: [
      'Shongi, ami shotti bolte khub exhausted. HSC result decent chhilo, but BUET ar Medical er admission prep shuru houar por theke matha kaj korche na. Shobai eto confident, ar amar mone hochhe I am falling behind every single minute.',
    ],
    timestamp: '6:26 PM',
    statusLabel: 'Delivered',
  },
  {
    id: 'msg-2',
    role: 'companion',
    modeLabel: 'Listening Mode',
    paragraphs: [
      'আমি শুনছি, আনিসুর। এই ক্লান্তিটা খুব স্বাভাবিক।',
      'বাংলাদেশে অ্যাডমিশন সিজনের এই প্রেশারটা এমন একটা ঘূর্ণি তৈরি করে যেখানে মনে হয় এক মুহূর্ত থামলেই সব শেষ। কিন্তু আপনার ক্লান্তি দুর্বলতা নয়—এটা প্রমাণ করে আপনি একা এতটা ভার বহন করার চেষ্টা করছেন।',
    ],
    italicPrompt:
      'অন্যদের আত্মবিশ্বাসটা বাইরে থেকে যতটুকু নিখুঁত দেখায়, ভেতরে হয়তো তারাও আপনার মতোই দম নেওয়ার পথ খুঁজছে। একটু গভীর নিঃশ্বাস নিন... এই মুহূর্তে আপনার সবচেয়ে ভারী কী মনে হচ্ছে? কোচিংয়ের রুটিন নাকি পরিবারের প্রত্যাশা?',
    timestamp: '6:27 PM',
  },
  {
    id: 'msg-3',
    role: 'user',
    paragraphs: [
      'Family expecting engineering, but amake math formulas ar rush ta suffocated kore. Ami shotti bolte IBA ba General Public university alternatives niye bhabchhilam. But parents ke kivabe bolbo? It feels like giving up, even though I genuinely like business analysis more.',
    ],
    timestamp: '6:30 PM',
    statusLabel: 'Delivered',
  },
  {
    id: 'msg-4',
    role: 'companion',
    paragraphs: [
      'নিজের শক্তি যেখানে কাজ করে, সেদিকে যাওয়াকে কখনো "giving up" বলা যায় না আনিসুর। বরং Engineering-এর প্রবল স্রোতের বিপরীতে নিজের IBA এবং অ্যানালিটিক্সের আগ্রহকে চিনতে পারা অনেক সাহসের ব্যাপার।',
      'পরিবারের ভয়ের পেছনে থাকে আপনার ভবিষ্যৎ নিয়ে তাদের অনিরাপত্তা। তারা হয়তো ইঞ্জিনিয়ারিংকে চিনে নিশ্চিত ভবিষ্যৎ হিসেবে, IBA-এর সম্ভাবনার বিশালতা তাদের পরিচিত নয়। আমরা নিশ্চয়ই চিন্তা করব কীভাবে ধাপে ধাপে তাদের সাথে এই বিষয়ে কথা বলা যায়।',
    ],
    timestamp: '6:31 PM',
    statusLabel: 'Sanctuary Safe Engine',
    includesProposal: true,
  },
];

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'entry-1',
    dateLabel: 'October 24, 2024',
    banglaDateLabel: 'বৃহস্পতিবার রাত',
    relativeTimeLabel: 'Today • 11:30 PM',
    title: 'Dealing with family expectations after mock test results',
    body: `আজকের রেজাল্ট দেখার পর আব্বুর চেহারার দিকে তাকানো যাচ্ছিল না। কোচিংয়ের মেরিট লিস্টে আমার নাম পেছনের পাতায়। আমি জানি আব্বু-আম্মু কত ত্যাগ স্বীকার করেছেন আমার জন্য। সারাদিন কানে শুধু আত্মীয়দের কথা বাজছিল—"এবার কি সুযোগ পাবে?"\n\nবুকের ভেতর এক ধরণের ভারি পাথর চেপে বসে আছে। কিন্তু এই মুহূর্তটায় আমি নিজেকে মনে করিয়ে দিতে চাই: আমার সম্পূর্ণ যোগ্যতা কেবল একটি পরীক্ষার ফলাফল দিয়ে নির্ধারিত হতে পারে না। আমি গত ছয় মাস ধরে প্রতিদিন ১২ ঘণ্টা শ্রম দিয়েছি। আমার প্রচেষ্টা মিথ্যা নয়।\n\nকাল সকাল থেকে রিভিশন নতুন নিয়মে শুরু করব। আপাতত এই অনুভূতিটা গ্রহণ করি, লুকিয়ে না রাখি।`,
    mood: 'Heavy',
    tags: ['#AdmissionStress', '#FamilyWeight'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 11:42 PM (On-device DB)',
  },
  {
    id: 'entry-2',
    dateLabel: 'October 23, 2024',
    banglaDateLabel: 'বুধবার গভীর রাত',
    relativeTimeLabel: 'Yesterday • 1:15 AM',
    title: 'রাত দুইটায় ঢাকা শহরের বৃষ্টি আর শূন্যতা',
    body: `সবাই ঘুমাচ্ছে। বারান্দায় দাঁড়িয়ে ভেজা মাটির গন্ধ নিচ্ছিলাম। মাঝে মাঝে মনে হয় সময় খুব দ্রুত বয়ে যাচ্ছে, আর আমি শুধু পেছনে পড়ে আছি। তবুও বৃষ্টির শব্দটা বুকের চাপ কিছুটা কমিয়ে দেয়।`,
    mood: 'Restless',
    tags: ['#MidnightThoughts'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 1:30 AM (On-device DB)',
  },
  {
    id: 'entry-3',
    dateLabel: 'October 21, 2024',
    banglaDateLabel: 'সোমবার বিকেল',
    relativeTimeLabel: 'Oct 21 • 5:40 PM',
    title: 'Dhanmondi Lake walk & finding rhythm',
    body: `Took a 40-minute walk by the water. No phone, just watching children feeding ducks. It eased the chest tightness and reminded me that life exists outside coaching sheets.`,
    mood: 'Calm',
    tags: ['#Grounding', '#Gratitude'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 6:05 PM (On-device DB)',
  },
  {
    id: 'entry-4',
    dateLabel: 'October 18, 2024',
    banglaDateLabel: 'শুক্রবার সকাল',
    relativeTimeLabel: 'Oct 18 • 10:20 AM',
    title: 'ছোট চাচীর সাথে এক কাপ লাল চা ও আশ্বাস',
    body: `She said one exam doesn't define thirty years of a career. I breathed normally after four days. চাচীর এই ছোট্ট কথাটা অনেক বড় ভরসা দিয়েছে।`,
    mood: 'Hopeful',
    tags: ['#FamilySupport', '#Gratitude'],
    aiLocked: true,
    updatedAtLabel: 'Saved locally at 10:45 AM (On-device DB)',
  },
];

export const PEER_SUPPORTERS: PeerSupporter[] = [
  {
    id: 'peer-mahdi',
    initials: 'মা',
    name: 'Mahdi • IBA (DU)',
    track: 'Surviving 3 mock-exam breakdowns',
    summary: 'Switched from engineering coaching to IBA prep after two mock-test panic cycles.',
    story:
      'আব্বুকে বোঝানো সহজ ছিল না, কিন্তু ডেটা আর প্ল্যান নিয়ে বসেছিলাম। প্রথম ৩টা মক টেস্টে ফেল করার পরও হাল ছাড়িনি। কথা বলতে চাইলে আমি আছি।',
    responseTime: '~2 Hours',
    tags: ['IBA Prep', 'Career Pivot', 'Dhaka'],
    avatarTone: 'secondary',
  },
  {
    id: 'peer-sanjida',
    initials: 'সা',
    name: 'Sanjida • DMC (MBBS)',
    track: 'Medical gap-year & self-doubt',
    summary: 'Took a gap year after missing medical cutoff by 1.5 marks.',
    story:
      'সেকেন্ড টাইমের প্রতিটি দিন মনে হতো সবাই এগিয়ে গেছে। কিন্তু নিজের গতিটা ধরে রাখতে পারলে এক বছরের অপেক্ষা কোনো ব্যর্থতা নয়।',
    responseTime: '~3 Hours',
    tags: ['Medical Admission', 'Gap Year', 'Bangla'],
    avatarTone: 'primary',
  },
  {
    id: 'peer-rafid',
    initials: 'রা',
    name: 'Rafid • NSU (CSE)',
    track: 'Public failure to private scholarship',
    summary: 'Dealt with relatives comparing public vs private universities.',
    story:
      'আত্মীয়দের কথার চাপ সবচেয়ে বেশি কষ্ট দিত। আজ আমি ১০০% স্কলারশিপে পড়ছি এবং মানসিকভাবে অনেক শান্তিতে আছি।',
    responseTime: '~1.5 Hours',
    tags: ['Public vs Private', 'Family Pressure', 'CSE'],
    avatarTone: 'neutral',
  },
];

export const JOURNAL_PROMPTS = [
  {
    label: 'What is one thing within your control today?',
    insertText:
      'What is one thing within your control today? / আজ কোন বিষয়টি কেবল আপনার নিয়ন্ত্রণে আছে?',
  },
  {
    label: 'What would you say to a friend in this situation?',
    insertText: 'What would you say to a friend in this exact situation?',
  },
  {
    label: 'Naming the heaviness without judgement',
    insertText: 'Naming the heaviness without judgement.',
  },
];

export const DEMO_PEER_PROFILES: UserPublicProfile[] = [
  {
    uid: 'demo_mahdi',
    displayName: 'Mahdi Hasan',
    bio: 'IBA student in Dhaka. Switched paths after struggling through engineering admission prep—always happy to listen without lecturing.',
    avatarTone: 'sage',
    avatarInitials: 'MH',
    statusTags: ['Student', 'Admission preparation', 'Academic failure or setbacks'],
    interests: ['Reading', 'Productivity', 'Writing'],
    availability: 'available',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
    isDemo: true,
  },
  {
    uid: 'demo_riya',
    displayName: 'Riya Sultana',
    bio: 'Final-year CSE student trying to balance thesis stress, coding practice, and late-night overthinking.',
    avatarTone: 'terracotta',
    avatarInitials: 'RS',
    statusTags: ['Student', 'University life', 'Study stress', 'Exam pressure'],
    interests: ['Programming', 'Technology', 'Music'],
    availability: 'available',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
    isDemo: true,
  },
  {
    uid: 'demo_rafid',
    displayName: 'Rafid Rahman',
    bio: 'Recent graduate navigating first job interviews, skill building, and family expectations in Chattogram.',
    avatarTone: 'navy',
    avatarInitials: 'RR',
    statusTags: ['Job seeker', 'Career uncertainty', 'First job preparation', 'Financial pressure'],
    interests: ['Technology', 'Gaming', 'Productivity'],
    availability: 'open_to_requests',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
    isDemo: true,
  },
  {
    uid: 'demo_sanjida',
    displayName: 'Sanjida Islam',
    bio: 'Went through a quiet gap year and slowly rebuilt routine through journaling and tea breaks.',
    avatarTone: 'sand',
    avatarInitials: 'SI',
    statusTags: ['Feeling lonely', 'Trying to stay motivated', 'Need someone to talk to', 'Personal growth'],
    interests: ['Art', 'Reading', 'Writing'],
    availability: 'open_to_requests',
    preferredFeedVisibility: 'community',
    showOnlineStatus: false,
    isDemo: true,
  },
];

export const DEMO_FEED_POSTS: FeedPost[] = [
  {
    id: 'demo-post-1',
    authorUid: 'demo_mahdi',
    authorName: 'Mahdi Hasan',
    authorAvatarTone: 'sage',
    postType: 'study_life',
    mood: 'Grounded',
    title: 'Small shift after a terrible mock score',
    body: 'Ajke ekta mock test khub baje gelo. Age hole sara raat nijeke dosh ditam. Ajke shudhu 20 minute hete eshe ek cup cha banalam. One bad paper does not erase months of effort.',
    tags: ['Admission preparation', 'Study stress', 'Trying to stay motivated'],
    visibility: 'community',
    reactionCounts: {
      hear_you: 4,
      sending_support: 6,
      relatable: 5,
      you_got_this: 3,
    },
    commentCount: 1,
    isDemo: true,
    createdAtMs: Date.now() - 1000 * 60 * 95,
    updatedAtMs: Date.now() - 1000 * 60 * 95,
  },
  {
    id: 'demo-post-2',
    authorUid: 'demo_sanjida',
    authorName: 'Sanjida Islam',
    authorAvatarTone: 'sand',
    postType: 'mood',
    mood: 'Quietly hopeful',
    body: 'রাত গভীর হলে অনেক সময় একা লাগে, কিন্তু মাঝে মাঝে জানালা দিয়ে বাতাস আর একটা শান্ত গান শুনলেই মনটা একটু হালকা হয়। যারা আজকে একটু ভারী সময় পার করছেন, আপনাদের জন্য শুভকামনা।',
    tags: ['Feeling lonely', 'Music', 'Personal growth'],
    visibility: 'community',
    reactionCounts: {
      hear_you: 7,
      sending_support: 8,
      relatable: 4,
      you_got_this: 2,
    },
    commentCount: 0,
    isDemo: true,
    createdAtMs: Date.now() - 1000 * 60 * 240,
    updatedAtMs: Date.now() - 1000 * 60 * 240,
  },
  {
    id: 'demo-post-3',
    authorUid: 'demo_rafid',
    authorName: 'Rafid Rahman',
    authorAvatarTone: 'navy',
    postType: 'story',
    mood: 'Reflective',
    title: 'Dealing with "what are you doing now?" at family gatherings',
    body: 'First job hunting is weirdly exhausting because everyone asks for updates before you even hear back from interviews. Learned to protect my mornings for learning one small skill at a time instead of scrolling job boards all day.',
    tags: ['Job seeker', 'First job preparation', 'Learning new skills', 'Technology'],
    visibility: 'community',
    reactionCounts: {
      hear_you: 5,
      sending_support: 3,
      relatable: 9,
      you_got_this: 4,
    },
    commentCount: 0,
    isDemo: true,
    createdAtMs: Date.now() - 1000 * 60 * 480,
    updatedAtMs: Date.now() - 1000 * 60 * 480,
  },
];

