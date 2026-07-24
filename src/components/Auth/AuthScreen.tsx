import { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';
import { X } from 'lucide-react';

type View = 'signup' | 'signin' | 'forgot';

export default function AuthScreen({ resetOobCode }: { resetOobCode?: string | null }) {
  const [view, setView] = useState<View>('signup');

  const title =
    view === 'signup' ? 'Create an account' :
    view === 'signin' ? 'Welcome back' :
    'Reset your password';

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 overflow-hidden text-white font-sans">

      {/* Modal Container */}
      <div className="relative z-10 bg-[#1e1e1e]/40 backdrop-blur-[24px] border border-white/10 rounded-[28px] p-[40px] w-full max-w-[480px] max-h-[95vh] overflow-y-auto shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* Close Button */}
        <button className="absolute top-5 right-5 bg-white/10 border-none text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {resetOobCode ? (
          <>
            <h2 className="text-[26px] font-semibold mb-[28px]">Reset your password</h2>
            <ResetPasswordForm oobCode={resetOobCode} onDone={() => { window.location.href = '/'; }} />
          </>
        ) : (
          <>
            {view !== 'forgot' && (
              <div className="bg-black/50 rounded-[30px] flex relative w-max p-1.5 mb-[30px]">
                <button
                  onClick={() => setView('signup')}
                  className={`relative z-10 px-7 py-2.5 rounded-[20px] text-[15px] font-medium transition-colors ${view === 'signup' ? 'text-white bg-white/10' : 'text-[#888] bg-transparent'}`}
                >
                  Sign up
                </button>
                <button
                  onClick={() => setView('signin')}
                  className={`relative z-10 px-7 py-2.5 rounded-[20px] text-[15px] font-medium transition-colors ${view === 'signin' ? 'text-white bg-white/10' : 'text-[#888] bg-transparent'}`}
                >
                  Sign in
                </button>
              </div>
            )}

            <h2 className="text-[26px] font-semibold mb-[28px]">{title}</h2>

            {view === 'signup' && <SignupForm />}
            {view === 'signin' && <LoginForm onForgotPassword={() => setView('forgot')} />}
            {view === 'forgot' && <ForgotPasswordForm onBack={() => setView('signin')} />}
          </>
        )}
      </div>
    </div>
  );
}