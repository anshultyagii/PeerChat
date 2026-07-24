import { useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isUsernameTaken, cacheUserProfile, performGoogleSignIn, formatAuthError, syncUsernameMapping } from '@/lib/utils/auth';
import { UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, EyeOff, Upload, Mail, Check, X as XIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const REGEX = {
  name: /^[A-Za-z\s]{2,50}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\d{10}$/,
  username: /^[a-zA-Z0-9_]{3,15}$/,
  password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/
};

const inputStyles = "w-full bg-black/30 border text-white rounded-[14px] px-[18px] py-[16px] text-[16px] outline-none focus:bg-white/5 focus:shadow-[inset_2px_0px_15px_-5px_rgba(255,255,255,0.3)] transition-all placeholder:text-[#666]";
const inputOk = "border-white/5 focus:border-white/20";
const inputErr = "border-[#ff4d4d] focus:border-[#ff4d4d]";
const primaryBtnStyles = "w-full bg-[#ffffff] text-[#000000] font-semibold p-[16px] rounded-[14px] text-[16px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtnStyles = "w-full bg-white/10 text-white p-[16px] rounded-[14px] text-[16px] hover:bg-white/20 transition-all cursor-pointer";

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'username' | 'password' | 'confirmPassword' | 'form', string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">{message}</p>;
}

export default function SignupForm() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', username: '', password: '', confirmPassword: ''
  });
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // --- live username availability ---
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'unavailable'>('idle');
  const usernameCheckToken = useRef(0);

  useEffect(() => {
    const username = formData.username.trim();
    if (!REGEX.username.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    const token = ++usernameCheckToken.current;
    setUsernameStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(username);
        if (usernameCheckToken.current !== token) return; // stale response
        setUsernameStatus(taken ? 'taken' : 'available');
      } catch {
        if (usernameCheckToken.current === token) setUsernameStatus('unavailable');
      }
    }, 75);
    return () => clearTimeout(handle);
  }, [formData.username]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
  };

  const validateStep1 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!REGEX.name.test(formData.firstName.trim())) next.firstName = "Use letters only, 2-50 characters.";
    if (!REGEX.email.test(formData.email.trim())) next.email = "Enter a valid email address.";
    if (!REGEX.phone.test(formData.phone.trim())) next.phone = "Must be exactly 10 digits.";
    if (!REGEX.username.test(formData.username.trim())) next.username = "3-15 characters: letters, numbers, underscores.";
    else if (usernameStatus === 'taken') next.username = "This username is already taken.";
    else if (usernameStatus !== 'available') next.username = "We couldn't verify this username. Please wait and try again.";
    return next;
  };

  const validateStep2 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!REGEX.password.test(formData.password)) next.password = "8+ chars with at least 1 letter and 1 number.";
    if (formData.password !== formData.confirmPassword) next.confirmPassword = "Passwords do not match.";
    return next;
  };

  const handleNext = () => {
    const stepErrors = step === 1 ? validateStep1() : validateStep2();
    if (Object.keys(stepErrors).length > 0) return setErrors(stepErrors);
    setErrors({});
    setStep(step + 1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSignupComplete = async () => {
    setErrors({});
    setSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
      const profile: UserProfile = {
        uid: userCredential.user.uid,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        username: formData.username.trim(),
        usernameLower: formData.username.trim().toLowerCase(),
        profilePic: profilePic
      };
      
      // Cache profile locally first to prevent race conditions during Auth state changes
      cacheUserProfile(profile);
      
      // Write profile to Firestore and sync username mapping to RTDB
      await setDoc(doc(db, 'users', userCredential.user.uid), profile);
      await syncUsernameMapping(profile);
    } catch (err: any) {
      console.error("Signup error:", err);
      const message = formatAuthError(err);
      setErrors({ form: message });
      toast.error("Sign-up failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setErrors({});
    setGoogleLoading(true);
    try {
      await performGoogleSignIn();
      // If this is a new user, App.tsx will detect there's no Firestore
      // profile yet and route to the onboarding screen automatically.
    } catch (err: any) {
      console.error("Google signup error:", err);
      const message = formatAuthError(err);
      setErrors({ form: message });
      toast.error("Google sign-up failed", { description: message });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1">
        <FieldError message={errors.form} />

        {step === 1 && (
          <div className="space-y-[16px]">
            <div className="flex gap-[16px]">
              <div className="flex-1">
                <input name="firstName" placeholder="First name*" value={formData.firstName} onChange={handleInputChange} className={`${inputStyles} ${errors.firstName ? inputErr : inputOk}`} />
                <FieldError message={errors.firstName} />
              </div>
              <div className="flex-1">
                <input name="lastName" placeholder="Last name" value={formData.lastName} onChange={handleInputChange} className={`${inputStyles} ${inputOk}`} />
              </div>
            </div>

            <div>
              <div className="relative">
                <Mail className="absolute left-[18px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                <input name="email" type="email" placeholder="Enter your email*" value={formData.email} onChange={handleInputChange} className={`${inputStyles} pl-[50px] ${errors.email ? inputErr : inputOk}`} />
              </div>
              <FieldError message={errors.email} />
            </div>

            <div>
              <div className="relative">
                <span className="absolute left-[18px] top-1/2 -translate-y-1/2 text-[16px]">🇮🇳</span>
                <input name="phone" type="tel" placeholder="(+91) Phone number*" value={formData.phone} onChange={handleInputChange} className={`${inputStyles} pl-[50px] ${errors.phone ? inputErr : inputOk}`} />
              </div>
              <FieldError message={errors.phone} />
            </div>

            <div>
              <div className="relative">
                <input name="username" placeholder="Choose a username*" value={formData.username} onChange={handleInputChange} className={`${inputStyles} pr-[46px] ${errors.username ? inputErr : inputOk}`} />
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

            <button type="button" onClick={handleNext} className={`${primaryBtnStyles} mt-[8px]`}>Continue</button>

            <div className="flex items-center gap-3 py-[6px]">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[#666] text-[12px]">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button type="button" onClick={handleGoogleSignup} disabled={googleLoading} className={`${secondaryBtnStyles} flex items-center justify-center gap-3 disabled:opacity-60`}>
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-[16px]">
            <div>
              <div className="relative">
                <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Password*" value={formData.password} onChange={handleInputChange} className={`${inputStyles} ${errors.password ? inputErr : inputOk}`} />
                <button type="button" className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <FieldError message={errors.password} />
              {!errors.password && <small className="block text-[#666] text-[12px] mt-[6px] ml-[4px]">Alphanumeric & underscore only, min 8 chars.</small>}
            </div>

            <div>
              <div className="relative">
                <input name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Confirm Password*" value={formData.confirmPassword} onChange={handleInputChange} className={`${inputStyles} ${errors.confirmPassword ? inputErr : inputOk}`} />
                <button type="button" className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <FieldError message={errors.confirmPassword} />
            </div>

            <div className="flex gap-[12px] mt-[10px]">
              <button type="button" onClick={() => { setErrors({}); setStep(1); }} className={secondaryBtnStyles}>Back</button>
              <button type="button" onClick={handleNext} className={primaryBtnStyles}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-[20px] flex flex-col items-center">
            <label className="block text-[18px] font-bold text-white w-full text-left">Profile Picture</label>
            <Avatar className="w-28 h-28 border border-white/10 bg-black/50">
              <AvatarImage src={profilePic || undefined} />
              <AvatarFallback className="text-3xl text-[#666] bg-transparent">{formData.firstName[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="w-full">
              <label htmlFor="picture" className={`cursor-pointer flex items-center justify-center ${secondaryBtnStyles}`}>
                <Upload className="w-5 h-5 mr-2" />
                Upload Image
                <input id="picture" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>

            <div className="flex gap-[12px] mt-[10px] w-full">
              <button type="button" onClick={() => { setErrors({}); setStep(2); }} className={secondaryBtnStyles}>Back</button>
              <button type="button" onClick={handleSignupComplete} disabled={submitting} className={primaryBtnStyles}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Complete Signup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.9 5.1 29.7 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l6-6C34.9 6.1 29.7 4 24 4 16 4 9.1 8.5 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.6 0 10.7-2.1 14.5-5.7l-6.7-5.5C29.6 34.7 27 36 24 36c-5.3 0-9.6-3.4-11.2-8.1l-6.6 5.1C9.1 39.5 16 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l6.7 5.5C41.9 35.9 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
