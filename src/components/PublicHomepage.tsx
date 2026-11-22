import React, { useState } from 'react';
import { AppScreen, AuthAccountSummary, Language } from '../types/shongi';
import { SHONGI_IMAGES } from '../data/seedData';
import { ResilientImage } from './ResilientImage';

interface PublicHomepageProps {
  language: Language;
  authSummary: AuthAccountSummary | null;
  onToggleLanguage: () => void;
  onEnterWorkspace: (screen: AppScreen, initialThought?: string) => void;
  onOpenAuth: () => void;
  onContinueAnonymously: () => void;
  onSignOut: () => void;
}

type MoodId = 'overwhelmed' | 'focus' | 'talk';

interface MoodOption {
  id: MoodId;
  en: string;
  bn: string;
  responseEn: string;
  responseBn: string;
  accentWarm?: boolean;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    id: 'overwhelmed',
    en: 'A bit overwhelmed',
    bn: 'একটু ক্লান্ত',
    responseEn: 'We can slow things down together. No pressure to explain everything.',
    responseBn: 'একটু শান্ত হয়ে নিতে পারি, কোনো তাড়া নেই।',
  },
  {
    id: 'focus',
    en: 'Can’t focus',
    bn: 'মন বসছে না',
    responseEn: 'That’s completely okay. Take a deep breath; let’s start with one small thought.',
    responseBn: 'মন বসছে না? কোনো সমস্যা নেই, ছোট একটা ভাবনাই যথেষ্ট।',
  },
  {
    id: 'talk',
    en: 'Just need to talk',
    bn: 'কিছু বলতে চাই',
    responseEn: 'I’m here and listening. Speak or type in Bangla, Banglish, or English.',
    responseBn: 'আমি শুনছি। মনের কথা খুলে বলো—বাংলা বা ইংরেজিতে।',
    accentWarm: true,
  },
];

export const PublicHomepage: React.FC<PublicHomepageProps> = ({
  language,
  authSummary,
  onToggleLanguage,
  onEnterWorkspace,
  onOpenAuth,
  onContinueAnonymously,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredMood, setHoveredMood] = useState<MoodId | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [thoughtInput, setThoughtInput] = useState('');

  const activeMoodId = hoveredMood ?? selectedMood;
  const activeMood = MOOD_OPTIONS.find((m) => m.id === activeMoodId) ?? null;

  const handleSendThought = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = thoughtInput.trim();
    const fallbackMoodText = selectedMood
      ? MOOD_OPTIONS.find((m) => m.id === selectedMood)?.en
      : undefined;
    onEnterWorkspace('ai-companion', trimmed || fallbackMoodText);
  };

  return (
    <div className="bg-[#FAF7F2] text-[#2A2A28] antialiased selection:bg-[#2F6F63] selection:text-white min-h-screen flex flex-col font-sans overflow-x-hidden">
      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E3D9CD] transition-all duration-200">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo / Wordmark */}
          <a
            href="#hero-action"
            className="flex items-center gap-3 group focus-visible:rounded-lg shrink-0"
            aria-label="SHONGI Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#2F6F63] text-white flex items-center justify-center font-bold text-lg shadow-sm transition-transform group-hover:scale-105">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10Z" />
                <path d="M9 12h6" />
                <path d="M12 9v6" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-xl text-[#2A2A28] whitespace-nowrap">
                  SHONGI
                </span>
                <span className="bangla-text text-sm font-semibold text-[#2F6F63] tracking-normal">
                  সঙ্গী
                </span>
              </div>
              <span className="text-[11px] text-[#6B6B66] -mt-1 hidden sm:inline tracking-wide">
                AI is the bridge.
              </span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav
            className="hidden md:flex items-center gap-7 text-[15px] font-medium text-[#6B6B66]"
            aria-label="Primary Navigation"
          >
            <a
              href="#how-it-helps"
              className="hover:text-[#2A2A28] transition-colors py-1 whitespace-nowrap"
            >
              {language === 'bn' ? 'কীভাবে কাজ করে' : 'How it helps'}
            </a>
            <button
              type="button"
              onClick={() => onEnterWorkspace('peer-pilot')}
              className="hover:text-[#2A2A28] transition-colors py-1 whitespace-nowrap"
            >
              {language === 'bn' ? 'সহমর্মী খুঁজুন' : 'Find People'}
            </button>
            <button
              type="button"
              onClick={() => onEnterWorkspace('community-feed')}
              className="hover:text-[#2A2A28] transition-colors py-1 whitespace-nowrap"
            >
              {language === 'bn' ? 'কমিউনিটি ফিড' : 'Community'}
            </button>
            <a
              href="#privacy-safety"
              className="hover:text-[#2A2A28] transition-colors py-1 whitespace-nowrap"
            >
              {language === 'bn' ? 'গোপনীয়তা ও সুরক্ষা' : 'Privacy & safety'}
            </a>
          </nav>

          {/* Desktop & Mobile Action Area */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleLanguage}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-[#E3D9CD] text-[#6B6B66] hover:text-[#2A2A28] hover:border-[#2F6F63] transition-colors flex items-center gap-1.5 whitespace-nowrap"
              aria-label="Change language"
            >
              <span className={language === 'en' ? 'text-[#2F6F63] font-bold' : ''}>EN</span>
              <span className="text-[#8A8A85]">|</span>
              <span className={`bangla-text ${language === 'bn' ? 'text-[#2F6F63] font-bold' : ''}`}>
                বাংলা
              </span>
            </button>

            {authSummary ? (
              <>
                <button
                  type="button"
                  data-testid="home-profile-btn"
                  onClick={() => onEnterWorkspace('privacy-memory-hub')}
                  className="hidden sm:inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-[#2A2A28] text-[13px] font-medium transition-all whitespace-nowrap"
                  title="Open your Profile & Privacy Settings"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      authSummary.needsEmailVerification ? 'bg-[#C97B5A]' : 'bg-[#7A9A7B]'
                    }`}
                  />
                  <span className="max-w-[130px] truncate">
                    {authSummary.needsEmailVerification ? 'Verify Email' : authSummary.displayName}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="home-workspace-btn"
                  onClick={() => onEnterWorkspace('ai-companion')}
                  className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#2F6F63] text-white text-[14px] font-semibold hover:bg-[#24594f] shadow-sm transition-all whitespace-nowrap"
                >
                  {language === 'bn' ? 'ওয়ার্কস্পেসে যান' : 'Open Workspace'}
                </button>
                <button
                  type="button"
                  data-testid="home-signout-btn"
                  onClick={onSignOut}
                  className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 rounded-xl border border-[#C97B5A]/45 bg-[#C97B5A]/10 text-[#9a442d] text-[13px] font-semibold hover:bg-[#C97B5A]/20 transition-all whitespace-nowrap"
                >
                  {language === 'bn' ? 'সাইন আউট' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="home-auth-btn"
                  onClick={onOpenAuth}
                  className="hidden sm:inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-[#2A2A28] text-[14px] font-semibold transition-all whitespace-nowrap"
                >
                  <span>{language === 'bn' ? 'সাইন ইন' : 'Sign in'}</span>
                </button>
                <button
                  type="button"
                  data-testid="home-start-privately-btn"
                  onClick={onOpenAuth}
                  className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#2F6F63] text-white text-[15px] font-semibold hover:bg-[#24594f] shadow-sm transition-all hover:-translate-y-0.5 whitespace-nowrap"
                >
                  {language === 'bn' ? 'নিরাপদে শুরু করুন' : 'Start privately'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-[#2A2A28] hover:bg-[#F1EAE1]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E3D9CD] bg-[#FAF7F2] px-6 py-5">
            <nav className="flex flex-col gap-4 text-base font-medium text-[#2A2A28]">
              <a
                href="#how-it-helps"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-[#2F6F63] transition-colors"
              >
                How it helps
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterWorkspace('peer-pilot');
                }}
                className="py-1 text-left hover:text-[#2F6F63] transition-colors"
              >
                Find People
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterWorkspace('community-feed');
                }}
                className="py-1 text-left hover:text-[#2F6F63] transition-colors"
              >
                Community Feed
              </button>
              <a
                href="#privacy-safety"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-[#2F6F63] transition-colors"
              >
                Privacy &amp; safety
              </a>
              <div className="pt-3 border-t border-[#E3D9CD] flex flex-col gap-2">
                {authSummary ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onEnterWorkspace('ai-companion');
                      }}
                      className="w-full text-center py-3 rounded-xl bg-[#2F6F63] text-white font-semibold"
                    >
                      Open Workspace ({authSummary.displayName})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full text-center py-2.5 rounded-xl bg-[#C97B5A]/10 border border-[#C97B5A]/45 text-[#9a442d] font-semibold"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full text-center py-2.5 rounded-xl bg-white border border-[#E3D9CD] text-[#2A2A28] font-semibold"
                    >
                      Sign in (Anonymous / Google / Email)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full text-center py-3 rounded-xl bg-[#2F6F63] text-white font-semibold"
                    >
                      Start privately
                    </button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section
          className="relative pt-10 pb-20 md:pt-16 md:pb-28 overflow-hidden"
          id="hero-action"
        >
          <div className="max-w-[1120px] mx-auto px-6 py-6 md:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Left Column: Copy & Actions */}
              <div className="lg:col-span-6 flex flex-col items-start text-left">
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#F1EAE1] border border-[#E3D9CD] text-[13px] font-medium text-[#2F6F63] mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#2F6F63]" />
                  <span>A calm space for everyday life</span>
                  <span className="text-[#E3D9CD]">•</span>
                  <span className="bangla-text text-[#6B6B66]">শান্ত ও নিরাপদ</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[48px] font-semibold text-[#2A2A28] tracking-tight leading-[1.18] mb-3 [text-wrap:balance]">
                  {language === 'bn'
                    ? 'সবকিছু একা একা সামলে নেওয়ার চাপ নেই।'
                    : 'You don’t have to figure everything out alone.'}
                </h1>

                <p className="bangla-greeting text-xl md:text-2xl font-medium text-[#C97B5A] mb-6 tracking-normal">
                  তুমি একা নও।
                </p>

                <p className="text-base sm:text-lg md:text-[18px] font-normal text-[#6B6B66] leading-[1.6] max-w-[520px] mb-8">
                  {language === 'bn'
                    ? 'সঙ্গী (SHONGI) একটি শান্ত ও নিরাপদ জায়গা—যেখানে আপনি মনের কথা খুলে বলতে পারবেন, ব্যক্তিগত ডায়েরিতে লিখতে পারবেন এবং চাইলে সহমর্মী মানুষের সাথে যুক্ত হতে পারবেন।'
                    : 'SHONGI is a calm space to talk things through, reflect privately, and—when you’re ready—connect with people who understand.'}
                </p>

                {authSummary ? (
                  <div className="w-full mb-6 space-y-4">
                    <div className="p-4 rounded-2xl bg-white border border-[#E3D9CD] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#2F6F63] text-white flex items-center justify-center text-xs font-semibold">
                          {authSummary.isAnonymous
                            ? 'AN'
                            : authSummary.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#2A2A28]">
                            Welcome back, {authSummary.displayName}
                          </p>
                          <p className="text-xs text-[#6B6B66]">
                            {authSummary.isAnonymous
                              ? 'Anonymous private session active'
                              : authSummary.needsEmailVerification
                              ? 'Email verification pending'
                              : `Signed in via ${authSummary.authMethod === 'google' ? 'Google' : 'Verified Email'}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="hero-signout-btn"
                        onClick={onSignOut}
                        className="px-3.5 py-2 rounded-xl border border-[#C97B5A]/45 bg-[#C97B5A]/10 text-[#9a442d] text-xs font-semibold hover:bg-[#C97B5A]/20 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onEnterWorkspace('ai-companion')}
                        className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[#2F6F63] text-white text-sm sm:text-base font-semibold hover:bg-[#24594f] shadow-[0_8px_30px_rgba(42,42,40,0.06)] transition-all hover:-translate-y-0.5 whitespace-nowrap"
                      >
                        Talk to SHONGI
                      </button>
                      <button
                        type="button"
                        onClick={() => onEnterWorkspace('peer-pilot')}
                        className="inline-flex items-center justify-center px-5 py-3.5 rounded-xl bg-white border border-[#E3D9CD] text-[#2A2A28] text-sm sm:text-base font-medium hover:border-[#2F6F63] transition-all whitespace-nowrap"
                      >
                        Find Your People
                      </button>
                      <button
                        type="button"
                        onClick={() => onEnterWorkspace('community-feed')}
                        className="inline-flex items-center justify-center px-5 py-3.5 rounded-xl bg-white border border-[#E3D9CD] text-[#2A2A28] text-sm sm:text-base font-medium hover:border-[#2F6F63] transition-all whitespace-nowrap"
                      >
                        Your Space Feed
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-6">
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-[#2F6F63] text-white text-base font-semibold hover:bg-[#24594f] shadow-[0_8px_30px_rgba(42,42,40,0.06)] transition-all hover:-translate-y-0.5 whitespace-nowrap"
                      >
                        Start privately
                      </button>
                      <a
                        href="#how-it-helps"
                        className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white border border-[#E3D9CD] text-[#2A2A28] text-base font-medium hover:border-[#2F6F63] hover:bg-[#F1EAE1]/40 transition-all hover:-translate-y-0.5 whitespace-nowrap"
                      >
                        See how it helps
                      </a>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-[#6B6B66]">
                        <svg
                          className="w-4 h-4 text-[#7A9A7B] flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>Private by default. You choose what to share.</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          data-testid="hero-anon-btn"
                          onClick={onContinueAnonymously}
                          className="px-3 py-1.5 rounded-lg bg-[#F1EAE1] border border-[#E3D9CD] hover:border-[#2F6F63] text-[#2F6F63] font-semibold transition-colors"
                        >
                          Continue anonymously (No email)
                        </button>
                        <button
                          type="button"
                          data-testid="hero-signin-btn"
                          onClick={onOpenAuth}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-[#2A2A28] font-medium transition-colors"
                        >
                          Google / Email login &amp; verification →
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Prominent Focal Photograph & Floating Companion Card */}
              <div className="lg:col-span-6 relative w-full">
                <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-[#E3D9CD] shadow-2xl bg-[#F1EAE1] group">
                  <ResilientImage
                    src={SHONGI_IMAGES.heroPortrait}
                    alt="Young South Asian adult sitting peacefully in a warm, sunlit Dhaka space, holding a smartphone naturally with calm reflection"
                    fallbackLabel="Warm Dhaka Sanctuary"
                    className="w-full h-[380px] sm:h-[460px] lg:h-[500px] object-cover object-[75%_20%] transform transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A28]/30 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Floating Companion Interactive Card */}
                <div className="mt-4 lg:mt-0 lg:absolute lg:-bottom-8 lg:-left-8 w-full lg:max-w-[310px] sm:max-w-[350px] z-10 mx-auto">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E3D9CD] p-4 shadow-2xl transition-all duration-300 hover:border-[#2F6F63]/40">
                    <div className="flex items-center justify-between pb-3 border-b border-[#EFE7DC] mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#7A9A7B]" />
                        <span className="text-xs font-semibold text-[#2A2A28] tracking-tight">
                          SHONGI Companion
                        </span>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#E3D9CD] text-[#6B6B66]">
                        Private Check-in
                      </span>
                    </div>

                    <div className="mb-2.5">
                      <h3 className="bangla-greeting text-xl font-medium text-[#2A2A28] mb-0.5">
                        কেমন আছো?
                      </h3>
                      <p className="text-xs font-normal text-[#6B6B66] leading-[1.6]">
                        You can start with just a few words.
                      </p>
                    </div>

                    <div className="space-y-2 mb-3">
                      {MOOD_OPTIONS.map((mood) => {
                        const isSelected = selectedMood === mood.id;
                        const activeColor = mood.accentWarm ? '#C97B5A' : '#2F6F63';
                        return (
                          <button
                            key={mood.id}
                            type="button"
                            onMouseEnter={() => setHoveredMood(mood.id)}
                            onMouseLeave={() => setHoveredMood(null)}
                            onClick={() =>
                              setSelectedMood((prev) => (prev === mood.id ? null : mood.id))
                            }
                            style={isSelected ? { borderColor: activeColor } : undefined}
                            className={`w-full text-left px-3 py-2 rounded-xl border transition-all duration-200 text-xs font-medium text-[#2A2A28] flex items-center justify-between group cursor-pointer ${
                              isSelected
                                ? 'bg-white shadow-sm'
                                : 'bg-[#FAF7F2] border-[#E3D9CD] hover:border-[#2F6F63] hover:bg-[#F1EAE1]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                style={isSelected ? { backgroundColor: activeColor } : undefined}
                                className={`w-2 h-2 rounded-full transition-all ${
                                  isSelected
                                    ? 'scale-125'
                                    : 'bg-[#E3D9CD] group-hover:bg-[#2F6F63]'
                                }`}
                              />
                              <span>{mood.en}</span>
                            </div>
                            <span
                              className={`bangla-text text-[11px] transition-colors ${
                                isSelected
                                  ? mood.accentWarm
                                    ? 'text-[#C97B5A] font-semibold'
                                    : 'text-[#2F6F63] font-semibold'
                                  : 'text-[#6B6B66] group-hover:text-[#2F6F63]'
                              }`}
                            >
                              {mood.bn}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Gentle Context Reflection Preview Banner */}
                    <div className="relative flex flex-col gap-2 mb-3">
                      <div className="rounded-xl bg-[#2F6F63]/10 border border-[#2F6F63]/30 p-2.5 transition-all duration-300 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2F6F63] mt-1.5 flex-shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[11px] text-[#2F6F63] font-medium leading-relaxed">
                            {activeMood
                              ? activeMood.responseEn
                              : 'Select or hover over how you feel for a gentle reflection.'}
                          </p>
                          {activeMood && (
                            <p className="bangla-text text-[11px] text-[#C97B5A] leading-normal">
                              {activeMood.responseBn}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Input Bar Container (Text Mode + Voice Mode) */}
                    <form
                      onSubmit={handleSendThought}
                      className="relative overflow-hidden rounded-xl border border-[#E3D9CD] bg-[#FAF7F2] transition-all duration-300 focus-within:border-[#2F6F63] focus-within:bg-white focus-within:shadow-sm"
                    >
                      {!voiceMode ? (
                        <div className="p-2 text-xs flex items-center justify-between gap-1.5">
                          <input
                            type="text"
                            value={thoughtInput}
                            onChange={(e) => setThoughtInput(e.target.value)}
                            placeholder={
                              selectedMood === 'talk'
                                ? 'Speak or type freely...'
                                : 'Type in Bangla or English...'
                            }
                            aria-label="Write how you feel"
                            className="bg-transparent border-0 outline-none w-full text-xs text-[#2A2A28] placeholder-[#8A8A85] px-1 py-1"
                          />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setVoiceMode(true)}
                              aria-label="Switch to voice mode"
                              title="কথা বলো • Switch to voice"
                              className="w-7 h-7 rounded-lg text-[#6B6B66] hover:text-[#2F6F63] hover:bg-[#F1EAE1] flex items-center justify-center transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="submit"
                              aria-label="Send thought"
                              className="w-7 h-7 rounded-lg bg-[#2F6F63] hover:bg-[#24594f] text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 text-xs flex items-center justify-between gap-2.5 bg-gradient-to-r from-[#F1EAE1]/80 via-white to-[#F1EAE1]/80">
                          <div className="flex items-center gap-2 min-w-0 flex-grow">
                            <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                              <span className="absolute w-4 h-4 rounded-full bg-[#C97B5A]/25 animate-ping" />
                              <span className="w-2.5 h-2.5 rounded-full bg-[#C97B5A]" />
                            </div>
                            <div
                              aria-label="Voice sound wave preview"
                              className="flex items-center gap-1 h-6 px-1 flex-shrink-0"
                            >
                              <span className="wave-bar wave-bar-1 w-1 bg-[#2F6F63] rounded-full inline-block" />
                              <span className="wave-bar wave-bar-2 w-1 bg-[#7A9A7B] rounded-full inline-block" />
                              <span className="wave-bar wave-bar-3 w-1 bg-[#C97B5A] rounded-full inline-block" />
                              <span className="wave-bar wave-bar-4 w-1 bg-[#2F6F63] rounded-full inline-block" />
                              <span className="wave-bar wave-bar-5 w-1 bg-[#7A9A7B] rounded-full inline-block" />
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="bangla-text text-[11px] font-semibold text-[#2A2A28] truncate leading-tight">
                                বলতে পারো, আমি শুনছি...
                              </span>
                              <span className="text-[9px] text-[#6B6B66] truncate">
                                Speak freely, I&apos;m listening
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setVoiceMode(false)}
                            title="Switch back to keyboard"
                            className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-[10px] font-semibold text-[#2F6F63] hover:text-[#24594f] transition-all"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-[#6B6B66]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              viewBox="0 0 24 24"
                            >
                              <rect height="14" rx="2" width="18" x="3" y="5" />
                              <path d="M7 9h.01M10 9h.01M13 9h.01M16 9h.01M7 12h.01M10 12h.01M13 12h.01M16 12h.01M9 15h6" />
                            </svg>
                            <span className="bangla-text">কীবোর্ড</span>
                          </button>
                        </div>
                      )}
                    </form>

                    <div className="mt-2.5 text-center">
                      <span className="text-[10px] text-[#8A8A85] tracking-wide">
                        Zero pressure • Stays on your terms
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: HOW SHONGI HELPS */}
        <section className="py-20 md:py-28 border-t border-[#E3D9CD] bg-[#FAF7F2]" id="how-it-helps">
          <div className="max-w-[1120px] mx-auto px-6">
            <div className="max-w-2xl mx-auto text-center mb-16 md:mb-20">
              <div className="inline-block px-3 py-1 rounded-full bg-[#F1EAE1] text-[12px] font-semibold text-[#2F6F63] mb-3">
                Core Philosophy
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#2A2A28] tracking-tight mb-3">
                A place to start, not a place to perform.
              </h2>
              <p className="bangla-greeting text-lg md:text-xl font-medium text-[#C97B5A]">
                বলতে পারো, আমরা শুনছি।
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              <div
                aria-hidden="true"
                className="hidden md:block absolute top-[44px] left-[15%] right-[15%] h-[2px] bg-[#E3D9CD] z-0"
              />

              <div className="relative z-10 bg-white rounded-2xl p-7 border border-[#E3D9CD] hover:border-[#2F6F63] hover:-translate-y-0.5 transition-all flex flex-col items-start h-full">
                <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] text-[#2F6F63] flex items-center justify-center font-bold text-lg mb-5">
                  1
                </div>
                <h3 className="text-lg md:text-xl font-bold text-[#2A2A28] mb-2.5">
                  Say what’s on your mind
                </h3>
                <p className="text-sm md:text-[15px] text-[#6B6B66] leading-relaxed">
                  Talk or type privately. SHONGI listens without judgement, whether you speak
                  Bangla, Banglish, or English.
                </p>
              </div>

              <div className="relative z-10 bg-white rounded-2xl p-7 border border-[#E3D9CD] hover:border-[#2F6F63] hover:-translate-y-0.5 transition-all flex flex-col items-start h-full">
                <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] text-[#2F6F63] flex items-center justify-center font-bold text-lg mb-5">
                  2
                </div>
                <h3 className="text-lg md:text-xl font-bold text-[#2A2A28] mb-2.5">
                  Make sense of it
                </h3>
                <p className="text-sm md:text-[15px] text-[#6B6B66] leading-relaxed">
                  Get gentle reflection, practical perspective, and space to slow down—no forced
                  advice or toxic positivity.
                </p>
              </div>

              <div className="relative z-10 bg-white rounded-2xl p-7 border border-[#E3D9CD] hover:border-[#2F6F63] hover:-translate-y-0.5 transition-all flex flex-col items-start h-full">
                <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E3D9CD] text-[#C97B5A] flex items-center justify-center font-bold text-lg mb-5">
                  3
                </div>
                <h3 className="text-lg md:text-xl font-bold text-[#2A2A28] mb-2.5">
                  Connect when ready
                </h3>
                <p className="text-sm md:text-[15px] text-[#6B6B66] leading-relaxed">
                  Choose to share an experience or find people who have been through something
                  similar—completely on your terms.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: EXPLORE THE EXPERIENCE */}
        <section className="py-20 md:py-28 bg-[#FAF7F2] border-t border-[#E3D9CD]" id="explore">
          <div className="max-w-[1120px] mx-auto px-6">
            <div className="max-w-2xl mx-auto text-center mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#2A2A28] tracking-tight mb-3">
                Support that meets you where you are.
              </h2>
              <p className="text-base text-[#6B6B66]">
                Everyday difficulties shouldn&apos;t require navigating complex systems alone.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Block 1: Talk Privately */}
              <button
                type="button"
                onClick={() => onEnterWorkspace('ai-companion')}
                className="text-left bg-white rounded-2xl p-8 border border-[#E3D9CD] hover:border-[#2F6F63] hover:-translate-y-0.5 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#F1EAE1] text-[#2F6F63] flex items-center justify-center mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#2A2A28] mb-3">Talk privately</h3>
                  <p className="text-sm text-[#6B6B66] leading-relaxed mb-6">
                    Text or voice conversations with a personalised AI companion. You control what
                    SHONGI remembers, and it can check in only with your consent.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#EFE7DC] bg-[#FAF7F2] rounded-xl p-3 flex items-center gap-2 w-full">
                  <div className="flex-grow text-[11px] text-[#8A8A85] bg-white px-3 py-2 rounded-lg border border-[#E3D9CD]">
                    Open AI Companion →
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#2F6F63] text-white flex items-center justify-center text-xs">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Block 2: Find Your People */}
              <button
                type="button"
                onClick={() => onEnterWorkspace('peer-pilot')}
                className="text-left bg-white rounded-2xl p-8 border border-[#E3D9CD] hover:border-[#2F6F63] hover:-translate-y-0.5 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#F1EAE1] text-[#C97B5A] flex items-center justify-center mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#2A2A28] mb-3">Find your people</h3>
                  <p className="text-sm text-[#6B6B66] leading-relaxed mb-6">
                    Join calm, moderated communities around admission pressure, exams,
                    relationships, job searching, money stress, loneliness, and other everyday
                    experiences.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#EFE7DC] bg-[#FAF7F2] rounded-xl p-3 flex items-center justify-center gap-3 w-full">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-[#E3D9CD] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#2A2A28]">
                      ভার্সিটি
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#C97B5A]/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#C97B5A]">
                      চাকরি
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#2F6F63]/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#2F6F63]">
                      পরিবার
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#6B6B66]">Explore Peer Pilot →</span>
                </div>
              </button>

              {/* Block 3: Get the Right Support */}
              <button
                type="button"
                onClick={() => onEnterWorkspace('crisis-resources')}
                className="text-left bg-white rounded-2xl p-8 border border-[#E3D9CD] hover:border-[#2F6F63] hover:-translate-y-0.5 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#F1EAE1] text-[#7A9A7B] flex items-center justify-center mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#2A2A28] mb-3">Get the right support</h3>
                  <p className="text-sm text-[#6B6B66] leading-relaxed mb-6">
                    Connect with peers, seniors, mentors, trained supporters, or qualified
                    professionals—only when you choose and only with your consent.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#EFE7DC] bg-[#FAF7F2] rounded-xl p-2.5 flex items-center justify-between text-[10px] font-semibold text-[#6B6B66] w-full">
                  <span className="px-2 py-1 bg-white rounded border border-[#E3D9CD]">Peer</span>
                  <span className="text-[#E3D9CD]">→</span>
                  <span className="px-2 py-1 bg-white rounded border border-[#E3D9CD]">Mentor</span>
                  <span className="text-[#E3D9CD]">→</span>
                  <span className="px-2 py-1 bg-[#2F6F63]/10 text-[#2F6F63] rounded border border-[#2F6F63]/30">
                    Helplines
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 4: TRUST, PRIVACY AND SAFETY */}
        <section
          className="py-20 md:py-28 bg-[#F1EAE1] border-t border-[#E3D9CD]"
          id="privacy-safety"
        >
          <div className="max-w-[1120px] mx-auto px-6">
            <div className="max-w-2xl mx-auto text-center mb-16">
              <div className="inline-block px-3 py-1 rounded-full bg-white border border-[#E3D9CD] text-[12px] font-semibold text-[#2F6F63] mb-3">
                Safety &amp; Privacy First
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#2A2A28] tracking-tight mb-3">
                Your space. Your pace. Your choice.
              </h2>
              <p className="bangla-text text-lg md:text-xl font-medium text-[#2F6F63]">
                তোমার কথা, তোমার নিয়ন্ত্রণে।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-[#E3D9CD] flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#2F6F63] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-[#2A2A28] mb-2">Private by default</h4>
                <p className="text-xs sm:text-[13px] text-[#6B6B66] leading-relaxed">
                  Your conversations stay private unless you choose to share. No unauthorized
                  exposure.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-[#E3D9CD] flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#2F6F63] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                    <path
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-[#2A2A28] mb-2">You stay in control</h4>
                <p className="text-xs sm:text-[13px] text-[#6B6B66] leading-relaxed">
                  You decide what SHONGI remembers and when it can reach out. Review or erase
                  anytime.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-[#E3D9CD] flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#7A9A7B] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-[#2A2A28] mb-2">Safe community spaces</h4>
                <p className="text-xs sm:text-[13px] text-[#6B6B66] leading-relaxed">
                  Communities are human-moderated, with strict reporting and abuse-prevention tools.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-[#E3D9CD] flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#B4762C] flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-[#2A2A28] mb-2">Support has boundaries</h4>
                <p className="text-xs sm:text-[13px] text-[#6B6B66] leading-relaxed">
                  SHONGI is not therapy and does not diagnose. Qualified human support is available
                  when appropriate.
                </p>
              </div>
            </div>

            {/* Quick Workspace Jump Strip */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => onEnterWorkspace('ai-companion')}
                className="p-4 rounded-xl bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-left transition-all"
              >
                <span className="text-xs font-semibold text-[#2F6F63] block">01 · Companion</span>
                <span className="text-sm font-bold text-[#2A2A28]">Talk to SHONGI</span>
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('peer-pilot')}
                className="p-4 rounded-xl bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-left transition-all"
              >
                <span className="text-xs font-semibold text-[#C97B5A] block">02 · Peer Match</span>
                <span className="text-sm font-bold text-[#2A2A28]">Find Your People</span>
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('community-feed')}
                className="p-4 rounded-xl bg-white border border-[#E3D9CD] hover:border-[#2F6F63] text-left transition-all"
              >
                <span className="text-xs font-semibold text-[#2F6F63] block">03 · Your Space</span>
                <span className="text-sm font-bold text-[#2A2A28]">Community Feed</span>
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('crisis-resources')}
                className="p-4 rounded-xl bg-white border border-[#E3D9CD] hover:border-[#C97B5A] text-left transition-all"
              >
                <span className="text-xs font-semibold text-[#C97B5A] block">04 · BD 24/7</span>
                <span className="text-sm font-bold text-[#2A2A28]">Crisis Resources</span>
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 5: FINAL CTA */}
        <section className="py-24 md:py-32 bg-[#FAF7F2] border-t border-[#E3D9CD] text-center">
          <div className="max-w-[720px] mx-auto px-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#F1EAE1] text-[#2F6F63] flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#2A2A28] tracking-tight mb-4">
              Start wherever you are.
            </h2>

            <p className="text-lg md:text-xl font-normal text-[#6B6B66] leading-[1.6] mb-3">
              No pressure. No labels. Just a calm place to begin.
            </p>

            <p className="bangla-greeting text-xl md:text-2xl font-medium text-[#C97B5A] mb-8">
              একটু কথা বলবে?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {authSummary ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('ai-companion')}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#2F6F63] text-white text-base font-semibold hover:bg-[#24594f] shadow-[0_8px_30px_rgba(42,42,40,0.06)] transition-all hover:-translate-y-0.5"
                  >
                    Open SHONGI Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('community-feed')}
                    className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white border border-[#E3D9CD] text-[#2A2A28] text-base font-medium hover:border-[#2F6F63] transition-all hover:-translate-y-0.5"
                  >
                    Visit Community Feed
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="w-full sm:w-auto px-6 py-4 rounded-xl border border-[#C97B5A]/45 bg-[#C97B5A]/10 text-[#9a442d] text-base font-semibold hover:bg-[#C97B5A]/20 transition-all"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#2F6F63] text-white text-base font-semibold hover:bg-[#24594f] shadow-[0_8px_30px_rgba(42,42,40,0.06)] transition-all hover:-translate-y-0.5"
                  >
                    Begin privately
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('peer-pilot')}
                    className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white border border-[#E3D9CD] text-[#2A2A28] text-base font-medium hover:border-[#2F6F63] transition-all hover:-translate-y-0.5"
                  >
                    Explore Find Your People
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-[#E3D9CD] py-12">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-[#EFE7DC]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-lg text-[#2A2A28]">SHONGI</span>
                <span className="bangla-text font-bold text-[#2F6F63]">সঙ্গী</span>
              </div>
              <p className="text-xs sm:text-sm text-[#6B6B66] max-w-md">
                SHONGI is an everyday companion and human connection platform. It is not a
                replacement for professional clinical care or crisis emergency services.
              </p>
            </div>

            <nav className="flex flex-wrap items-center gap-6 text-sm text-[#6B6B66]" aria-label="Footer Links">
              <a href="#how-it-helps" className="hover:text-[#2A2A28] transition-colors">
                How it helps
              </a>
              <button
                type="button"
                onClick={() => onEnterWorkspace('peer-pilot')}
                className="hover:text-[#2A2A28] transition-colors"
              >
                Community
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('privacy-memory-hub')}
                className="hover:text-[#2A2A28] transition-colors"
              >
                Privacy &amp; safety
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('crisis-resources')}
                className="hover:text-[#2A2A28] transition-colors"
              >
                Crisis Resources
              </button>
            </nav>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8A8A85]">
            <p>© 2026 SHONGI (সঙ্গী). Made with empathy for Bangladesh.</p>

            <div className="flex items-center gap-3">
              <span>Language:</span>
              <button
                type="button"
                onClick={() => language !== 'en' && onToggleLanguage()}
                className={
                  language === 'en'
                    ? 'font-semibold text-[#2F6F63] hover:underline'
                    : 'font-semibold text-[#6B6B66] hover:text-[#2A2A28]'
                }
              >
                English
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => language !== 'bn' && onToggleLanguage()}
                className={`bangla-text ${
                  language === 'bn'
                    ? 'font-semibold text-[#2F6F63] hover:underline'
                    : 'font-semibold text-[#6B6B66] hover:text-[#2A2A28]'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
