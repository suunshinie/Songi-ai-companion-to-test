import React, { useState } from 'react';
import { AuthAccountSummary } from '../types/shongi';
import {
  refreshAuthUser,
  resendVerificationEmail,
  sendPasswordReset,
  signInAnonymouslyPrivate,
  signInWithEmail,
  signInWithGooglePopup,
  signOutSanctuary,
  signUpWithEmailAndVerify,
  upgradeAnonymousWithEmail,
  upgradeAnonymousWithGoogle,
} from '../firebase';
import { mapFirebaseAuthError } from '../utils/shongiLogic';

interface AuthModalProps {
  isOpen: boolean;
  authSummary: AuthAccountSummary | null;
  onClose: () => void;
  onAuthSuccess?: () => void;
  onSignOutComplete?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  authSummary,
  onClose,
  onAuthSuccess,
  onSignOutComplete,
}) => {
  const [emailTab, setEmailTab] = useState<'signin' | 'signup'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLinkingAnonymous = Boolean(authSummary?.isAnonymous);

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setErrorMessage(null);
    setInfoMessage(null);
    setBusyAction(label);
    try {
      await fn();
    } catch (err) {
      setErrorMessage(mapFirebaseAuthError(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAnonymousSignIn = () =>
    runAction('anonymous', async () => {
      await signInAnonymouslyPrivate();
      onAuthSuccess?.();
      onClose();
    });

  const handleGoogleSignIn = () =>
    runAction('google', async () => {
      if (isLinkingAnonymous) {
        await upgradeAnonymousWithGoogle();
      } else {
        await signInWithGooglePopup();
      }
      onAuthSuccess?.();
      onClose();
    });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    void runAction('email', async () => {
      if (emailTab === 'signup') {
        if (isLinkingAnonymous) {
          await upgradeAnonymousWithEmail(displayName, email, password);
        } else {
          await signUpWithEmailAndVerify(displayName, email, password);
        }
        setInfoMessage(
          `Verification link sent to ${email.trim()}. Please check your inbox and verify before syncing across devices.`
        );
      } else {
        const user = await signInWithEmail(email, password);
        if (user.emailVerified) {
          onAuthSuccess?.();
          onClose();
        } else {
          setInfoMessage(
            'Signed in! Please check your inbox and verify your email address to unlock cloud sync.'
          );
        }
      }
    });
  };

  const handleResendVerification = () =>
    runAction('resend', async () => {
      await resendVerificationEmail();
      setInfoMessage('A fresh verification email has been sent to your inbox.');
    });

  const handleRefreshVerification = () =>
    runAction('refresh', async () => {
      const updated = await refreshAuthUser();
      if (updated?.emailVerified) {
        setInfoMessage('Email verified! Your sanctuary cloud sync is now active.');
        onAuthSuccess?.();
        window.setTimeout(() => onClose(), 800);
      } else {
        setErrorMessage(
          'Your email is not marked as verified yet. Click the link in your inbox, then tap Check Status again.'
        );
      }
    });

  const handleForgotPassword = () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address above first so we can send a reset link.');
      return;
    }
    void runAction('reset', async () => {
      await sendPasswordReset(email);
      setInfoMessage(`Password reset instructions sent to ${email.trim()}.`);
    });
  };

  const handleSignOut = () =>
    runAction('signout', async () => {
      await signOutSanctuary();
      onSignOutComplete?.();
      onClose();
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      data-testid="auth-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2A2A28]/50 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-[#FAF7F2] border border-[#E3D9CD] shadow-2xl p-6 sm:p-8 my-auto space-y-5 text-[#2A2A28]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F6F63] px-2.5 py-1 rounded-full bg-[#F1EAE1] border border-[#E3D9CD]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2F6F63]" />
              <span>Private Sanctuary Access</span>
            </span>
            <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-bold mt-2">
              {authSummary?.needsEmailVerification
                ? 'Verify your email address'
                : authSummary && !authSummary.isAnonymous
                ? 'Your Sanctuary Account'
                : authSummary?.isAnonymous
                ? 'Private Anonymous Session'
                : 'Enter SHONGI on your terms'}
            </h2>
            <p className="text-xs sm:text-sm text-[#6B6B66] mt-1 bangla-text">
              বেনামে থাকুন অথবা Google ও ভেরিফাইড ইমেইলে সেভ রাখুন।
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="w-9 h-9 rounded-full bg-white border border-[#E3D9CD] hover:border-[#2F6F63] flex items-center justify-center text-[#6B6B66] hover:text-[#2A2A28] transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div
            data-testid="auth-error-banner"
            className="p-3.5 rounded-xl bg-[#C97B5A]/15 border border-[#C97B5A]/40 text-xs sm:text-[13px] text-[#2A2A28] leading-relaxed"
          >
            {errorMessage}
          </div>
        )}
        {infoMessage && (
          <div
            data-testid="auth-info-banner"
            className="p-3.5 rounded-xl bg-[#2F6F63]/12 border border-[#2F6F63]/35 text-xs sm:text-[13px] text-[#2F6F63] font-medium leading-relaxed"
          >
            {infoMessage}
          </div>
        )}

        {/* Case 1: Unverified Email User Gate */}
        {authSummary?.needsEmailVerification ? (
          <div className="space-y-4 bg-white rounded-2xl border border-[#E3D9CD] p-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-[#6B6B66]">Signed in with email</p>
                <p className="text-sm font-bold text-[#2A2A28]">{authSummary.email}</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#C97B5A]/15 text-[#C97B5A]">
                Verification Pending
              </span>
            </div>
            <p className="text-xs text-[#6B6B66] leading-relaxed">
              We sent a verification link to your inbox. Verify your email so your approved memories
              and encrypted journal can sync safely to your private cloud space.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleRefreshVerification}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#2F6F63] text-white text-xs sm:text-sm font-semibold hover:bg-[#24594f] disabled:opacity-60 transition-colors"
              >
                {busyAction === 'refresh' ? 'Checking...' : "I've Verified • Check Status"}
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleResendVerification}
                className="py-2.5 px-4 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] hover:border-[#2F6F63] text-xs sm:text-sm font-semibold text-[#2A2A28] disabled:opacity-60 transition-colors"
              >
                {busyAction === 'resend' ? 'Sending...' : 'Resend Link'}
              </button>
            </div>
            <div className="pt-2 border-t border-[#EFE7DC] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[#C97B5A] font-semibold hover:underline"
              >
                Sign out / Switch login option
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-[#6B6B66] hover:text-[#2A2A28] font-medium"
              >
                Continue locally for now
              </button>
            </div>
          </div>
        ) : authSummary && !authSummary.isAnonymous ? (
          /* Case 2: Verified Google / Verified Email Account View */
          <div className="space-y-4 bg-white rounded-2xl border border-[#E3D9CD] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#2A2A28]">{authSummary.displayName}</p>
                <p className="text-xs text-[#6B6B66]">{authSummary.email}</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#2F6F63]/15 text-[#2F6F63]">
                {authSummary.authMethod === 'google' ? 'Google Verified ✓' : 'Email Verified ✓'}
              </span>
            </div>
            <p className="text-xs text-[#6B6B66] leading-relaxed">
              Your approved companion memories and personal journal entries are synced privately to
              your verified Firebase Sanctuary account.
            </p>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#EFE7DC]">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl border border-[#E3D9CD] text-xs font-semibold text-[#C97B5A] hover:bg-[#FAF7F2] transition-colors"
              >
                {busyAction === 'signout' ? 'Signing out...' : 'Sign out'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-[#2F6F63] text-white text-xs font-semibold hover:bg-[#24594f]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Case 3: Signed Out OR Anonymous Guest (with option to upgrade) */
          <div className="space-y-4">
            {authSummary?.isAnonymous ? (
              <div className="p-4 rounded-2xl bg-white border border-[#2F6F63]/40 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#2F6F63] block">
                    Active Anonymous Session
                  </span>
                  <span className="text-xs text-[#6B6B66]">
                    No email attached. Link Google or Email below anytime to keep your sanctuary
                    across devices.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs font-semibold text-[#C97B5A] hover:underline"
                >
                  Reset / Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="auth-anonymous-btn"
                disabled={busyAction !== null}
                onClick={handleAnonymousSignIn}
                className="w-full py-3 px-4 rounded-2xl bg-[#F1EAE1] border border-[#E3D9CD] hover:border-[#2F6F63] text-left flex items-center justify-between gap-3 transition-all group cursor-pointer"
              >
                <div>
                  <span className="text-sm font-bold text-[#2A2A28] block">
                    {busyAction === 'anonymous'
                      ? 'Creating anonymous session...'
                      : 'Continue Anonymously (No Email Needed)'}
                  </span>
                  <span className="text-xs text-[#6B6B66] bangla-text">
                    বেনামে নিরাপদ সেশন • Start completely privately, upgrade anytime later
                  </span>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#2F6F63] text-white shrink-0">
                  Start Private
                </span>
              </button>
            )}

            {/* Google Sign-In / Link */}
            <button
              type="button"
              data-testid="auth-google-btn"
              disabled={busyAction !== null}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-2xl bg-white border border-[#E3D9CD] hover:border-[#2F6F63] flex items-center justify-center gap-3 text-sm font-semibold text-[#2A2A28] shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>
                {busyAction === 'google'
                  ? 'Connecting with Google...'
                  : isLinkingAnonymous
                  ? 'Link & Save with Google'
                  : 'Continue with Google'}
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-[11px] font-semibold text-[#8A8A85]">
              <div className="h-[1px] bg-[#E3D9CD] flex-1" />
              <span>OR USE EMAIL WITH VERIFICATION</span>
              <div className="h-[1px] bg-[#E3D9CD] flex-1" />
            </div>

            {/* Email Sign-In / Sign-Up Tabs */}
            <div className="bg-white rounded-2xl border border-[#E3D9CD] p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD]">
                <button
                  type="button"
                  onClick={() => {
                    setEmailTab('signup');
                    setErrorMessage(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                    emailTab === 'signup'
                      ? 'bg-[#2F6F63] text-white'
                      : 'text-[#6B6B66] hover:text-[#2A2A28]'
                  }`}
                >
                  {isLinkingAnonymous ? 'Link Email & Verify' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailTab('signin');
                    setErrorMessage(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                    emailTab === 'signin'
                      ? 'bg-[#2F6F63] text-white'
                      : 'text-[#6B6B66] hover:text-[#2A2A28]'
                  }`}
                >
                  Sign In
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {emailTab === 'signup' && (
                  <div>
                    <label htmlFor="auth-display-name" className="block text-xs font-semibold mb-1">
                      Preferred Name or Nickname
                    </label>
                    <input
                      id="auth-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Nusrat / Padma Guest"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] focus:border-[#2F6F63] outline-none text-sm"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] focus:border-[#2F6F63] outline-none text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="auth-password" className="text-xs font-semibold">
                      Password
                    </label>
                    {emailTab === 'signin' && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[11px] font-semibold text-[#2F6F63] hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3.5 py-2.5 pr-14 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] focus:border-[#2F6F63] outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#6B6B66] hover:text-[#2A2A28]"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="auth-email-submit-btn"
                  disabled={busyAction !== null}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2F6F63] text-white text-sm font-semibold hover:bg-[#24594f] disabled:opacity-60 transition-colors"
                >
                  {busyAction === 'email'
                    ? 'Please wait...'
                    : emailTab === 'signup'
                    ? 'Create Account & Send Verification Link'
                    : 'Sign In with Email'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
