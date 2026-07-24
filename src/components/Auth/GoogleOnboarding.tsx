import { useEffect, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isUsernameTaken, syncUsernameMapping } from '@/lib/utils/auth';
import { UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Check, X as XIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const REGEX = {
  phone: /^\d{10}$/,
  username: /^[a-zA-Z0-9_]{3,15}$/,
};

const inputStyles = "w-full bg-black/30 border text-white rounded-[14px] px-[18px] py-[16px] text-[16px] outline-none focus:bg-white/5 focus:shadow-[inset_2px_0px_15px_-5px_rgba(255,255,255,0.3)] transition-all placeholder:text-[#666]";
const inputOk = "border-white/5 focus:border-white/20";
const inputErr = "border-[#ff4d4d] focus:border-[#ff4d4d]";
const primaryBtnStyles = "w-full bg-[#ffffff] text-[#000000] font-semibold p-[16px] rounded-[14px] text-[16px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtnStyles = "w-full bg-white/10 text-white p-[16px] rounded-[14px] text-[16px] hover:bg-white/20 transition-all cursor-pointer";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">{message}</p>;
}

function generateBaseUsername(firebaseUser: FirebaseUser): string {
  const raw = (firebaseUser.email?.split('@')[0] || firebaseUser.displayName?.replace(/\s+/g, '') || 'user')
    .replace(/[^a-zA-Z0-9_]/g, '');
  
  let base = raw.slice(0, 12);
  if (base.length < 3) {
    base = (base + 'user').slice(0, 12);
  }
  return base;
}

export default function GoogleOnboarding({
  firebaseUser,
  onComplete,
}: {
  firebaseUser: FirebaseUser;
  onComplete: (profile: UserProfile) => void;
}) {
  const initialFirstName = firebaseUser.displayName?.split(' ')[0] || '';
  const initialLastName = firebaseUser.displayName?.split(' ').slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState(() => generateBaseUsername(firebaseUser));
  const [profilePic, setProfilePic] = useState<string | null>(firebaseUser.photoURL || null);
  const [errors, setErrors] = useState<{ firstName?: string; phone?: string; username?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'unavailable'>('idle');
  const checkToken = useRef(0);

  // Live username availability check & auto-resolution for initial suggestion
  useEffect(() => {
    const trimmed = username.trim();
    if (!REGEX.username.test(trimmed)) {
      setUsernameStatus('idle');
      return;
    }

    const token = ++checkToken.current;
    setUsernameStatus('checking');

    const handle = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(trimmed, firebaseUser.uid);
        if (checkToken.current !== token) return;
        
        if (taken) {
          setUsernameStatus('taken');
        } else {
          setUsernameStatus('available');
        }
      } catch {
        if (checkToken.current === token) setUsernameStatus('unavailable');
      }
    }, 75);

    return () => clearTimeout(handle);
  }, [username, firebaseUser.uid]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedPhone = phone.trim();
    const trimmedUsername = username.trim();

    const next: typeof errors = {};
    if (!trimmedFirstName) next.firstName = "Enter your first name.";
    if (!REGEX.phone.test(trimmedPhone)) next.phone = "Must be exactly 10 digits.";
    if (!REGEX.username.test(trimmedUsername)) next.username = "3-15 characters: letters, numbers, underscores.";
    else if (usernameStatus === 'taken') next.username = "This username is already taken.";
    else if (usernameStatus !== 'available') next.username = "We couldn't verify this username. Please wait and try again.";

    if (Object.keys(next).length > 0) return setErrors(next);

    setSubmitting(true);
    try {
      const profile: UserProfile = {
        uid: firebaseUser.uid,
        firstName: trimmedFirstName,
        lastName: lastName.trim(),
        email: firebaseUser.email || '',
        phone: trimmedPhone,
        username: trimmedUsername,
        usernameLower: trimmedUsername.toLowerCase(),
        profilePic,
      };

      // The authenticated user should not be trapped on this screen while a
      // Firestore write waits for a slow/offline connection. The parent caches
      // this completed profile before entering the app; keep persisting it in
      // the background and report if that later fails.
      void setDoc(doc(db, 'users', firebaseUser.uid), profile).catch((err) => {
        console.error("Google onboarding profile sync error:", err);
        toast.warning("Profile sync is delayed", {
          description: "Your local profile was saved, but cloud sync is taking longer than expected.",
        });
      });
      void syncUsernameMapping(profile);
      onComplete(profile);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 overflow-hidden text-white font-sans">
      <div className="relative z-10 bg-[#1e1e1e]/40 backdrop-blur-[24px] border border-white/10 rounded-[28px] p-[40px] w-full max-w-[480px] max-h-[95vh] overflow-y-auto shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="text-[26px] font-semibold mb-[6px]">Complete your profile</h2>
        <p className="text-[#a3a3a3] text-[14px] mb-[28px]">Just a few more details to finish setting up your account.</p>

        <div className="space-y-[20px] flex flex-col items-center">
          <FieldError message={errors.form} />

          <Avatar className="w-28 h-28 border border-white/10 bg-black/50">
            <AvatarImage src={profilePic || undefined} />
            <AvatarFallback className="text-3xl text-[#666] bg-transparent">{firstName[0] || '?'}</AvatarFallback>
          </Avatar>
          <div className="w-full">
            <label htmlFor="onboarding-picture" className={`cursor-pointer flex items-center justify-center ${secondaryBtnStyles}`}>
              <Upload className="w-5 h-5 mr-2" />
              Upload photo
              <input id="onboarding-picture" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>

          <div className="flex gap-[16px] w-full">
            <div className="flex-1">
              <input value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: undefined })); }} placeholder="First name*" className={`${inputStyles} ${errors.firstName ? inputErr : inputOk}`} />
              <FieldError message={errors.firstName} />
            </div>
            <div className="flex-1">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={`${inputStyles} ${inputOk}`} />
            </div>
          </div>

          <div className="w-full">
            <div className="relative">
              <span className="absolute left-[18px] top-1/2 -translate-y-1/2 text-[16px]">🇮🇳</span>
              <input value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }} placeholder="(+91) Phone number*" className={`${inputStyles} pl-[50px] ${errors.phone ? inputErr : inputOk}`} />
            </div>
            <FieldError message={errors.phone} />
          </div>

          <div className="w-full">
            <div className="relative">
              <input value={username} onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: undefined })); }} placeholder="Choose a username*" className={`${inputStyles} pr-[46px] ${errors.username ? inputErr : inputOk}`} />
              <span className="absolute right-[16px] top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#666] animate-spin" />}
                {usernameStatus === 'available' && <Check className="w-4 h-4 text-green-500" />}
                {usernameStatus === 'taken' && <XIcon className="w-4 h-4 text-[#ff4d4d]" />}
                {usernameStatus === 'unavailable' && <XIcon className="w-4 h-4 text-[#ff4d4d]" />}
              </span>
            </div>
            {!errors.username && usernameStatus === 'available' && (
              <p className="text-green-500 text-[12px] mt-[6px] ml-[4px]">Username is available.</p>
            )}
            {!errors.username && usernameStatus === 'taken' && (
              <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">Username is already taken.</p>
            )}
            {!errors.username && usernameStatus === 'unavailable' && (
              <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">Couldn't verify username. Please try again.</p>
            )}
            <FieldError message={errors.username} />
          </div>

          <button type="button" onClick={handleSubmit} disabled={submitting} className={`${primaryBtnStyles} mt-[8px]`}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Finish setup"}
          </button>
        </div>
      </div>
    </div>
  );
}
