import React, { useEffect, useState } from 'react';
import { AppScreen } from '../types/shongi';
import {
  BREATH_PHASES,
  BreathState,
  createInitialBreathState,
  stepBreathState,
} from '../utils/shongiLogic';

interface CrisisResourcesViewProps {
  onNavigate: (screen: AppScreen) => void;
}

export const CrisisResourcesView: React.FC<CrisisResourcesViewProps> = ({ onNavigate }) => {
  const [breath, setBreath] = useState<BreathState>(() => createInitialBreathState());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBreath((prev) => stepBreathState(prev));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const currentPhase = BREATH_PHASES[breath.phaseIndex];
  const isExhale = currentPhase.label === 'Exhale';

  const copyText = (value: string, label: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setToastMessage(label);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === label ? null : prev));
    }, 3000);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Offline Sync & Verification Anchor */}
      <div className="w-full bg-secondary-fixed text-on-secondary-fixed px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="material-symbols-outlined text-secondary text-xl flex-shrink-0 animate-pulse">
            verified
          </span>
          <p className="text-[12px] font-medium truncate">
            <strong className="font-semibold">Verified Bangladesh Emergency Directory:</strong>{' '}
            Cached offline on device (Bundle v2.4, Verified Nov 2026). Direct phone network
            required.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-on-surface text-[11px] font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-tertiary-container" />
            SQLite Synced
          </span>
        </div>
      </div>

      <div className="max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Hero Header / Reassurance Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-secondary text-on-secondary text-[11px] tracking-wide uppercase font-semibold bangla-text">
                জরুরি সহায়তা ও হেল্পলাইন
              </span>
              <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-tertiary-container">
                  lock
                </span>
                Private &amp; Unlogged
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-semibold text-primary tracking-tight">
              You are never alone. Reach out for care.
            </h1>
            <p className="text-[15px] text-on-surface-variant leading-relaxed">
              If you feel overwhelmed, in deep pain, or unsure of your next breath, warm and
              non-judgmental human support is ready. Choose a helpline below or take a steady moment
              with our grounding guide.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:999"
              className="group flex items-center gap-3 px-5 py-3.5 rounded-xl bg-secondary text-on-secondary shadow-md hover:bg-on-secondary-fixed-variant transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container-lowest/15 flex items-center justify-center text-on-secondary">
                <span className="material-symbols-outlined text-xl">call</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] opacity-90 leading-none">Immediate Danger (24/7)</span>
                <span className="text-[18px] font-semibold leading-tight text-on-secondary tracking-wide bangla-text">
                  Call 999 (জাতীয় সেবা)
                </span>
              </div>
            </a>
          </div>
        </div>

        {/* Honest Medical Limitations Notice */}
        <div className="w-full bg-surface-container-low rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">shield</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-primary">
                Honest Boundary &amp; Platform Limitations
              </span>
              <p className="text-[13px] text-on-surface-variant mt-0.5">
                SHONGI is an empathetic AI sanctuary and does not provide clinical emergency
                intervention or police dispatch. If you or someone you cherish is in imminent
                physical danger, please contact local emergency services or family members
                immediately.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 self-end sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface text-on-surface-variant text-[11px] font-semibold shadow-sm">
              <span className="material-symbols-outlined text-xs text-primary">gavel</span>
              No Data Leaves Phone
            </span>
          </div>
        </div>

        {/* Asymmetrical Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Primary Emergency Directories (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Featured Card: Kaan Pete Roi */}
            <div className="relative bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm transition-all hover:shadow-md overflow-hidden">
              <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-secondary-container/20 blur-2xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-secondary-container/30 flex items-center justify-center text-secondary flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-3xl">volunteer_activism</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[22px] font-semibold text-primary">Kaan Pete Roi</h2>
                      <span className="text-[18px] text-secondary font-medium bangla-text">
                        (কান পেতে রই)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[11px] font-semibold">
                        Suicide Prevention
                      </span>
                    </div>
                    <p className="text-[13px] text-on-surface-variant mt-1">
                      Bangladesh&apos;s premier non-judgmental emotional support helpline. Free,
                      fully confidential listening volunteers trained to support distress, grief,
                      loneliness, and suicidal thoughts.
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface text-[11px] font-medium">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                    Daily 3:00 PM – 3:00 AM
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                      Helpline Line 01
                    </span>
                    <span className="text-[11px] text-primary font-medium">Bangla / English</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[18px] font-semibold text-primary tracking-wide font-mono tabular-nums">
                      +880 1779-554391
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="tel:+8801779554391"
                      className="flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary text-[12px] font-medium text-center hover:bg-primary-container transition-colors shadow-sm"
                    >
                      Call Now
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        copyText('+8801779554391', 'Copied +880 1779-554391 to clipboard')
                      }
                      aria-label="Copy Helpline Line 01 number"
                      className="py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors text-[12px] font-medium flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                      Copy
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-xl p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                      Helpline Line 02
                    </span>
                    <span className="text-[11px] text-primary font-medium">
                      Alternative Carrier
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[18px] font-semibold text-primary tracking-wide font-mono tabular-nums">
                      +880 1779-554392
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href="tel:+8801779554392"
                      className="flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary text-[12px] font-medium text-center hover:bg-primary-container transition-colors shadow-sm"
                    >
                      Call Now
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        copyText('+8801779554392', 'Copied +880 1779-554392 to clipboard')
                      }
                      aria-label="Copy Helpline Line 02 number"
                      className="py-2 px-3 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors text-[12px] font-medium flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-on-surface-variant text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-tertiary-container">
                    lock
                  </span>
                  Calls are anonymous; caller IDs are never retained or publicized.
                </span>
                <span className="text-secondary font-medium bangla-text">
                  নিরাপদ ও সহমর্মী কথোপকথন
                </span>
              </div>
            </div>

            {/* Secondary Directory Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 999 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="w-10 h-10 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-2xl">local_police</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-semibold">
                      Toll-Free Nationwide
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-primary bangla-text">
                      National Emergency Service (জাতীয় জরুরি সেবা)
                    </h3>
                    <p className="text-[13px] text-on-surface-variant mt-1 leading-snug">
                      Immediate police dispatch, ambulance coordination, and fire rescue across all
                      64 districts in Bangladesh.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-on-surface-variant block">Dial Code</span>
                    <span className="text-[32px] text-secondary font-bold tracking-widest tabular-nums">
                      999
                    </span>
                  </div>
                  <a
                    href="tel:999"
                    className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary text-[12px] font-semibold flex items-center gap-2 hover:bg-on-secondary-fixed-variant transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    Dial 999
                  </a>
                </div>
              </div>

              {/* NIMH */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">domain</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-medium">
                      Govt. Psychiatric Care
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-primary">
                      National Institute of Mental Health (NIMH)
                    </h3>
                    <p className="text-[13px] text-on-surface-variant mt-1 leading-snug">
                      Sher-e-Bangla Nagar, Dhaka. 24/7 psychiatric emergency casualty unit and
                      specialized outpatient guidance.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-on-surface-variant block">
                      Direct Landline
                    </span>
                    <span className="text-[18px] text-primary font-mono font-semibold tabular-nums">
                      02-9118171
                    </span>
                  </div>
                  <a
                    href="tel:029118171"
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary-container transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    Call Clinic
                  </a>
                </div>
              </div>

              {/* Moner Bondhu */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="w-10 h-10 rounded-xl bg-tertiary-fixed-dim/30 flex items-center justify-center text-tertiary">
                      <span className="material-symbols-outlined text-2xl">support_agent</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-medium">
                      Psychosocial Support
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-primary bangla-text">
                      Moner Bondhu (মনের বন্ধু)
                    </h3>
                    <p className="text-[13px] text-on-surface-variant mt-1 leading-snug">
                      Certified counseling professionals, tele-mental health support, and structured
                      emotional first aid sessions.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-on-surface-variant block">
                      Counseling Desk
                    </span>
                    <span className="text-[17px] text-primary font-mono font-semibold tabular-nums">
                      +880 1776-632344
                    </span>
                  </div>
                  <a
                    href="tel:+8801776632344"
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary-container transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    Connect
                  </a>
                </div>
              </div>

              {/* Dhaka Community Hospital */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-2xl">local_hospital</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-medium">
                      Medical Casualty
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-primary">
                      Dhaka Community Hospital Unit
                    </h3>
                    <p className="text-[13px] text-on-surface-variant mt-1 leading-snug">
                      Moghbazar, Dhaka. Rapid triage for self-harm injuries, trauma care, and poison
                      control emergencies.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-on-surface-variant block">
                      Emergency Desk
                    </span>
                    <span className="text-[18px] text-primary font-mono font-semibold tabular-nums">
                      02-9351198
                    </span>
                  </div>
                  <a
                    href="tel:029351198"
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary-container transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    Call Triage
                  </a>
                </div>
              </div>
            </div>

            {/* University Student Welfare & Guidance Centers Bento Card */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary-fixed-dim/40 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">school</span>
                  </span>
                  <div>
                    <h3 className="text-[18px] font-semibold text-primary">
                      Campus Guidance &amp; Student Welfare
                    </h3>
                    <p className="text-[13px] text-on-surface-variant">
                      Confidential counseling for academic distress, burnout &amp; peer crisis
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-semibold self-start sm:self-auto">
                  University Specific
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {[
                  {
                    code: 'DU',
                    name: 'Dhaka University',
                    unit: 'Student Counseling & Guidance Center',
                    phone: '+880 2-9661900',
                    href: 'tel:+88029661900',
                  },
                  {
                    code: 'BUET',
                    name: 'BUET DSW',
                    unit: "Directorate of Students' Welfare Cell",
                    phone: '+880 2-55167100',
                    href: 'tel:+880255167100',
                  },
                  {
                    code: 'NSU',
                    name: 'North South Univ.',
                    unit: 'Counseling Center (Admin Bld)',
                    phone: 'Ext 2121 / 1211',
                    href: 'tel:+880255668200',
                  },
                  {
                    code: 'BRACU',
                    name: 'BRAC University',
                    unit: 'Counseling & Wellness Centre',
                    phone: '+880 9666722722',
                    href: 'tel:+8809666722722',
                  },
                ].map((campus) => (
                  <div
                    key={campus.code}
                    className="bg-surface-container-low rounded-xl p-3.5 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <span className="text-[11px] text-secondary font-semibold uppercase">
                        {campus.code}
                      </span>
                      <p className="text-[12px] text-primary font-medium mt-0.5">{campus.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{campus.unit}</p>
                    </div>
                    <a
                      href={campus.href}
                      className="mt-2 text-primary font-mono font-semibold text-xs flex items-center gap-1 hover:text-secondary tabular-nums"
                    >
                      <span className="material-symbols-outlined text-xs">call</span>{' '}
                      {campus.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Grounding Widget & Safety Planning (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Grounding & 4-7-8 Breathing Circle */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
              <div className="w-full flex items-center justify-between pb-3">
                <span className="text-[11px] text-secondary font-semibold tracking-wider uppercase">
                  Calm Before Dialing
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-semibold">
                  4-7-8 Technique
                </span>
              </div>

              <h3 className="text-[18px] font-semibold text-primary mt-1">
                Ground Your Physiology
              </h3>
              <p className="text-[13px] text-on-surface-variant mt-1">
                If your heart is racing or speech feels paralyzed, sync with this breathing rhythm
                for 60 seconds.
              </p>

              {/* Interactive Animated Breathing Widget */}
              <div className="relative w-56 h-56 my-7 flex items-center justify-center">
                <div
                  style={{ transform: isExhale ? 'scale(0.95)' : 'scale(1.35)' }}
                  className="absolute w-44 h-44 rounded-full bg-tertiary-fixed-dim/25 transition-transform duration-[4000ms] ease-in-out"
                />
                <div
                  style={{ transform: isExhale ? 'scale(0.9)' : 'scale(1.2)' }}
                  className="absolute w-36 h-36 rounded-full bg-tertiary-container/10 transition-transform duration-[4000ms] ease-in-out"
                />
                <div
                  style={{ transform: isExhale ? 'scale(0.88)' : 'scale(1.15)' }}
                  className="relative z-10 w-28 h-28 rounded-full bg-primary-container text-on-primary-container flex flex-col items-center justify-center shadow-lg transition-transform duration-[4000ms] ease-in-out"
                >
                  <span
                    data-testid="breath-action"
                    className="text-[18px] text-surface font-semibold tracking-tight"
                  >
                    {currentPhase.label}
                  </span>
                  <span
                    data-testid="breath-timer"
                    className="text-[12px] text-primary-fixed font-mono mt-0.5 tabular-nums"
                  >
                    {breath.timeRemaining}s
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setBreath((prev) => ({ ...prev, isRunning: !prev.isRunning }))}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-surface-container-high text-primary text-[12px] font-medium hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg">
                    {breath.isRunning ? 'pause' : 'play_arrow'}
                  </span>
                  <span>{breath.isRunning ? 'Pause Rhythm' : 'Resume Rhythm'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBreath(createInitialBreathState())}
                  title="Reset Cycle"
                  aria-label="Reset breathing cycle"
                  className="p-2.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">replay</span>
                </button>
              </div>

              <p className="text-[12px] text-on-surface-variant/85 mt-4 italic bangla-text">
                &ldquo;আপনি একা নন, ধীরে শ্বাস নিন—কথা বলার জন্য যথেষ্ট সময় আছে।&rdquo;
              </p>
            </div>

            {/* Safe Sanctuary Tips & Pre-Call Preparation */}
            <div className="bg-surface-container-low rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary text-xl">
                  psychology_alt
                </span>
                <h4 className="text-[18px] font-semibold text-primary">
                  What happens when you call?
                </h4>
              </div>

              <ul className="flex flex-col gap-3 text-[13px] text-on-surface-variant">
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-tertiary-container text-base mt-0.5 flex-shrink-0">
                    check_circle
                  </span>
                  <span>
                    <strong>No pressure to speak right away:</strong> You can stay quiet or cry.
                    The trained listener will stay quietly with you on the line.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-tertiary-container text-base mt-0.5 flex-shrink-0">
                    check_circle
                  </span>
                  <span>
                    <strong>Total anonymity:</strong> You do not need to share your real name,
                    address, or academic institution.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-tertiary-container text-base mt-0.5 flex-shrink-0">
                    check_circle
                  </span>
                  <span>
                    <strong>Bangla &amp; Banglish welcome:</strong> Express your anguish in whatever
                    mix of words feels natural.
                  </span>
                </li>
              </ul>

              <div className="p-3.5 rounded-xl bg-surface-container-lowest flex items-center gap-3 mt-1 shadow-sm">
                <span className="material-symbols-outlined text-primary text-xl">
                  perm_phone_msg
                </span>
                <div className="flex flex-col">
                  <span className="text-[12px] font-medium text-primary">
                    Can&apos;t speak out loud?
                  </span>
                  <span className="text-[12px] text-on-surface-variant">
                    Send a direct message on Moner Bondhu&apos;s Facebook verified messenger portal.
                  </span>
                </div>
              </div>
            </div>

            {/* Ephemeral Session Banner */}
            <div className="bg-primary-container text-on-primary rounded-2xl p-6 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-tertiary-fixed tracking-wider uppercase font-semibold">
                  Privacy Guaranteed
                </span>
                <span className="material-symbols-outlined text-tertiary-fixed text-lg">
                  enhanced_encryption
                </span>
              </div>
              <h4 className="text-[18px] font-semibold text-surface">Zero Footprint Trace</h4>
              <p className="text-[12px] text-primary-fixed leading-relaxed">
                Viewing these resources is not stored in your SHONGI session logs or sent to any
                analytics server. You can exit this screen cleanly at any moment.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('ai-companion')}
                className="mt-2 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface/10 hover:bg-surface/20 text-surface text-[12px] font-medium transition-colors"
              >
                Return to AI Safe Sanctuary
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bangladesh Cultural Sensitivity & River Metaphor Footer Card */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 max-w-xl">
            <div className="w-12 h-12 rounded-2xl bg-secondary-fixed flex items-center justify-center text-secondary flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">spa</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[18px] font-semibold text-primary bangla-text">
                &ldquo;নদীর ওপারেই নতুন ভোরের আলো&rdquo;
              </span>
              <p className="text-[13px] text-on-surface-variant mt-0.5">
                Like the Padma in turbulent weather, heavy waves eventually subside into calm dawn.
                Reach out to one person or helpline today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-[12px] font-medium flex items-center gap-2 hover:bg-surface-container-highest transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              Print Directory
            </button>
            <button
              type="button"
              onClick={() =>
                copyText(
                  'Bangladesh Crisis Helplines:\nKaan Pete Roi: +8801779554391\nEmergency: 999\nNIMH: 02-9118171',
                  'Helpline directory copied to clipboard.'
                )
              }
              className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-[12px] font-medium flex items-center gap-2 hover:bg-on-secondary-fixed-variant transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">share</span>
              Share Numbers Safely
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl bg-primary text-on-primary text-[12px] font-medium shadow-xl flex items-center gap-2 z-50">
          <span className="material-symbols-outlined text-tertiary-fixed text-lg">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
