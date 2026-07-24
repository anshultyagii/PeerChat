import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { performGoogleSignIn, formatAuthError } from '@/lib/utils/auth';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

const inputStyles = "w-full bg-black/30 border text-white rounded-[14px] px-[18px] py-[16px] text-[16px] outline-none focus:bg-white/5 focus:shadow-[inset_2px_0px_15px_-5px_rgba(255,255,255,0.3)] transition-all placeholder:text-[#666]";
const inputOk = "border-white/5 focus:border-white/20";
const inputErr = "border-[#ff4d4d] focus:border-[#ff4d4d]";
const primaryBtnStyles = "w-full bg-[#ffffff] text-[#000000] font-semibold p-[16px] rounded-[14px] text-[16px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryBtnStyles = "w-full bg-white/10 text-white p-[16px] rounded-[14px] text-[16px] hover:bg-white/20 transition-all cursor-pointer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">{message}</p>;
}

export default function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setErrors({ email: "Enter your email address." });
    if (!EMAIL_REGEX.test(trimmedEmail)) return setErrors({ email: "Enter a valid email address." });
    if (!password) return setErrors({ password: "Enter your password." });

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch (err: any) {
      console.error("Login error:", err);
      const message = formatAuthError(err);
      toast.error("Sign-in failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrors({});
    setGoogleLoading(true);
    try {
      await performGoogleSignIn();
    } catch (err: any) {
      console.error("Google login error:", err);
      const message = formatAuthError(err);
      setErrors({ form: message });
      toast.error("Google sign-in failed", { description: message });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-[16px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <FieldError message={errors.form} />

      <div>
        <div className="relative">
          <Mail className="absolute left-[18px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, form: undefined })); }}
            className={`${inputStyles} pl-[50px] ${errors.email ? inputErr : inputOk}`}
          />
        </div>
        <FieldError message={errors.email} />
      </div>

      <div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, form: undefined })); }}
            className={`${inputStyles} ${errors.password ? inputErr : inputOk}`}
          />
          <button
            type="button"
            className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <FieldError message={errors.password} />
      </div>

      <div className="flex justify-end -mt-[4px]">
        <button type="button" onClick={onForgotPassword} className="text-[13px] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer">
          Forgot password?
        </button>
      </div>

      <button type="submit" disabled={submitting} className={`${primaryBtnStyles} mt-[8px]`}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Sign In"}
      </button>

      <div className="flex items-center gap-3 py-[6px]">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[#666] text-[12px]">OR</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button type="button" onClick={handleGoogleLogin} disabled={googleLoading} className={`${secondaryBtnStyles} flex items-center justify-center gap-3 disabled:opacity-60`}>
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>
    </form>
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
