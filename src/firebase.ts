import { initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  ApprovedMemory,
  AvatarTone,
  FeedComment,
  FeedPost,
  FeedReactionType,
  InAppNotification,
  JournalEntry,
  Language,
  ModerationReport,
  PeerChatMessage,
  PeerConversation,
  PeerConversationRequest,
  PeerRequestStatus,
  UserPublicProfile,
} from './types/shongi';
import { deriveAuthSummary, getInitials, sanitizeFirestoreId } from './utils/shongiLogic';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function toMillis(value: unknown, fallback = Date.now()): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return fallback;
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function subscribeAuthUser(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function signInAnonymouslyPrivate(): Promise<User> {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signUpWithEmailAndVerify(
  displayName: string,
  email: string,
  password: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName.trim();
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName });
  }
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('No active user session found.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function refreshAuthUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function upgradeAnonymousWithGoogle(): Promise<User> {
  if (!auth.currentUser) {
    return signInWithGooglePopup();
  }
  const cred = await linkWithPopup(auth.currentUser, googleProvider);
  return cred.user;
}

export async function upgradeAnonymousWithEmail(
  displayName: string,
  email: string,
  password: string
): Promise<User> {
  if (!auth.currentUser) {
    return signUpWithEmailAndVerify(displayName, email, password);
  }
  const emailCred = EmailAuthProvider.credential(email.trim(), password);
  const result = await linkWithCredential(auth.currentUser, emailCred);
  const cleanName = displayName.trim();
  if (cleanName) {
    await updateProfile(result.user, { displayName: cleanName });
  }
  await sendEmailVerification(result.user);
  return result.user;
}

export async function signOutSanctuary(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(
  user: User,
  preferredLanguage: Language
): Promise<{ proactiveCheckins: boolean; ephemeralMode: boolean }> {
  const summary = deriveAuthSummary(user);
  const safeUid = sanitizeFirestoreId(user.uid);
  const profilePath = `users/${safeUid}`;
  const profileRef = doc(db, 'users', safeUid);

  try {
    const existingSnap = await getDoc(profileRef);
    if (!existingSnap.exists()) {
      await setDoc(profileRef, {
        uid: safeUid,
        displayName: summary.displayName.slice(0, 80),
        authMethod: summary.authMethod,
        emailVerified: summary.emailVerified,
        preferredLanguage,
        proactiveCheckins: false,
        ephemeralMode: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { proactiveCheckins: false, ephemeralMode: true };
    }

    const data = existingSnap.data();
    await updateDoc(profileRef, {
      displayName: summary.displayName.slice(0, 80),
      authMethod: summary.authMethod,
      emailVerified: summary.emailVerified,
      preferredLanguage,
      updatedAt: serverTimestamp(),
    });
    return {
      proactiveCheckins: Boolean(data.proactiveCheckins),
      ephemeralMode: data.ephemeralMode !== false,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function updateUserConsentPreferences(
  uid: string,
  patch: { proactiveCheckins?: boolean; ephemeralMode?: boolean; preferredLanguage?: Language }
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserMemories(
  uid: string,
  onData: (memories: ApprovedMemory[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid);
  const path = `users/${safeUid}/memories`;
  const q = query(collection(db, 'users', safeUid, 'memories'), where('userId', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ApprovedMemory[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          text: String(data.text ?? ''),
          meta: String(data.meta ?? 'Synced • Sanctuary Profile'),
          isNew: Boolean(data.isNew),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveMemoryDoc(uid: string, memory: ApprovedMemory): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeMemId = sanitizeFirestoreId(memory.id);
  const path = `users/${safeUid}/memories/${safeMemId}`;
  const docRef = doc(db, 'users', safeUid, 'memories', safeMemId);
  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        text: memory.text.slice(0, 300),
        meta: memory.meta.slice(0, 120),
        isNew: Boolean(memory.isNew),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        id: safeMemId,
        userId: safeUid,
        text: memory.text.slice(0, 300),
        meta: memory.meta.slice(0, 120),
        isNew: Boolean(memory.isNew),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMemoryDoc(uid: string, memoryId: string): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeMemId = sanitizeFirestoreId(memoryId);
  const path = `users/${safeUid}/memories/${safeMemId}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'memories', safeMemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllMemoryDocs(uid: string, memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  const safeUid = sanitizeFirestoreId(uid);
  const path = `users/${safeUid}/memories`;
  try {
    const batch = writeBatch(db);
    for (const id of memoryIds) {
      batch.delete(doc(db, 'users', safeUid, 'memories', sanitizeFirestoreId(id)));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserJournal(
  uid: string,
  onData: (entries: JournalEntry[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid);
  const path = `users/${safeUid}/journal`;
  const q = query(collection(db, 'users', safeUid, 'journal'), where('userId', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          dateLabel: String(data.dateLabel ?? ''),
          banglaDateLabel:
            typeof data.banglaDateLabel === 'string' ? data.banglaDateLabel : undefined,
          relativeTimeLabel: String(data.relativeTimeLabel ?? ''),
          title: String(data.title ?? ''),
          body: String(data.body ?? ''),
          mood: (data.mood as JournalEntry['mood']) ?? 'Calm',
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          aiLocked: data.aiLocked !== false,
          updatedAtLabel: String(data.updatedAtLabel ?? 'Synced to private cloud'),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveJournalDoc(uid: string, entry: JournalEntry): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeEntryId = sanitizeFirestoreId(entry.id);
  const path = `users/${safeUid}/journal/${safeEntryId}`;
  const docRef = doc(db, 'users', safeUid, 'journal', safeEntryId);

  try {
    const existingSnap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      id: safeEntryId,
      userId: safeUid,
      dateLabel: entry.dateLabel.slice(0, 60),
      relativeTimeLabel: entry.relativeTimeLabel.slice(0, 60),
      title: entry.title.slice(0, 180),
      body: entry.body.slice(0, 8000),
      mood: entry.mood,
      tags: entry.tags.slice(0, 8).map((t) => String(t).slice(0, 40)),
      aiLocked: Boolean(entry.aiLocked),
      updatedAtLabel: entry.updatedAtLabel.slice(0, 80),
      updatedAt: serverTimestamp(),
    };
    if (entry.banglaDateLabel) {
      payload.banglaDateLabel = entry.banglaDateLabel.slice(0, 60);
    }

    if (existingSnap.exists()) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteJournalDoc(uid: string, entryId: string): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeEntryId = sanitizeFirestoreId(entryId);
  const path = `users/${safeUid}/journal/${safeEntryId}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'journal', safeEntryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/* ============================================================================
   PUBLIC DISCOVERY PROFILES (/publicProfiles)
   ============================================================================ */

export async function ensurePublicProfile(user: User): Promise<UserPublicProfile> {
  const summary = deriveAuthSummary(user);
  const safeUid = sanitizeFirestoreId(user.uid);
  const path = `publicProfiles/${safeUid}`;
  const ref = doc(db, 'publicProfiles', safeUid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const initial: UserPublicProfile = {
        uid: safeUid,
        displayName: summary.displayName.slice(0, 80),
        bio: '',
        avatarTone: 'sage',
        avatarInitials: getInitials(summary.displayName).slice(0, 4),
        statusTags: [],
        interests: [],
        availability: 'open_to_requests',
        preferredFeedVisibility: 'community',
        showOnlineStatus: false,
        isOnline: false,
        updatedAtMs: Date.now(),
      };
      await setDoc(ref, {
        uid: initial.uid,
        displayName: initial.displayName,
        bio: initial.bio,
        avatarTone: initial.avatarTone,
        avatarInitials: initial.avatarInitials,
        statusTags: initial.statusTags,
        interests: initial.interests,
        availability: initial.availability,
        preferredFeedVisibility: initial.preferredFeedVisibility,
        showOnlineStatus: initial.showOnlineStatus,
        isOnline: initial.isOnline,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return initial;
    }

    const d = snap.data();
    return {
      uid: String(d.uid ?? safeUid),
      displayName: String(d.displayName ?? summary.displayName),
      bio: String(d.bio ?? ''),
      avatarTone: (d.avatarTone as AvatarTone) ?? 'sage',
      avatarInitials: String(d.avatarInitials ?? getInitials(String(d.displayName ?? summary.displayName))),
      statusTags: Array.isArray(d.statusTags) ? d.statusTags.map(String) : [],
      interests: Array.isArray(d.interests) ? d.interests.map(String) : [],
      availability:
        (d.availability as UserPublicProfile['availability']) ?? 'open_to_requests',
      preferredFeedVisibility:
        d.preferredFeedVisibility === 'private' ? 'private' : 'community',
      showOnlineStatus: Boolean(d.showOnlineStatus),
      isOnline: Boolean(d.isOnline),
      updatedAtMs: toMillis(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePublicProfileDoc(profile: UserPublicProfile): Promise<void> {
  const safeUid = sanitizeFirestoreId(profile.uid);
  const path = `publicProfiles/${safeUid}`;
  const ref = doc(db, 'publicProfiles', safeUid);
  const cleanName = (profile.displayName.trim() || 'Sanctuary Member').slice(0, 80);
  const cleanInitials = getInitials(cleanName).slice(0, 4);

  try {
    const snap = await getDoc(ref);
    const payload = {
      displayName: cleanName,
      bio: profile.bio.trim().slice(0, 280),
      avatarTone: profile.avatarTone,
      avatarInitials: cleanInitials,
      statusTags: profile.statusTags.slice(0, 18).map((t) => String(t).slice(0, 60)),
      interests: profile.interests.slice(0, 12).map((t) => String(t).slice(0, 60)),
      availability: profile.availability,
      preferredFeedVisibility: profile.preferredFeedVisibility,
      showOnlineStatus: Boolean(profile.showOnlineStatus),
      isOnline: Boolean(profile.showOnlineStatus),
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        uid: safeUid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribePublicProfiles(
  onData: (profiles: UserPublicProfile[]) => void
): Unsubscribe {
  const path = 'publicProfiles';
  const q = query(collection(db, 'publicProfiles'), where('uid', '!=', ''));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: UserPublicProfile[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid ?? d.id),
          displayName: String(data.displayName ?? 'Community Member'),
          bio: String(data.bio ?? ''),
          avatarTone: (data.avatarTone as AvatarTone) ?? 'sage',
          avatarInitials: String(
            data.avatarInitials ?? getInitials(String(data.displayName ?? 'CM'))
          ),
          statusTags: Array.isArray(data.statusTags) ? data.statusTags.map(String) : [],
          interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
          availability:
            (data.availability as UserPublicProfile['availability']) ?? 'open_to_requests',
          preferredFeedVisibility:
            data.preferredFeedVisibility === 'private' ? 'private' : 'community',
          showOnlineStatus: Boolean(data.showOnlineStatus),
          isOnline: Boolean(data.isOnline),
          isDemo: false,
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/* ============================================================================
   BLOCKED USERS (/users/{uid}/blocks)
   ============================================================================ */

export interface BlockedUserRecord {
  targetUid: string;
  targetName: string;
  createdAtMs: number;
}

export function subscribeUserBlocks(
  uid: string,
  onData: (blocks: BlockedUserRecord[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid);
  const path = `users/${safeUid}/blocks`;
  const q = query(collection(db, 'users', safeUid, 'blocks'), where('blockerUid', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: BlockedUserRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          targetUid: String(data.targetUid ?? d.id),
          targetName: String(data.targetName ?? 'User'),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function blockUserDoc(
  uid: string,
  targetUid: string,
  targetName: string
): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeTarget = sanitizeFirestoreId(targetUid);
  const path = `users/${safeUid}/blocks/${safeTarget}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'blocks', safeTarget), {
      blockerUid: safeUid,
      targetUid: safeTarget,
      targetName: (targetName.trim() || 'User').slice(0, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function unblockUserDoc(uid: string, targetUid: string): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeTarget = sanitizeFirestoreId(targetUid);
  const path = `users/${safeUid}/blocks/${safeTarget}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'blocks', safeTarget));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/* ============================================================================
   NOTIFICATIONS (/users/{uid}/notifications)
   ============================================================================ */

export function subscribeUserNotifications(
  uid: string,
  onData: (notifications: InAppNotification[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid);
  const path = `users/${safeUid}/notifications`;
  const q = query(
    collection(db, 'users', safeUid, 'notifications'),
    where('recipientUid', '==', safeUid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InAppNotification[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            recipientUid: String(data.recipientUid ?? safeUid),
            type: (data.type as InAppNotification['type']) ?? 'peer_request',
            title: String(data.title ?? ''),
            body: String(data.body ?? ''),
            relatedId: typeof data.relatedId === 'string' ? data.relatedId : undefined,
            read: Boolean(data.read),
            createdAtMs: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createNotificationDoc(
  recipientUid: string,
  senderUid: string,
  payload: {
    type: InAppNotification['type'];
    title: string;
    body: string;
    relatedId?: string;
  }
): Promise<void> {
  const safeRecipient = sanitizeFirestoreId(recipientUid);
  const safeSender = sanitizeFirestoreId(senderUid);
  const safeNotifId = sanitizeFirestoreId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `users/${safeRecipient}/notifications/${safeNotifId}`;
  try {
    await setDoc(doc(db, 'users', safeRecipient, 'notifications', safeNotifId), {
      id: safeNotifId,
      recipientUid: safeRecipient,
      senderUid: safeSender,
      type: payload.type,
      title: payload.title.slice(0, 120),
      body: payload.body.slice(0, 280),
      ...(payload.relatedId ? { relatedId: sanitizeFirestoreId(payload.relatedId) } : {}),
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationReadDoc(uid: string, notifId: string): Promise<void> {
  const safeUid = sanitizeFirestoreId(uid);
  const safeNotifId = sanitizeFirestoreId(notifId);
  const path = `users/${safeUid}/notifications/${safeNotifId}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'notifications', safeNotifId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/* ============================================================================
   PEER CONVERSATION REQUESTS (/peerRequests)
   ============================================================================ */

function mapPeerRequestDoc(id: string, data: Record<string, unknown>): PeerConversationRequest {
  return {
    id: String(data.id ?? id),
    senderUid: String(data.senderUid ?? ''),
    senderName: String(data.senderName ?? 'Member'),
    senderAvatarTone: (data.senderAvatarTone as AvatarTone) ?? 'sage',
    senderTags: Array.isArray(data.senderTags) ? data.senderTags.map(String) : [],
    recipientUid: String(data.recipientUid ?? ''),
    recipientName: String(data.recipientName ?? 'Member'),
    recipientAvatarTone: (data.recipientAvatarTone as AvatarTone) ?? 'sage',
    recipientTags: Array.isArray(data.recipientTags) ? data.recipientTags.map(String) : [],
    status: (data.status as PeerRequestStatus) ?? 'pending',
    introMessage: String(data.introMessage ?? ''),
    sharedContextSummary: String(data.sharedContextSummary ?? ''),
    ignoredByRecipient: Boolean(data.ignoredByRecipient),
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

export function subscribePeerRequests(
  uid: string,
  onData: (requests: PeerConversationRequest[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid);
  const path = 'peerRequests';

  const sentMap = new Map<string, PeerConversationRequest>();
  const receivedMap = new Map<string, PeerConversationRequest>();

  const emit = () => {
    const merged = new Map<string, PeerConversationRequest>();
    sentMap.forEach((v, k) => merged.set(k, v));
    receivedMap.forEach((v, k) => merged.set(k, v));
    onData(Array.from(merged.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs));
  };

  const unsubSent = onSnapshot(
    query(collection(db, 'peerRequests'), where('senderUid', '==', safeUid)),
    (snap) => {
      sentMap.clear();
      snap.docs.forEach((d) => sentMap.set(d.id, mapPeerRequestDoc(d.id, d.data())));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  const unsubReceived = onSnapshot(
    query(collection(db, 'peerRequests'), where('recipientUid', '==', safeUid)),
    (snap) => {
      receivedMap.clear();
      snap.docs.forEach((d) => receivedMap.set(d.id, mapPeerRequestDoc(d.id, d.data())));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  return () => {
    unsubSent();
    unsubReceived();
  };
}

export async function createPeerRequestDoc(
  req: Omit<PeerConversationRequest, 'createdAtMs' | 'updatedAtMs'>
): Promise<void> {
  const safeId = sanitizeFirestoreId(req.id);
  const safeSender = sanitizeFirestoreId(req.senderUid);
  const safeRecipient = sanitizeFirestoreId(req.recipientUid);
  const path = `peerRequests/${safeId}`;
  try {
    await setDoc(doc(db, 'peerRequests', safeId), {
      id: safeId,
      senderUid: safeSender,
      senderName: req.senderName.slice(0, 80),
      senderAvatarTone: req.senderAvatarTone,
      senderTags: req.senderTags.slice(0, 18).map((t) => String(t).slice(0, 60)),
      recipientUid: safeRecipient,
      recipientName: req.recipientName.slice(0, 80),
      recipientAvatarTone: req.recipientAvatarTone,
      recipientTags: req.recipientTags.slice(0, 18).map((t) => String(t).slice(0, 60)),
      status: 'pending',
      introMessage: req.introMessage.trim().slice(0, 500),
      sharedContextSummary: req.sharedContextSummary.slice(0, 200),
      ignoredByRecipient: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePeerRequestStatusDoc(
  requestId: string,
  status: Extract<PeerRequestStatus, 'accepted' | 'declined' | 'cancelled' | 'blocked'>
): Promise<void> {
  const safeId = sanitizeFirestoreId(requestId);
  const path = `peerRequests/${safeId}`;
  try {
    await updateDoc(doc(db, 'peerRequests', safeId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function ignorePeerRequestDoc(requestId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(requestId);
  const path = `peerRequests/${safeId}`;
  try {
    await updateDoc(doc(db, 'peerRequests', safeId), {
      ignoredByRecipient: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/* ============================================================================
   PEER CONVERSATIONS & MESSAGES (/peerConversations)
   ============================================================================ */

export function subscribePeerConversations(
  uid: string,
  onData: (conversations: PeerConversation[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(uid);
  const path = 'peerConversations';
  const q = query(
    collection(db, 'peerConversations'),
    where('participantUids', 'array-contains', safeUid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: PeerConversation[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            participantUids: Array.isArray(data.participantUids)
              ? data.participantUids.map(String)
              : [],
            participantNames:
              (data.participantNames as Record<string, string>) ?? {},
            participantTones:
              (data.participantTones as Record<string, AvatarTone>) ?? {},
            requestId: String(data.requestId ?? ''),
            status: data.status === 'ended' ? ('ended' as const) : ('active' as const),
            endedByUid: typeof data.endedByUid === 'string' ? data.endedByUid : undefined,
            lastMessagePreview: String(data.lastMessagePreview ?? ''),
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function acceptPeerRequestAndCreateConversation(
  req: PeerConversationRequest
): Promise<PeerConversation> {
  const safeRequestId = sanitizeFirestoreId(req.id);
  const safeSender = sanitizeFirestoreId(req.senderUid);
  const safeRecipient = sanitizeFirestoreId(req.recipientUid);
  const convId = sanitizeFirestoreId(`conv_${safeRequestId}`);
  const reqPath = `peerRequests/${safeRequestId}`;
  const convPath = `peerConversations/${convId}`;

  try {
    await updateDoc(doc(db, 'peerRequests', safeRequestId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }

  const initialPreview = req.introMessage.trim()
    ? req.introMessage.trim().slice(0, 180)
    : 'Conversation connected';

  try {
    await setDoc(doc(db, 'peerConversations', convId), {
      id: convId,
      participantUids: [safeSender, safeRecipient],
      participantNames: {
        [safeSender]: req.senderName.slice(0, 80),
        [safeRecipient]: req.recipientName.slice(0, 80),
      },
      participantTones: {
        [safeSender]: req.senderAvatarTone,
        [safeRecipient]: req.recipientAvatarTone,
      },
      requestId: safeRequestId,
      status: 'active',
      lastMessagePreview: initialPreview,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, convPath);
  }

  return {
    id: convId,
    participantUids: [safeSender, safeRecipient],
    participantNames: {
      [safeSender]: req.senderName,
      [safeRecipient]: req.recipientName,
    },
    participantTones: {
      [safeSender]: req.senderAvatarTone,
      [safeRecipient]: req.recipientAvatarTone,
    },
    requestId: safeRequestId,
    status: 'active',
    lastMessagePreview: initialPreview,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };
}

export async function endPeerConversationDoc(
  conversationId: string,
  endedByUid: string
): Promise<void> {
  const safeConvId = sanitizeFirestoreId(conversationId);
  const safeUid = sanitizeFirestoreId(endedByUid);
  const path = `peerConversations/${safeConvId}`;
  try {
    await updateDoc(doc(db, 'peerConversations', safeConvId), {
      status: 'ended',
      endedByUid: safeUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribePeerMessages(
  conversationId: string,
  currentUid: string,
  onData: (messages: PeerChatMessage[]) => void
): Unsubscribe {
  const safeConvId = sanitizeFirestoreId(conversationId);
  const safeUid = sanitizeFirestoreId(currentUid);
  const path = `peerConversations/${safeConvId}/messages`;
  const q = query(
    collection(db, 'peerConversations', safeConvId, 'messages'),
    where('participantUids', 'array-contains', safeUid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: PeerChatMessage[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            conversationId: String(data.conversationId ?? safeConvId),
            senderUid: String(data.senderUid ?? ''),
            senderName: String(data.senderName ?? 'Member'),
            text: String(data.text ?? ''),
            createdAtMs: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function sendPeerMessageDoc(
  conversation: PeerConversation,
  senderUid: string,
  senderName: string,
  text: string
): Promise<void> {
  const safeConvId = sanitizeFirestoreId(conversation.id);
  const safeSender = sanitizeFirestoreId(senderUid);
  const msgId = sanitizeFirestoreId(`pmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const msgPath = `peerConversations/${safeConvId}/messages/${msgId}`;
  const cleanText = text.trim().slice(0, 2000);

  try {
    await setDoc(doc(db, 'peerConversations', safeConvId, 'messages', msgId), {
      id: msgId,
      conversationId: safeConvId,
      participantUids: conversation.participantUids.map(sanitizeFirestoreId),
      senderUid: safeSender,
      senderName: senderName.slice(0, 80),
      text: cleanText,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'peerConversations', safeConvId), {
      lastMessagePreview: cleanText.slice(0, 180),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

/* ============================================================================
   SHONGI COMMUNITY FEED (/feedPosts)
   ============================================================================ */

function mapFeedPostDoc(id: string, data: Record<string, unknown>): FeedPost {
  const counts = (data.reactionCounts as Record<string, unknown>) ?? {};
  return {
    id: String(data.id ?? id),
    authorUid: String(data.authorUid ?? ''),
    authorName: String(data.authorName ?? 'Member'),
    authorAvatarTone: (data.authorAvatarTone as AvatarTone) ?? 'sage',
    postType: (data.postType as FeedPost['postType']) ?? 'thought',
    mood: typeof data.mood === 'string' ? data.mood : undefined,
    title: typeof data.title === 'string' ? data.title : undefined,
    body: String(data.body ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    visibility: data.visibility === 'private' ? 'private' : 'community',
    reactionCounts: {
      hear_you: Number(counts.hear_you ?? 0),
      sending_support: Number(counts.sending_support ?? 0),
      relatable: Number(counts.relatable ?? 0),
      you_got_this: Number(counts.you_got_this ?? 0),
    },
    commentCount: Number(data.commentCount ?? 0),
    isDemo: false,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

export function subscribeFeedPosts(
  viewerUid: string,
  onData: (posts: FeedPost[]) => void
): Unsubscribe {
  const safeUid = sanitizeFirestoreId(viewerUid);
  const path = 'feedPosts';

  const communityMap = new Map<string, FeedPost>();
  const ownMap = new Map<string, FeedPost>();

  const emit = () => {
    const merged = new Map<string, FeedPost>();
    communityMap.forEach((v, k) => merged.set(k, v));
    ownMap.forEach((v, k) => merged.set(k, v));
    onData(Array.from(merged.values()).sort((a, b) => b.createdAtMs - a.createdAtMs));
  };

  const unsubCommunity = onSnapshot(
    query(collection(db, 'feedPosts'), where('visibility', '==', 'community')),
    (snap) => {
      communityMap.clear();
      snap.docs.forEach((d) => communityMap.set(d.id, mapFeedPostDoc(d.id, d.data())));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  const unsubOwn = onSnapshot(
    query(collection(db, 'feedPosts'), where('authorUid', '==', safeUid)),
    (snap) => {
      ownMap.clear();
      snap.docs.forEach((d) => ownMap.set(d.id, mapFeedPostDoc(d.id, d.data())));
      emit();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  return () => {
    unsubCommunity();
    unsubOwn();
  };
}

export async function createFeedPostDoc(
  post: Omit<FeedPost, 'createdAtMs' | 'updatedAtMs'>
): Promise<void> {
  const safeId = sanitizeFirestoreId(post.id);
  const safeAuthor = sanitizeFirestoreId(post.authorUid);
  const path = `feedPosts/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      id: safeId,
      authorUid: safeAuthor,
      authorName: post.authorName.slice(0, 80),
      authorAvatarTone: post.authorAvatarTone,
      postType: post.postType,
      body: post.body.trim().slice(0, 4000),
      tags: post.tags.slice(0, 8).map((t) => String(t).slice(0, 60)),
      visibility: post.visibility,
      reactionCounts: {
        hear_you: 0,
        sending_support: 0,
        relatable: 0,
        you_got_this: 0,
      },
      commentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (post.mood?.trim()) {
      payload.mood = post.mood.trim().slice(0, 40);
    }
    if (post.title?.trim()) {
      payload.title = post.title.trim().slice(0, 160);
    }
    await setDoc(doc(db, 'feedPosts', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFeedPostDoc(
  postId: string,
  patch: Pick<FeedPost, 'postType' | 'mood' | 'title' | 'body' | 'tags' | 'visibility'>
): Promise<void> {
  const safeId = sanitizeFirestoreId(postId);
  const path = `feedPosts/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      postType: patch.postType,
      body: patch.body.trim().slice(0, 4000),
      tags: patch.tags.slice(0, 8).map((t) => String(t).slice(0, 60)),
      visibility: patch.visibility,
      updatedAt: serverTimestamp(),
    };
    if (patch.mood !== undefined) {
      payload.mood = patch.mood.trim().slice(0, 40);
    }
    if (patch.title !== undefined) {
      payload.title = patch.title.trim().slice(0, 160);
    }
    await updateDoc(doc(db, 'feedPosts', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFeedPostDoc(postId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(postId);
  const path = `feedPosts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'feedPosts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleFeedReactionDoc(
  post: FeedPost,
  userId: string,
  reactionType: FeedReactionType
): Promise<Record<FeedReactionType, number>> {
  const safePostId = sanitizeFirestoreId(post.id);
  const safeUid = sanitizeFirestoreId(userId);
  const reactRef = doc(db, 'feedPosts', safePostId, 'reactions', safeUid);
  const postRef = doc(db, 'feedPosts', safePostId);
  const path = `feedPosts/${safePostId}/reactions/${safeUid}`;

  try {
    const existingSnap = await getDoc(reactRef);
    const nextCounts = { ...post.reactionCounts };

    if (existingSnap.exists()) {
      const prevType = existingSnap.data().reactionType as FeedReactionType;
      nextCounts[prevType] = Math.max(0, (nextCounts[prevType] ?? 0) - 1);
      if (prevType === reactionType) {
        await deleteDoc(reactRef);
      } else {
        nextCounts[reactionType] = (nextCounts[reactionType] ?? 0) + 1;
        await updateDoc(reactRef, {
          reactionType,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      nextCounts[reactionType] = (nextCounts[reactionType] ?? 0) + 1;
      await setDoc(reactRef, {
        userId: safeUid,
        postId: safePostId,
        reactionType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(postRef, {
      reactionCounts: nextCounts,
      updatedAt: serverTimestamp(),
    });
    return nextCounts;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchFeedComments(postId: string): Promise<FeedComment[]> {
  const safePostId = sanitizeFirestoreId(postId);
  const path = `feedPosts/${safePostId}/comments`;
  try {
    const snap = await getDocs(
      query(collection(db, 'feedPosts', safePostId, 'comments'), where('postId', '==', safePostId))
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          postId: String(data.postId ?? safePostId),
          authorUid: String(data.authorUid ?? ''),
          authorName: String(data.authorName ?? 'Member'),
          body: String(data.body ?? ''),
          createdAtMs: toMillis(data.createdAt),
        };
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addFeedCommentDoc(
  post: FeedPost,
  authorUid: string,
  authorName: string,
  body: string
): Promise<FeedComment> {
  const safePostId = sanitizeFirestoreId(post.id);
  const safeUid = sanitizeFirestoreId(authorUid);
  const commentId = sanitizeFirestoreId(`cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `feedPosts/${safePostId}/comments/${commentId}`;
  const cleanBody = body.trim().slice(0, 1000);

  try {
    await setDoc(doc(db, 'feedPosts', safePostId, 'comments', commentId), {
      id: commentId,
      postId: safePostId,
      authorUid: safeUid,
      authorName: authorName.slice(0, 80),
      body: cleanBody,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'feedPosts', safePostId), {
      commentCount: (post.commentCount ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });
    return {
      id: commentId,
      postId: safePostId,
      authorUid: safeUid,
      authorName,
      body: cleanBody,
      createdAtMs: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFeedCommentDoc(
  post: FeedPost,
  commentId: string
): Promise<void> {
  const safePostId = sanitizeFirestoreId(post.id);
  const safeCommentId = sanitizeFirestoreId(commentId);
  const path = `feedPosts/${safePostId}/comments/${safeCommentId}`;
  try {
    await deleteDoc(doc(db, 'feedPosts', safePostId, 'comments', safeCommentId));
    await updateDoc(doc(db, 'feedPosts', safePostId), {
      commentCount: Math.max(0, (post.commentCount ?? 1) - 1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/* ============================================================================
   MODERATION REPORTS (/moderationReports)
   ============================================================================ */

export async function createModerationReportDoc(
  report: Omit<ModerationReport, 'id' | 'createdAtMs'>
): Promise<void> {
  const safeId = sanitizeFirestoreId(`rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const safeReporter = sanitizeFirestoreId(report.reporterUid);
  const safeTargetId = sanitizeFirestoreId(report.targetId);
  const path = `moderationReports/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      id: safeId,
      reporterUid: safeReporter,
      targetType: report.targetType,
      targetId: safeTargetId,
      reason: report.reason.slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (report.targetUid) {
      payload.targetUid = sanitizeFirestoreId(report.targetUid);
    }
    if (report.details?.trim()) {
      payload.details = report.details.trim().slice(0, 500);
    }
    await setDoc(doc(db, 'moderationReports', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
