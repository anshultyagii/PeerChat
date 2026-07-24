import { useEffect, useState } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const inputStyles = "w-full bg-black/30 border text-white rounded-[14px] px-[18px] py-[16px] text-[16px] outline-none focus:bg-white/5 focus:shadow-[inset_2px_0px_15px_-5px_rgba(255,255,255,0.3)] transition-all placeholder:text-[#666]";
const inputOk = "border-white/5 focus:border-white/20";
const inputErr = "border-[#ff4d4d] focus:border-[#ff4d4d]";
const primaryBtnStyles = "w-full bg-[#ffffff] text-[#000000] font-semibold p-[16px] rounded-[14px] text-[16px] hover:bg-[#e0e0e0] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[#ff4d4d] text-[12px] mt-[6px] ml-[4px]">{message}</p>;
}

/**
 * Rendered when the user opens the emailed password-reset link. Firebase
 * appends ?mode=resetPassword&oobCode=... to actionCodeSettings.url — the
 * parent (App.tsx) detects that and mounts this component with the code.
 */
export default function ResetPasswordForm({ oobCode, onDone }: { oobCode: string; onDone: () => void }) {
  const [verifying, setVerifying] = useState(true);
  const [codeValid, setCodeValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setAccountEmail(email);
        setCodeValid(true);
      })
      .catch(() => setCodeValid(false))
      .finally(() => setVerifying(false));
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!PASSWORD_REGEX.test(password)) next.password = "8+ chars with at least 1 letter and 1 number.";
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (Object.keys(next).length > 0) return setErrors(next);

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch {
      setErrors({ password: "Couldn't reset your password. The link may have expired." });
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-[40px] text-[#a3a3a3]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>Verifying link...</p>
      </div>
    );
  }

  if (!codeValid) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-[20px]">
        <AlertTriangle className="w-12 h-12 text-[#ff4d4d]" />
        <p className="text-white text-[16px] font-medium">This link is invalid or has expired</p>
        <button type="button" onClick={onDone} className={primaryBtnStyles}>Back to sign in</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-[20px]">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className="text-white text-[16px] font-medium">Password updated</p>
        <p className="text-[#a3a3a3] text-[14px]">You can now sign in with your new password.</p>
        <button type="button" onClick={onDone} className={primaryBtnStyles}>Back to sign in</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-[16px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-[#a3a3a3] text-[14px] -mt-[8px] mb-[4px]">
        Set a new password for <span className="text-white">{accountEmail}</span>.
      </p>

      <div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="New password*"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
            className={`${inputStyles} ${errors.password ? inputErr : inputOk}`}
          />
          <button type="button" className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <FieldError message={errors.password} />
        {!errors.password && <small className="block text-[#666] text-[12px] mt-[6px] ml-[4px]">Alphanumeric & underscore only, min 8 chars.</small>}
      </div>

      <div>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Confirm new password*"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
          className={`${inputStyles} ${errors.confirmPassword ? inputErr : inputOk}`}
        />
        <FieldError message={errors.confirmPassword} />
      </div>

      <button type="submit" disabled={submitting} className={`${primaryBtnStyles} mt-[10px]`}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Reset password"}
      </button>
    </form>
  );
}