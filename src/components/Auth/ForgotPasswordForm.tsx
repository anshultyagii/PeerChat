import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, actionCodeSettings } from '@/lib/firebase';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

const inputStyles = "w-full bg-black/30 border text-white rounded-[14px] px-[18px] py-[16px] text-[16px] outline-none focus:bg-white/5 focus:shadow-[inset_2px_0px_15px_-5px_rgba(255,255,255,0.3)] transition-all placeholder:text-[#666]";
const inputOk = "border-white/5 focus:border-white/20";
const inputErr = "border-[#ff4d4d] focus:border-[#ff4d4d]";
const primaryBtnStyles = "w-full bg-[#ffffff] text-[#000000] font-semibold p-[16px] rounded-[14px] text-[16px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">{message}</p>;
}

export default function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError("Enter a valid email address.");
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSent(true);
    } catch (err: any) {
      setError("Couldn't send the reset link. Check the email and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 py-[20px]">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-white text-[16px] font-medium">Check your inbox</p>
        <p className="text-[#a3a3a3] text-[14px] leading-relaxed">
          We sent a password reset link to <span className="text-white">{email}</span>. Open it on this device to reset your password right here in the app.
        </p>
        <button type="button" onClick={onBack} className="text-[13px] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer mt-[8px] flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-[16px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-[#a3a3a3] text-[14px] -mt-[8px] mb-[4px]">
        Enter the email tied to your account and we'll send you a link to reset your password.
      </p>

      <div>
        <div className="relative">
          <Mail className="absolute left-[18px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            className={`${inputStyles} pl-[50px] ${error ? inputErr : inputOk}`}
          />
        </div>
        <FieldError message={error} />
      </div>

      <button type="submit" disabled={submitting} className={primaryBtnStyles}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send recovery link"}
      </button>

      <button type="button" onClick={onBack} className="text-[13px] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer flex items-center gap-1 mt-[4px]">
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </button>
    </form>
  );
}