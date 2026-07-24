import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { ref, get, set, update } from 'firebase/database';
import { signInWithPopup, signInWithRedirect, UserCredential } from 'firebase/auth';
import { auth, db, rtdb, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/types';

const USERNAME_CACHE_TTL_MS = 60_000;
const usernameAvailabilityCache = new Map<string, { taken: boolean; expiresAt: number }>();

/** 
 * Looks up the email address tied to a username or email input, for authentication.
 * If the input is already an email address, it returns it directly.
 */
export async function getEmailFromUsername(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If user typed an email address, return it directly
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const cleanUsername = trimmed.toLowerCase();

  // 1. Try Realtime Database public username index (bypasses Firestore unauthenticated rules)
  try {
    const rtdbSnap = await get(ref(rtdb, `usernames/${cleanUsername}`));
    if (rtdbSnap.exists()) {
      const val = rtdbSnap.val();
      if (val && typeof val === 'object' && val.email) {
        return val.email as string;
      } else if (typeof val === 'string') {
        return val;
      }
    }
  } catch (err) {
    console.warn("RTDB username lookup error:", err);
  }

  // 2. Try Firestore query by usernameLower
  try {
    const q1 = query(
      collection(db, 'users'),
      where('usernameLower', '==', cleanUsername),
      limit(1)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return (snap1.docs[0].data().email as string) ?? null;
    }

    // 3. Fallback query by exact username field
    const q2 = query(
      collection(db, 'users'),
      where('username', '==', trimmed),
      limit(1)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      return (snap2.docs[0].data().email as string) ?? null;
    }

    // 4. Scan collection for case-insensitive match on legacy accounts
    const q3 = query(collection(db, 'users'), limit(50));
    const snap3 = await getDocs(q3);
    const foundDoc = snap3.docs.find(d => {
      const u = d.data().username;
      const ul = d.data().usernameLower;
      return (u && u.toLowerCase() === cleanUsername) || (ul && ul.toLowerCase() === cleanUsername);
    });
    if (foundDoc) {
      return (foundDoc.data().email as string) ?? null;
    }
  } catch (err) {
    console.error("Firestore username lookup error:", err);
  }

  return null;
}

/** Registers a username to email mapping in RTDB for fast unauthenticated lookup. */
export async function syncUsernameMapping(profile: { username: string; email: string; uid: string }) {
  if (!profile.username || !profile.email) return;
  const cleanUsername = profile.username.trim().toLowerCase();
  try {
    await set(ref(rtdb, `usernames/${cleanUsername}`), {
      email: profile.email,
      username: profile.username,
      uid: profile.uid,
    });
  } catch (err) {
    console.warn("Could not sync username mapping to RTDB:", err);
  }
}

/** Syncs live profile data (name, photo) to RTDB so other users see updates in realtime. */
export async function syncUserProfileRTDB(profile: { uid: string; firstName: string; lastName: string; username: string; profilePic: string | null }) {
  if (!profile.uid) return;
  try {
    await update(ref(rtdb, `userProfiles/${profile.uid}`), {
      uid: profile.uid,
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
      profilePic: profile.profilePic ?? null,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn("Could not sync user profile to RTDB:", err);
  }
}

/** Returns true if a username is already taken by another user. */
export async function isUsernameTaken(username: string, excludeUid?: string): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return false;

  if (!excludeUid) {
    const cached = usernameAvailabilityCache.get(cleanUsername);
    if (cached && cached.expiresAt > Date.now()) return cached.taken;
  }

  // 1. Check RTDB usernames index
  try {
    const rtdbSnap = await get(ref(rtdb, `usernames/${cleanUsername}`));
    if (rtdbSnap.exists()) {
      const val = rtdbSnap.val();
      const ownerUid = typeof val === 'object' ? val.uid : null;
      if (!excludeUid || ownerUid !== excludeUid) {
        if (!excludeUid) {
          usernameAvailabilityCache.set(cleanUsername, { taken: true, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        }
        return true;
      }
    }
  } catch (err) {
    console.warn("RTDB username availability check warning:", err);
  }

  // 2. Check Firestore
  try {
    const q = query(
      collection(db, 'users'),
      where('usernameLower', '==', cleanUsername),
      limit(2)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      if (!excludeUid) {
        usernameAvailabilityCache.set(cleanUsername, { taken: false, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
      }
      return false;
    }

    if (excludeUid) {
      const existingDoc = snap.docs.find(d => d.id !== excludeUid);
      return !!existingDoc;
    }

    usernameAvailabilityCache.set(cleanUsername, { taken: true, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
    return true;
  } catch (err) {
    console.error("Firestore username availability error:", err);
    throw err;
  }
}

/** Helper to perform Google sign-in with popup, falling back to redirect if popups are blocked. */
export async function performGoogleSignIn(): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

/** Translates raw Firebase Auth errors into clear, actionable error messages. */
export function formatAuthError(err: any): string {
  if (!err) return "An unexpected error occurred.";
  const code = err.code || '';
  const message = err.message || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return "Invalid username/email or password.";
    case 'auth/email-already-in-use':
      return "An account with this email address already exists.";
    case 'auth/weak-password':
      return "Password is too weak. Please use at least 8 characters.";
    case 'auth/popup-blocked':
      return "Sign-in popup was blocked by your browser. Please allow popups or try again.";
    case 'auth/popup-closed-by-user':
      return "Sign-in popup was closed before finishing authentication.";
    case 'auth/cancelled-popup-request':
      return "Google sign-in was cancelled.";
    case 'auth/operation-not-allowed':
      return "This sign-in method is not enabled in Firebase Authentication. Enable it in the Firebase Console and try again.";
    case 'auth/unauthorized-domain':
      return "This domain is not authorized for Google Sign-In in Firebase Console.";
    case 'auth/too-many-requests':
      return "Too many failed attempts. Please try again later.";
    case 'auth/network-request-failed':
      return "Network error. Please check your internet connection.";
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return "This app's Firebase configuration is invalid or no longer authorized.";
    default:
      return message.replace(/^Firebase:\s*/, '') || "Authentication failed.";
  }
}

const PROFILE_CACHE_KEY = 'cachedUserProfile';

/** Cache the profile locally so the next login can render instantly while we revalidate. */
export function cacheUserProfile(profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors (private browsing, quota, etc.)
  }
}

export function getCachedUserProfile(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed.uid === uid ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCachedUserProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
}
