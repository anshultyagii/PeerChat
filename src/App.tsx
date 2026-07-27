import { useEffect, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types';
import { cacheUserProfile, getCachedUserProfile, syncUsernameMapping } from '@/lib/utils/auth';
import AuthScreen from '@/components/Auth/AuthScreen';
import LandingPage from '@/components/Landing/LandingPage';
import GoogleOnboarding from '@/components/Auth/GoogleOnboarding';
import ChatApp from '@/components/Chat/ChatApp';
import PrivateChatApp from '@/components/Chat/PrivateChatApp';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

/**
 * Authentication is owned by Firebase Auth; a Firestore profile is app data.
 * Keep a signed-in user in the app when that optional document is missing or
 * temporarily unreadable instead of presenting it as a failed login.
 */
function profileFromAuthUser(user: FirebaseUser): UserProfile {
  const nameParts = user.displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  // Do not derive this from an email address: two addresses can normalize to
  // the same value, which would make their chat room identifiers collide.
  const username = `user_${user.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;

  return {
    uid: user.uid,
    firstName: nameParts[0] || username,
    lastName: nameParts.slice(1).join(' '),
    email: user.email || '',
    phone: '',
    username,
    usernameLower: username.toLowerCase(),
    profilePic: user.photoURL || null,
  };
}

function isGoogleUser(user: FirebaseUser): boolean {
  return user.providerData.some((provider) => provider.providerId === 'google.com');
}

function isCompleteGoogleProfile(profile: UserProfile | null): profile is UserProfile {
  return !!profile && /^\d{10}$/.test(profile.phone) && !!profile.username.trim() && !!profile.firstName.trim();
}

export default function App() {
  const location = useLocation();
  // The reset link keeps its Firebase parameters in the regular query string.
  const params = new URLSearchParams(window.location.search);
  const isPrivate = location.pathname === '/private' || params.get('private') === 'true';

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [onboardingUser, setOnboardingUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const isChatRoute = location.pathname === '/chat';
  const isAuthRoute = location.pathname === '/auth';

  // Detect password-reset deep link
  const resetOobCode = params.get('mode') === 'resetPassword' ? params.get('oobCode') : null;

  useEffect(() => {
    if (isPrivate || resetOobCode) return;
    // Process redirect result if Google Sign-In used redirect mode
    getRedirectResult(auth).catch((err) => {
      console.warn("getRedirectResult warning:", err);
    });
  }, [isPrivate, resetOobCode]);

  useEffect(() => {
    if (isPrivate || resetOobCode) return;

    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      // Auth can resolve before the profile lookup does. Keep the progress
      // screen visible for that hand-off instead of leaving the old auth form
      // onscreen until the next route is known.
      setIsLoading(true);
      setProgress(firebaseUser ? 35 : 70);

      if (firebaseUser) {
        // Show cached copy instantly if available
        const storedProfile = getCachedUserProfile(firebaseUser.uid);
        // Older fallback profiles contain no phone number. They are not a
        // completed Google profile and must not suppress the onboarding form.
        const cached = isGoogleUser(firebaseUser) && !isCompleteGoogleProfile(storedProfile)
          ? null
          : storedProfile;
        if (cached) {
          setCurrentUser(cached);
        }

        try {
          // Attempt to fetch profile with retries to prevent race conditions during signup
          let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let retries = 0;
          while (!userDoc.exists() && retries < 3) {
            await new Promise((r) => setTimeout(r, 300));
            userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            retries++;
          }

          if (!isMounted) return;

          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setCurrentUser(profile);
            setOnboardingUser(null);
            cacheUserProfile(profile);
            syncUsernameMapping(profile);
            if (!cached) {
              toast.success("Successfully logged in", { description: `Welcome back, ${profile.firstName}!` });
            }
          } else {
            // Check auth provider
            if (isGoogleUser(firebaseUser)) {
              if (cached) {
                // A profile may have been created while Firestore was
                // temporarily unavailable. Restore it now instead of making
                // the same Google account complete onboarding again.
                setCurrentUser(cached);
                setOnboardingUser(null);
                void setDoc(doc(db, 'users', firebaseUser.uid), cached).catch((error) => {
                  console.error('Profile restore error:', error);
                  toast.warning('Profile sync is delayed', {
                    description: 'Your account is ready; we will save its profile when Firebase reconnects.',
                  });
                });
              } else {
                // Brand-new Google user requiring profile onboarding.
                setCurrentUser(null);
                setOnboardingUser(firebaseUser);
              }
            } else {
              // An account can pre-date profiles, or Firestore can be delayed.
              // Do not discard a valid Firebase Auth session in either case.
              const recoveredProfile = cached ?? profileFromAuthUser(firebaseUser);
              console.warn("Missing Firestore user profile; using a local profile until it can be restored.");
              setCurrentUser(recoveredProfile);
              setOnboardingUser(null);
              cacheUserProfile(recoveredProfile);
              toast.warning("Profile sync is unavailable", {
                description: "You are signed in, but some profile and contact features may be limited until it reconnects.",
              });
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          if (isMounted) {
            // Google accounts without a readable saved profile must complete
            // onboarding. Do not manufacture a username/name from provider
            // metadata, since it bypasses the details the user is meant to set.
            if (isGoogleUser(firebaseUser) && !cached) {
              setCurrentUser(null);
              setOnboardingUser(firebaseUser);
            } else {
              // A Firestore outage or restrictive rules must not log a user out.
              const recoveredProfile = cached ?? profileFromAuthUser(firebaseUser);
              setCurrentUser(recoveredProfile);
              setOnboardingUser(null);
              cacheUserProfile(recoveredProfile);
              toast.warning("Profile sync is unavailable", {
                description: "You are signed in. We'll retry your profile when Firestore is available.",
              });
            }
          }
        }
      } else {
        setCurrentUser(null);
        setOnboardingUser(null);
        // Keep completed profiles per UID. This lets a user recover their
        // profile if Firebase Auth succeeds but a prior Firestore write was
        // interrupted; getCachedUserProfile always verifies the UID first.
      }

      if (isMounted) {
        setIsLoading(false);
        setProgress(100);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isPrivate, resetOobCode]);

  if (isPrivate) {
    return (
      <>
        <PrivateChatApp />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (isLoading && !resetOobCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground bg-[#050505]">
        <div className="w-56 space-y-3">
          <Progress value={progress} className="h-1.5 bg-white/15 [&>div]:bg-white" />
        </div>
      </div>
    );
  }

  return (
    <>
      {resetOobCode ? (
        <AuthScreen resetOobCode={resetOobCode} />
      ) : onboardingUser ? (
        <GoogleOnboarding
          firebaseUser={onboardingUser}
          onComplete={(profile) => {
            setCurrentUser(profile);
            setOnboardingUser(null);
            cacheUserProfile(profile);
            toast.success("Profile complete", { description: `Welcome, ${profile.firstName}!` });
          }}
        />
      ) : currentUser ? (
        isChatRoute ? (
          <ChatApp currentUser={currentUser} />
        ) : isAuthRoute ? (
          <ChatApp currentUser={currentUser} />
        ) : (
          <LandingPage onStart={() => { window.location.hash = '/chat'; }} />
        )
      ) : isAuthRoute ? (
        <AuthScreen onClose={() => { window.location.hash = ''; }} />
      ) : (
        <LandingPage onStart={() => { window.location.hash = '/auth'; }} />
      )}
      <Toaster position="bottom-right" />
    </>
  );
}
