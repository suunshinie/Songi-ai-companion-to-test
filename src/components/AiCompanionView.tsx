import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApprovedMemory,
  AppScreen,
  ChatMessage,
  CompanionLanguage,
  CompanionMode,
  Language,
  MemoryProposal,
  VoiceConversationEvent,
  VoiceConversationPhase,
} from '../types/shongi';
import { SHONGI_IMAGES } from '../data/seedData';
import {
  detectCompanionLanguage,
  formatDetectedLanguageLabel,
  formatMemoryUsage,
  generateCompanionReply,
  isNoiseOnlyTranscript,
  MAX_APPROVED_MEMORIES,
  reduceVoiceConversationPhase,
  shouldTriggerSilenceStop,
  stripMarkdownForSpeech,
} from '../utils/shongiLogic';
import { ResilientImage } from './ResilientImage';

interface AiCompanionViewProps {
  language: Language;
  messages: ChatMessage[];
  memories: ApprovedMemory[];
  proposal: MemoryProposal;
  isStreamingReply: boolean;
  lastCompletedReply: {
    id: string;
    text: string;
    language: CompanionLanguage;
  } | null;
  onSendMessage: (
    text: string,
    mode: CompanionMode,
    options?: { isVoiceTurn?: boolean }
  ) => void;
  onRetryMessage: (messageId: string, mode: CompanionMode) => void;
  onStopStreaming: () => void;
  onPurgeMessages: () => void;
  onApproveProposal: (customText?: string) => void;
  onEditProposalText: (newText: string) => void;
  onDismissProposal: () => void;
  onRemoveMemory: (id: string) => void;
  onNavigate: (screen: AppScreen) => void;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const MODE_OPTIONS: {
  id: CompanionMode;
  label: string;
  banglaHint?: string;
  icon: string;
}[] = [
  {
    id: 'listening',
    label: 'Listening First',
    banglaHint: '• কেবল সহমর্মিতা',
    icon: 'hearing',
  },
  {
    id: 'reflection',
    label: 'Reflection & Clarity',
    icon: 'psychology_alt',
  },
  {
    id: 'action',
    label: 'Practical Next Steps',
    icon: 'checklist',
  },
];

const QUICK_INTENTS = [
  {
    label: 'Just listen to me',
    icon: 'self_improvement',
    iconColor: 'text-primary',
    text: "Just listen to me, I don't need any solutions right now.",
  },
  {
    label: 'Banglish-e kotha boli',
    icon: 'chat',
    iconColor: 'text-secondary',
    text: 'Shongi, ami ajke khub tired lagchhe, kotha bolte chai.',
  },
  {
    label: 'Can I talk to a peer?',
    icon: 'group',
    iconColor: 'text-tertiary-container',
    text: 'Can I talk to a peer who survived admission stress?',
  },
  {
    label: 'পরিবারকে বোঝাবো কীভাবে?',
    text: 'কীভাবে আব্বু-আম্মুকে বুঝাবো যে ইঞ্জিনিয়ারিং আমার ভালো লাগছে না?',
  },
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function base64ToObjectUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found on this device — you can type in Bangla, Banglish, or English below.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your microphone is currently busy in another app. Close that app or type below.';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was blocked — allow mic access in your browser, or type below.';
  }
  return 'Could not access microphone right now — you can type in Bangla, Banglish, or English below.';
}

export const AiCompanionView: React.FC<AiCompanionViewProps> = ({
  language,
  messages,
  memories,
  proposal,
  isStreamingReply,
  lastCompletedReply,
  onSendMessage,
  onRetryMessage,
  onStopStreaming,
  onPurgeMessages,
  onApproveProposal,
  onEditProposalText,
  onDismissProposal,
  onRemoveMemory,
  onNavigate,
}) => {
  const [mode, setMode] = useState<CompanionMode>('listening');
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingSpeechId, setLoadingSpeechId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Two-Way Hands-Free Voice Conversation State
  const [voicePhase, setVoicePhase] = useState<VoiceConversationPhase>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [heardSpeechInTurn, setHeardSpeechInTurn] = useState(false);

  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState(proposal.text);
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const lastAutoSpokenIdRef = useRef<string | null>(null);
  const autoSendVoiceRef = useRef(false);
  const preRecordDraftRef = useRef('');
  const voiceNoticeTimerRef = useRef<number | null>(null);

  // Refs for continuous two-way loop
  const voicePhaseRef = useRef<VoiceConversationPhase>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const twoWayRecorderRef = useRef<MediaRecorder | null>(null);
  const twoWayStreamRef = useRef<MediaStream | null>(null);
  const twoWayChunksRef = useRef<Blob[]>([]);
  const silentSinceRef = useRef<number | null>(null);
  const heardSpeechRef = useRef(false);
  const speechFramesRef = useRef(0);
  const discardCapturedAudioRef = useRef(false);
  const twoWayRetryTimerRef = useRef<number | null>(null);

  const draftLanguage = useMemo(() => {
    if (!draft.trim()) return null;
    return detectCompanionLanguage(draft);
  }, [draft]);

  const dispatchVoicePhase = (event: VoiceConversationEvent) => {
    const next = reduceVoiceConversationPhase(voicePhaseRef.current, event);
    voicePhaseRef.current = next;
    setVoicePhase(next);
    return next;
  };

  useEffect(() => {
    setMemoryDraft(proposal.text);
  }, [proposal.text]);

  useEffect(() => {
    if (messages.length > 4 || isStreamingReply) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreamingReply]);

  const cleanupTwoWayMic = () => {
    if (twoWayRetryTimerRef.current !== null) {
      window.clearTimeout(twoWayRetryTimerRef.current);
      twoWayRetryTimerRef.current = null;
    }
    if (vadRafRef.current !== null) {
      window.cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (twoWayRecorderRef.current && twoWayRecorderRef.current.state !== 'inactive') {
      try {
        twoWayRecorderRef.current.stop();
      } catch {
        // Ignore recorder stop errors on teardown
      }
    }
    twoWayRecorderRef.current = null;
    twoWayStreamRef.current?.getTracks().forEach((t) => t.stop());
    twoWayStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    setMicLevel(0);
    setHeardSpeechInTurn(false);
    heardSpeechRef.current = false;
    speechFramesRef.current = 0;
    silentSinceRef.current = null;
  };

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.pause();
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
      if (voiceNoticeTimerRef.current !== null) {
        window.clearTimeout(voiceNoticeTimerRef.current);
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        speechRecRef.current?.stop();
      } catch {
        // Ignore speech recognition stop errors
      }
      discardCapturedAudioRef.current = true;
      cleanupTwoWayMic();
    };
  }, []);

  const ensureAudioElement = (): HTMLAudioElement => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
      audioPlayerRef.current.preload = 'auto';
    }
    return audioPlayerRef.current;
  };

  // Prime/unlock HTMLAudioElement inside synchronous user gesture handlers so async TTS can play
  const primeAudioForAutoplay = () => {
    try {
      const audio = ensureAudioElement();
      audio.load();
    } catch {
      // Ignore preload errors
    }
  };

  const showVoiceNotice = (msg: string) => {
    setVoiceNotice(msg);
    if (voiceNoticeTimerRef.current !== null) {
      window.clearTimeout(voiceNoticeTimerRef.current);
    }
    voiceNoticeTimerRef.current = window.setTimeout(() => {
      setVoiceNotice((prev) => (prev === msg ? null : prev));
    }, 5500);
  };

  const stopSpeechPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current.onerror = null;
      audioPlayerRef.current.pause();
      audioPlayerRef.current.removeAttribute('src');
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    setSpeakingMessageId(null);
    setLoadingSpeechId(null);
  };

  const speakMessage = async (
    msgId: string,
    fullText: string,
    msgLang?: CompanionLanguage,
    onPlaybackDone?: () => void
  ) => {
    const cleanSpeechText = stripMarkdownForSpeech(fullText);
    if (!cleanSpeechText) {
      onPlaybackDone?.();
      return;
    }
    if (speakingMessageId === msgId && !onPlaybackDone) {
      stopSpeechPlayback();
      return;
    }

    stopSpeechPlayback();
    setLoadingSpeechId(msgId);

    try {
      const res = await fetch('/api/companion/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanSpeechText, language: msgLang }),
      });

      if (!res.ok) {
        let errorMsg = `Voice reply unavailable (${res.status})`;
        try {
          const errJson = (await res.json()) as { error?: string };
          if (errJson.error) errorMsg = errJson.error;
        } catch {
          // Use fallback message
        }
        throw new Error(errorMsg);
      }

      const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
      if (!data.audioBase64) {
        throw new Error('Voice synthesis returned empty audio.');
      }

      const objectUrl = base64ToObjectUrl(data.audioBase64, data.mimeType ?? 'audio/wav');
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      }
      audioObjectUrlRef.current = objectUrl;

      const audio = ensureAudioElement();
      audio.src = objectUrl;
      setLoadingSpeechId(null);
      setSpeakingMessageId(msgId);

      audio.onended = () => {
        setSpeakingMessageId((curr) => (curr === msgId ? null : curr));
        if (audioObjectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          audioObjectUrlRef.current = null;
        }
        onPlaybackDone?.();
      };
      audio.onerror = () => {
        setSpeakingMessageId((curr) => (curr === msgId ? null : curr));
        if (audioObjectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          audioObjectUrlRef.current = null;
        }
        showVoiceNotice('Audio playback was interrupted by the browser.');
        onPlaybackDone?.();
      };

      await audio.play();
    } catch (err) {
      setLoadingSpeechId(null);
      setSpeakingMessageId(null);
      const isAutoplayBlocked =
        err instanceof DOMException && err.name === 'NotAllowedError';
      const message = isAutoplayBlocked
        ? 'Browser paused automatic audio playback. Tap Listen on the reply to hear SHONGI.'
        : err instanceof Error
        ? err.message
        : 'Unable to play voice reply right now.';
      showVoiceNotice(message);
      onPlaybackDone?.();
    }
  };

  useEffect(() => {
    if (!lastCompletedReply || lastCompletedReply.id === lastAutoSpokenIdRef.current) {
      return;
    }

    lastAutoSpokenIdRef.current = lastCompletedReply.id;

    if (voicePhaseRef.current === 'thinking') {
      dispatchVoicePhase('REPLY_READY');
      void speakMessage(
        lastCompletedReply.id,
        lastCompletedReply.text,
        lastCompletedReply.language,
        () => {
          if (voicePhaseRef.current === 'speaking') {
            dispatchVoicePhase('SPEAKING_ENDED');
            void startTwoWayListeningCycle();
          }
        }
      );
      return;
    }

    if (autoSpeak) {
      void speakMessage(
        lastCompletedReply.id,
        lastCompletedReply.text,
        lastCompletedReply.language
      );
    }
  }, [autoSpeak, lastCompletedReply]);

  // Recover two-way loop if streaming reply failed with an error while thinking
  useEffect(() => {
    if (voicePhaseRef.current !== 'thinking' || isStreamingReply) return;
    const latest = messages[messages.length - 1];
    if (latest?.role === 'companion' && latest.error) {
      dispatchVoicePhase('EMPTY_AUDIO');
      twoWayRetryTimerRef.current = window.setTimeout(() => {
        void startTwoWayListeningCycle();
      }, 300);
    }
  }, [isStreamingReply, messages]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || isStreamingReply) return;
    if (autoSpeak) {
      primeAudioForAutoplay();
    }
    onSendMessage(trimmed, mode);
    setDraft('');
    setIsRecording(false);
  };

  const handleFillIntent = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  const handleSaveMemoryEdit = () => {
    const cleaned = memoryDraft.trim();
    if (cleaned) {
      onEditProposalText(cleaned);
    }
    setIsEditingMemory(false);
  };

  const stopRecordingAndTranscribe = (sendImmediately: boolean) => {
    autoSendVoiceRef.current = sendImmediately;
    try {
      speechRecRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    speechRecRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
    }
  };

  const startVoiceListening = async () => {
    setVoiceNotice(null);
    stopSpeechPlayback();
    if (voicePhaseRef.current !== 'idle') {
      handleEndTwoWayVoice();
    }
    if (autoSpeak) {
      primeAudioForAutoplay();
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showVoiceNotice(
        'Microphone recording is not available in this browser environment — please type below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      autoSendVoiceRef.current = false;
      preRecordDraftRef.current = draft.trim();

      const selectedMime = pickSupportedAudioMimeType();
      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      const effectiveMime = (recorder.mimeType || selectedMime || 'audio/webm').split(';')[0];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        const baseDraft = preRecordDraftRef.current;

        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: effectiveMime });
        if (blob.size < 400) {
          if (autoSendVoiceRef.current && draft.trim()) {
            onSendMessage(draft.trim(), mode, { isVoiceTurn: true });
            setDraft('');
          }
          return;
        }

        setIsTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const res = await fetch('/api/companion/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType: effectiveMime }),
          });

          if (!res.ok) {
            let errMsg = `Voice transcription unavailable (${res.status})`;
            try {
              const errJson = (await res.json()) as { error?: string };
              if (errJson.error) errMsg = errJson.error;
            } catch {
              // Keep status fallback
            }
            throw new Error(errMsg);
          }

          const data = (await res.json()) as { text?: string };
          const transcript = data.text?.trim() ?? '';
          if (transcript && !isNoiseOnlyTranscript(transcript)) {
            if (autoSendVoiceRef.current) {
              setDraft(baseDraft);
              onSendMessage(transcript, mode, { isVoiceTurn: true });
            } else {
              setDraft(baseDraft ? `${baseDraft} ${transcript}` : transcript);
              inputRef.current?.focus();
            }
          } else if (autoSendVoiceRef.current) {
            const fallbackPreview = draft.trim();
            if (fallbackPreview && fallbackPreview !== baseDraft) {
              const spokenOnly = baseDraft
                ? fallbackPreview.replace(baseDraft, '').trim()
                : fallbackPreview;
              if (spokenOnly) {
                setDraft(baseDraft);
                onSendMessage(spokenOnly, mode, { isVoiceTurn: true });
              }
            }
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unable to transcribe audio right now.';
          showVoiceNotice(message);
        } finally {
          setIsTranscribing(false);
        }
      };

      // Optional real-time browser Web Speech caption preview if supported
      const win = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = language === 'bn' ? 'bn-BD' : 'en-US';
          rec.onresult = (event) => {
            const parts: string[] = [];
            for (let i = 0; i < event.results.length; i++) {
              parts.push(event.results[i][0].transcript);
            }
            const preview = parts.join(' ').trim();
            if (preview) {
              const base = preRecordDraftRef.current;
              setDraft(base ? `${base} ${preview}` : preview);
            }
          };
          rec.onerror = () => {
            // Silently rely on Gemini MediaRecorder transcription
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // Ignore SpeechRecognition startup error
        }
      }

      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      showVoiceNotice(describeMicError(err));
      setIsRecording(false);
    }
  };

  const handleToggleVoice = () => {
    if (isRecording) {
      stopRecordingAndTranscribe(false);
    } else {
      void startVoiceListening();
    }
  };

  const scheduleTwoWayRetry = () => {
    if (twoWayRetryTimerRef.current !== null) {
      window.clearTimeout(twoWayRetryTimerRef.current);
    }
    twoWayRetryTimerRef.current = window.setTimeout(() => {
      if (voicePhaseRef.current === 'listening') {
        void startTwoWayListeningCycle();
      }
    }, 260);
  };

  // Start one hands-free listening turn for Two-Way Voice Talk
  const startTwoWayListeningCycle = async () => {
    if (voicePhaseRef.current !== 'listening') return;
    cleanupTwoWayMic();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showVoiceNotice(
        'Microphone access is unavailable in this browser. Pause or type below instead.'
      );
      dispatchVoicePhase('PAUSE_MIC');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (voicePhaseRef.current !== 'listening') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      twoWayStreamRef.current = stream;
      twoWayChunksRef.current = [];
      discardCapturedAudioRef.current = false;
      heardSpeechRef.current = false;
      speechFramesRef.current = 0;
      silentSinceRef.current = null;
      setHeardSpeechInTurn(false);

      const selectedMime = pickSupportedAudioMimeType();
      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      const effectiveMime = (recorder.mimeType || selectedMime || 'audio/webm').split(';')[0];
      twoWayRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          twoWayChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const getPhase = (): VoiceConversationPhase => voicePhaseRef.current;
        const wasDiscarded = discardCapturedAudioRef.current;
        const chunks = twoWayChunksRef.current;
        twoWayChunksRef.current = [];
        cleanupTwoWayMic();

        if (wasDiscarded || getPhase() === 'idle' || getPhase() === 'paused') {
          return;
        }

        const blob = new Blob(chunks, { type: effectiveMime });
        if (blob.size < 450) {
          dispatchVoicePhase('EMPTY_AUDIO');
          scheduleTwoWayRetry();
          return;
        }

        dispatchVoicePhase('AUDIO_CAPTURED');
        try {
          const audioBase64 = await blobToBase64(blob);
          const res = await fetch('/api/companion/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType: effectiveMime }),
          });
          if (!res.ok) {
            let errMsg = `Voice listening error (${res.status})`;
            try {
              const errJson = (await res.json()) as { error?: string };
              if (errJson.error) errMsg = errJson.error;
            } catch {
              // Keep status fallback
            }
            throw new Error(errMsg);
          }
          const data = (await res.json()) as { text?: string };
          const transcript = data.text?.trim() ?? '';

          if (
            !transcript ||
            isNoiseOnlyTranscript(transcript) ||
            getPhase() === 'idle' ||
            getPhase() === 'paused'
          ) {
            if (getPhase() === 'transcribing') {
              dispatchVoicePhase('EMPTY_AUDIO');
              scheduleTwoWayRetry();
            }
            return;
          }

          dispatchVoicePhase('TRANSCRIPT_READY');
          onSendMessage(transcript, mode, { isVoiceTurn: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unable to transcribe audio turn.';
          showVoiceNotice(msg);
          if (getPhase() === 'transcribing') {
            dispatchVoicePhase('EMPTY_AUDIO');
            scheduleTwoWayRetry();
          }
        }
      };

      // Live Web Audio RMS energy monitor for automatic silence detection (~950ms pause submits turn)
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => undefined);
      }
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const timeData = new Uint8Array(analyser.fftSize);
      const turnStartedAt = Date.now();

      const monitorVad = () => {
        if (voicePhaseRef.current !== 'listening' || !twoWayRecorderRef.current) return;

        analyser.getByteTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const normalized = (timeData[i] - 128) / 128;
          sumSq += normalized * normalized;
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        setMicLevel(Math.min(1, rms * 5));

        const now = Date.now();
        if (rms > 0.02) {
          speechFramesRef.current += 1;
          if (speechFramesRef.current >= 2) {
            heardSpeechRef.current = true;
            setHeardSpeechInTurn(true);
            silentSinceRef.current = null;
          }
        } else {
          speechFramesRef.current = 0;
          if (heardSpeechRef.current && silentSinceRef.current === null) {
            silentSinceRef.current = now;
          }
        }

        const autoStop =
          shouldTriggerSilenceStop(heardSpeechRef.current, silentSinceRef.current, now, 950) ||
          (heardSpeechRef.current && now - turnStartedAt > 18000);

        if (autoStop && twoWayRecorderRef.current.state === 'recording') {
          twoWayRecorderRef.current.stop();
          return;
        }

        vadRafRef.current = window.requestAnimationFrame(monitorVad);
      };

      recorder.start(250);
      vadRafRef.current = window.requestAnimationFrame(monitorVad);
    } catch (err) {
      showVoiceNotice(describeMicError(err));
      dispatchVoicePhase('PAUSE_MIC');
    }
  };

  const handleStartTwoWayVoice = () => {
    if (voicePhase !== 'idle') {
      handleEndTwoWayVoice();
      return;
    }
    if (isRecording) {
      stopRecordingAndTranscribe(false);
    }
    primeAudioForAutoplay();
    stopSpeechPlayback();
    setVoiceNotice(null);
    dispatchVoicePhase('START_CALL');
    void startTwoWayListeningCycle();
  };

  const handleSubmitCurrentVoiceTurn = () => {
    if (twoWayRecorderRef.current && twoWayRecorderRef.current.state === 'recording') {
      discardCapturedAudioRef.current = false;
      twoWayRecorderRef.current.stop();
    }
  };

  const handleInterruptBotAndSpeak = () => {
    primeAudioForAutoplay();
    stopSpeechPlayback();
    onStopStreaming();
    dispatchVoicePhase('USER_INTERRUPT');
    void startTwoWayListeningCycle();
  };

  const handlePauseOrResumeTwoWay = () => {
    if (voicePhase === 'paused') {
      primeAudioForAutoplay();
      dispatchVoicePhase('RESUME_MIC');
      void startTwoWayListeningCycle();
    } else {
      stopSpeechPlayback();
      onStopStreaming();
      discardCapturedAudioRef.current = true;
      dispatchVoicePhase('PAUSE_MIC');
      cleanupTwoWayMic();
    }
  };

  const handleEndTwoWayVoice = () => {
    stopSpeechPlayback();
    onStopStreaming();
    discardCapturedAudioRef.current = true;
    dispatchVoicePhase('END_CALL');
    cleanupTwoWayMic();
  };

  return (
    <div className="flex flex-col w-full">
      {/* Interactive Top Control Bar */}
      <div className="w-full bg-surface-container-low px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{opt.icon}</span>
                  <span>{opt.label}</span>
                  {opt.banglaHint && (
                    <span className="text-[11px] opacity-75 hidden xl:inline bangla-text">
                      {opt.banglaHint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="two-way-voice-toggle"
              aria-pressed={voicePhase !== 'idle'}
              onClick={handleStartTwoWayVoice}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all shadow-xs whitespace-nowrap ${
                voicePhase !== 'idle'
                  ? 'bg-secondary text-on-secondary'
                  : 'bg-primary text-on-primary hover:bg-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {voicePhase !== 'idle' ? 'call_end' : 'record_voice_over'}
              </span>
              <span>
                {voicePhase !== 'idle' ? 'End Two-Way Voice' : 'Two-Way Voice Talk'}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={autoSpeak}
              onClick={() => {
                if (autoSpeak) {
                  stopSpeechPlayback();
                } else {
                  primeAudioForAutoplay();
                }
                setAutoSpeak((v) => !v);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                autoSpeak
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {autoSpeak ? 'volume_up' : 'volume_off'}
              </span>
              <span>{autoSpeak ? 'Voice Replies: On' : 'Voice Replies: Off'}</span>
            </button>

            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant whitespace-nowrap">
              <span className="material-symbols-outlined text-sm text-secondary">info</span>
              <span className="text-[11px] font-medium">
                AI Companion • Not a therapist
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Two-Way Voice Conversation Card (Visible when active) */}
      {voicePhase !== 'idle' && (
        <div
          data-testid="two-way-voice-panel"
          className="max-w-[1360px] w-full mx-auto px-4 md:px-8 pt-6"
        >
          <div className="rounded-2xl bg-surface-container-lowest border border-primary/20 shadow-md p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                  voicePhase === 'listening'
                    ? 'bg-primary text-on-primary'
                    : voicePhase === 'speaking'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container text-primary'
                }`}
              >
                {(voicePhase === 'listening' || voicePhase === 'speaking') && (
                  <span
                    className={`absolute inset-0 rounded-2xl animate-ping opacity-30 ${
                      voicePhase === 'speaking' ? 'bg-secondary' : 'bg-primary'
                    }`}
                  />
                )}
                <span className="material-symbols-outlined text-2xl relative z-10">
                  {voicePhase === 'listening'
                    ? 'mic'
                    : voicePhase === 'speaking'
                    ? 'graphic_eq'
                    : voicePhase === 'paused'
                    ? 'mic_off'
                    : 'sync'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-semibold text-on-surface">
                    Two-Way Voice Conversation
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-semibold uppercase tracking-wide">
                    {voicePhase}
                  </span>
                </div>
                <p className="text-[13px] text-on-surface-variant bangla-text">
                  {voicePhase === 'listening'
                    ? heardSpeechInTurn
                      ? 'Hearing you... Pause for a moment when finished, and SHONGI will answer.'
                      : 'Speak naturally in Bangla, Banglish, or English—SHONGI will listen and talk back.'
                    : voicePhase === 'transcribing'
                    ? 'Catching what you said...'
                    : voicePhase === 'thinking'
                    ? 'SHONGI is thinking of a warm reply...'
                    : voicePhase === 'speaking'
                    ? 'SHONGI is talking to you. Tap Interrupt anytime to speak.'
                    : 'Microphone paused. Tap Resume whenever you want to speak again.'}
                </p>

                {voicePhase === 'listening' && (
                  <div className="w-56 h-1.5 rounded-full bg-surface-container overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-tertiary-container rounded-full transition-all duration-75"
                      style={{ width: `${Math.max(8, Math.round(micLevel * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {voicePhase === 'listening' && (
                <button
                  type="button"
                  onClick={handleSubmitCurrentVoiceTurn}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-[12px] font-semibold hover:bg-primary-container transition-colors"
                >
                  Send Now
                </button>
              )}

              {voicePhase === 'speaking' && (
                <button
                  type="button"
                  onClick={handleInterruptBotAndSpeak}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-[12px] font-semibold hover:bg-primary-container transition-colors"
                >
                  Interrupt &amp; Talk
                </button>
              )}

              <button
                type="button"
                onClick={handlePauseOrResumeTwoWay}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors"
              >
                {voicePhase === 'paused' ? 'Resume Mic' : 'Pause Mic'}
              </button>

              <button
                type="button"
                onClick={handleEndTwoWayVoice}
                className="px-4 py-2 rounded-xl bg-secondary-fixed text-on-secondary-fixed text-[12px] font-semibold hover:bg-secondary hover:text-on-secondary transition-colors"
              >
                End Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Sanctuary Canvas: 2-Column Responsive Workspace */}
      <div className="max-w-[1360px] w-full mx-auto px-4 md:px-8 py-6 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left / Center: Conversational Flow (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Trust & Safe Space Subtle Notice */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container text-on-surface">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary-container text-lg">
                verified_user
              </span>
              <p className="text-[13px] text-on-surface-variant">
                <span className="font-medium text-on-surface">Safe Sanctuary Active:</span>{' '}
                <span className="bangla-text">পদ্মা শান্ত প্রহর</span> • Replies match Bangla,
                Banglish &amp; English naturally.
              </p>
            </div>
            <span className="text-[11px] text-tertiary-container px-2.5 py-0.5 rounded-full bg-tertiary-fixed font-semibold">
              End-to-End Private
            </span>
          </div>

          {/* Dialogue Timeline */}
          <div className="flex flex-col space-y-6" data-testid="chat-thread">
            <div className="flex items-center justify-center gap-4 py-2">
              <div className="h-[1px] bg-surface-container-highest flex-1" />
              <span className="text-[11px] font-semibold text-on-surface-variant px-3 py-1 rounded-full bg-surface-container bangla-text">
                {messages.length === 0
                  ? 'Session cleared • শুরু থেকে আবার শান্ত মনে কথা বলতে পারেন।'
                  : 'আজ সন্ধ্যা ৬:২৪ • Dusk Reflection'}
              </span>
              <div className="h-[1px] bg-surface-container-highest flex-1" />
            </div>

            {messages.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex flex-col items-end max-w-xl self-end">
                  <div className="bg-primary-container text-on-primary rounded-2xl rounded-br-sm px-5 py-4 shadow-sm">
                    {msg.paragraphs.map((p, idx) => (
                      <p
                        key={idx}
                        className="text-[16px] font-normal text-on-primary leading-[1.6] bangla-text"
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                  <span className="text-[11px] font-normal text-on-surface-variant mt-1.5 pr-1">
                    {msg.timestamp} • {msg.statusLabel ?? 'Delivered'}
                  </span>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-3.5 max-w-2xl self-start">
                  <div
                    className={`w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary flex-shrink-0 mt-1 shadow-sm ${
                      msg.isStreaming ? 'animate-pulse' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">spa</span>
                  </div>
                  <div className="flex flex-col space-y-4">
                    <div className="bg-surface-container-lowest text-on-surface rounded-2xl rounded-bl-sm px-6 py-5 shadow-sm space-y-3.5">
                      {(msg.modeLabel || msg.detectedLanguage) && (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <span className="text-[11px] text-primary font-medium tracking-wide">
                            SHONGI COMPANION • সঙ্গী
                          </span>
                          <div className="flex items-center gap-2">
                            {msg.detectedLanguage && (
                              <span
                                data-testid={`reply-lang-${msg.id}`}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium bangla-text"
                              >
                                {formatDetectedLanguageLabel(msg.detectedLanguage)}
                              </span>
                            )}
                            {msg.modeLabel && (
                              <span className="text-[11px] text-tertiary-container font-medium flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full bg-tertiary-container ${
                                    msg.isStreaming ? 'animate-ping' : ''
                                  }`}
                                />{' '}
                                {msg.modeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {msg.error ? (
                        <div
                          data-testid="companion-error-box"
                          className="p-3.5 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed space-y-2.5"
                        >
                          <div className="flex items-start gap-2 text-[13px] leading-[1.6]">
                            <span className="material-symbols-outlined text-base text-secondary shrink-0 mt-0.5">
                              error_outline
                            </span>
                            <span>{msg.error}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRetryMessage(msg.id, mode)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-medium hover:bg-primary-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            <span>Try Again</span>
                          </button>
                        </div>
                      ) : msg.isStreaming && msg.paragraphs.length === 0 ? (
                        <div
                          data-testid="typing-indicator"
                          className="flex items-center gap-2.5 py-1 text-[14px] text-on-surface-variant"
                        >
                          <span className="flex items-center gap-1" aria-hidden="true">
                            <span className="w-2 h-2 rounded-full bg-tertiary-container animate-bounce [animation-delay:0ms]" />
                            <span className="w-2 h-2 rounded-full bg-tertiary-container animate-bounce [animation-delay:150ms]" />
                            <span className="w-2 h-2 rounded-full bg-tertiary-container animate-bounce [animation-delay:300ms]" />
                          </span>
                          <span className="bangla-greeting">
                            SHONGI is listening and typing...
                          </span>
                        </div>
                      ) : (
                        msg.paragraphs.map((p, idx) => {
                          const isLastStreamingPara =
                            msg.isStreaming && idx === msg.paragraphs.length - 1;
                          return (
                            <p
                              key={idx}
                              className="text-[16px] font-normal text-on-surface leading-[1.6] bangla-text"
                            >
                              {p}
                              {isLastStreamingPara && (
                                <span
                                  aria-hidden="true"
                                  data-testid="streaming-cursor"
                                  className="inline-block w-2 h-4 ml-1 align-middle bg-tertiary-container rounded-xs animate-pulse"
                                />
                              )}
                            </p>
                          );
                        })
                      )}

                      {msg.italicPrompt && (
                        <p className="text-[15px] font-normal text-on-surface-variant italic leading-[1.6] bangla-greeting">
                          {msg.italicPrompt}
                        </p>
                      )}
                    </div>

                    {/* PROMINENT INTERACTIVE: Memory Proposal Card */}
                    {msg.includesProposal && proposal.status !== 'dismissed' && (
                      <div
                        data-testid="memory-proposal-card"
                        className={`rounded-2xl p-6 shadow-md transition-all duration-300 ${
                          proposal.status === 'approved'
                            ? 'bg-tertiary-fixed/35'
                            : 'bg-surface-container'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-base">memory</span>
                            </div>
                            <div>
                              <span className="text-[18px] font-semibold text-primary">
                                Proposed Memory
                              </span>
                              <span className="text-[11px] font-medium text-on-surface-variant block">
                                AI Memory Formulation • Explicit Consent Required
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold">
                            User Consent Guard
                          </span>
                        </div>

                        {/* Proposed text box */}
                        <div className="mt-4 p-4 rounded-xl bg-surface-container-lowest shadow-sm">
                          {isEditingMemory ? (
                            <div className="space-y-3">
                              <label
                                htmlFor="edit-memory-textarea"
                                className="block text-[12px] font-medium text-primary bangla-text"
                              >
                                Edit the memory to capture your exact nuance / আপনার স্মৃতিটি সংশোধন করুন:
                              </label>
                              <textarea
                                id="edit-memory-textarea"
                                rows={3}
                                value={memoryDraft}
                                onChange={(e) => setMemoryDraft(e.target.value)}
                                className="w-full rounded-lg bg-surface-container-low p-3 text-[14px] text-on-surface outline-none focus:bg-surface-container"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveMemoryEdit}
                                  className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:bg-primary-container"
                                >
                                  Save Wording
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemoryDraft(proposal.text);
                                    setIsEditingMemory(false);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-[12px] font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p
                              data-testid="memory-text-display"
                              className="text-[15px] text-on-surface font-medium leading-relaxed"
                            >
                              &ldquo;{proposal.text}&rdquo;
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <span className="material-symbols-outlined text-sm text-tertiary-container">
                              lock_person
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              Associated contextual tags: {proposal.tags.join(' ')}
                            </span>
                          </div>
                        </div>

                        <p className="text-[13px] text-on-surface-variant mt-3 leading-relaxed">
                          This will only be remembered in future conversations if you approve it.
                          Never shared with peers, family, or public cloud model training datasets.
                        </p>

                        {proposal.status === 'pending' ? (
                          <div className="mt-5 flex flex-wrap items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => onApproveProposal(memoryDraft)}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-[12px] font-medium shadow-sm hover:bg-primary-container transition-all"
                            >
                              <span className="material-symbols-outlined text-base">
                                check_circle
                              </span>
                              <span>Approve &amp; Remember (User Consent)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingMemory(true)}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-[12px] font-medium hover:bg-surface-container-highest transition-all"
                            >
                              <span className="material-symbols-outlined text-base">edit_note</span>
                              <span>Edit Memory</span>
                            </button>
                            <button
                              type="button"
                              onClick={onDismissProposal}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-secondary hover:bg-secondary-fixed/50 text-[12px] font-medium transition-all"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                              <span>Dismiss &amp; Don&apos;t Save</span>
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 p-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-[12px] font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">check</span>
                            <span className="bangla-text">
                              স্মৃতি সংরক্ষিত হয়েছে • Securely stored in encrypted on-device
                              profile.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Footer: Timestamp + Listen/Stop Voice Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pl-1">
                      <span className="text-[11px] font-medium text-on-surface-variant">
                        {msg.timestamp}
                        {msg.statusLabel ? ` • ${msg.statusLabel}` : ''}
                      </span>

                      {msg.isStreaming ? (
                        <button
                          type="button"
                          onClick={onStopStreaming}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-secondary hover:bg-secondary-fixed/60 text-[11px] font-semibold transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">stop_circle</span>
                          <span>Stop</span>
                        </button>
                      ) : (
                        !msg.error &&
                        msg.paragraphs.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void speakMessage(
                                msg.id,
                                msg.paragraphs.join(' '),
                                msg.detectedLanguage
                              )
                            }
                            aria-label={
                              speakingMessageId === msg.id
                                ? 'Stop speaking reply'
                                : 'Listen to companion reply'
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                              speakingMessageId === msg.id
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {loadingSpeechId === msg.id
                                ? 'hourglass_top'
                                : speakingMessageId === msg.id
                                ? 'stop'
                                : 'volume_up'}
                            </span>
                            <span>
                              {loadingSpeechId === msg.id
                                ? 'Preparing voice...'
                                : speakingMessageId === msg.id
                                ? 'Speaking • Stop'
                                : 'Listen'}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Contextual Intent Pills */}
          <div className="pt-4 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              <span>Quick Intent Starters • দ্রুত সহায়তাকারী উত্তর</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_INTENTS.map((intent) => (
                <button
                  key={intent.label}
                  type="button"
                  onClick={() => handleFillIntent(intent.text)}
                  className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high text-[12px] font-medium transition-colors flex items-center gap-1.5"
                >
                  {intent.icon && (
                    <span className={`material-symbols-outlined text-sm ${intent.iconColor ?? ''}`}>
                      {intent.icon}
                    </span>
                  )}
                  <span className="bangla-text">{intent.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Composition Console */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-md space-y-3">
            {isRecording && (
              <div
                data-testid="voice-listening-banner"
                className="px-3.5 py-2.5 rounded-xl bg-secondary-fixed/50 text-on-secondary-fixed text-[12px] font-medium flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
                  <div className="flex items-center gap-1 h-4" aria-hidden="true">
                    <span className="wave-bar wave-bar-1 w-1 bg-primary rounded-full inline-block" />
                    <span className="wave-bar wave-bar-2 w-1 bg-tertiary-container rounded-full inline-block" />
                    <span className="wave-bar wave-bar-3 w-1 bg-secondary rounded-full inline-block" />
                    <span className="wave-bar wave-bar-4 w-1 bg-primary rounded-full inline-block" />
                  </div>
                  <span className="bangla-text">
                    Listening... Speak in Bangla, Banglish, or English
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => stopRecordingAndTranscribe(false)}
                    className="text-primary font-semibold hover:underline"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => stopRecordingAndTranscribe(true)}
                    className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-semibold"
                  >
                    Stop &amp; Send
                  </button>
                </div>
              </div>
            )}

            {isTranscribing && (
              <div className="px-3.5 py-2 rounded-xl bg-surface-container text-primary text-[12px] font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                <span>Transcribing your voice note with Gemini...</span>
              </div>
            )}

            {voiceNotice && (
              <div
                data-testid="voice-notice-banner"
                className="px-3.5 py-2 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed text-[12px] font-medium flex items-center justify-between gap-2"
              >
                <span>{voiceNotice}</span>
                <button
                  type="button"
                  onClick={() => setVoiceNotice(null)}
                  className="text-secondary font-semibold hover:underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                ref={inputRef}
                id="message-input"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Type here in Bangla, English or Banglish... (কী মনে হচ্ছে বলুন / How are you feeling right now?)"
                className="w-full bg-surface-container-low rounded-xl p-4 pr-32 text-[15px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all resize-none bangla-text"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  title={isRecording ? 'Stop Voice Recording' : 'Speak to SHONGI'}
                  aria-label={isRecording ? 'Stop Voice Recording' : 'Audio Companion Record'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                    isRecording
                      ? 'bg-secondary text-on-secondary animate-pulse'
                      : 'bg-surface-container hover:bg-secondary-fixed text-primary hover:text-on-secondary-fixed'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {isRecording ? 'stop' : 'mic'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!draft.trim() || isStreamingReply}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-[12px] font-medium shadow-sm hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span>{isStreamingReply ? 'Replying...' : 'Send'}</span>
                  <span className="material-symbols-outlined text-base">send</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-tertiary-container">
                  shield
                </span>
                <span className="text-[11px]">
                  Messages processed securely; never used for public AI training or commercial
                  targeting.
                </span>
              </div>
              <div className="flex items-center gap-3">
                {draftLanguage && (
                  <span
                    data-testid="detected-draft-language"
                    className="text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-surface-container bangla-text"
                  >
                    Reply language: {formatDetectedLanguageLabel(draftLanguage)}
                  </span>
                )}
                <span className="text-[11px] hidden md:inline">
                  Enter to send • Shift+Enter for new line
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right-Hand Contextual Sanctuary Side-Panel (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* Active Approved Memories Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">psychology</span>
                <span className="text-[18px] font-semibold text-on-surface">
                  Active Approved Memories
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold">
                In Context
              </span>
            </div>

            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              The companion only recalls facts you explicitly ratified. These guide current
              empathetic tone:
            </p>

            <div className="flex flex-col gap-2.5 pt-1" data-testid="approved-memories-list">
              {memories.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-container-low text-[13px] text-on-surface-variant">
                  No active memories stored. Approve a proposal or add preferences in Privacy Hub.
                </div>
              ) : (
                memories.map((mem) => (
                  <div
                    key={mem.id}
                    className={`p-3 rounded-xl flex items-start justify-between gap-3 ${
                      mem.isNew
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                        : 'bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-sm text-tertiary-container mt-1">
                        check_circle
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium leading-snug">{mem.text}</span>
                        <span
                          className={`text-[11px] ${
                            mem.isNew ? 'text-on-tertiary-fixed-variant' : 'text-on-surface-variant'
                          }`}
                        >
                          {mem.meta}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveMemory(mem.id)}
                      aria-label={`Remove memory: ${mem.text}`}
                      title="Remove memory"
                      className="text-on-surface-variant hover:text-secondary text-sm shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onNavigate('privacy-memory-hub')}
                className="inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-on-secondary-fixed-variant font-medium"
              >
                <span>Manage in Privacy Hub</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
              <span className="text-[11px] text-on-surface-variant font-medium tabular-nums">
                {formatMemoryUsage(memories.length, MAX_APPROVED_MEMORIES)}
              </span>
            </div>
          </div>

          {/* Human Connection Bridge (Peer Pilot Bridge) */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="w-24 h-24 rounded-full bg-secondary-fixed/40 absolute -right-6 -bottom-6 blur-xl pointer-events-none" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-base">diversity_1</span>
              </div>
              <div>
                <span className="text-[18px] font-semibold text-on-surface">
                  Bridge to Human Support
                </span>
                <span className="text-[11px] text-secondary font-semibold block">
                  Human connection is the solution
                </span>
              </div>
            </div>

            <div className="relative w-full h-36 rounded-xl overflow-hidden shadow-sm">
              <ResilientImage
                src={SHONGI_IMAGES.peerStudentsBench}
                alt="Two young Bangladeshi university students sitting on a wooden bench speaking warmly with supportive smiles"
                fallbackLabel="12 Vetted Admission Alumni Active"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent flex items-end p-3.5">
                <span className="text-[11px] font-semibold text-on-primary">
                  12 Vetted Admission Alumni Active
                </span>
              </div>
            </div>

            <p className="text-[15px] text-on-surface leading-relaxed">
              Feeling like talking to someone who survived admission stress?
            </p>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              12 trained peer listeners from IBA, DU, and BUET are online now in anonymous,
              confidential 1-on-1 audio or text circles.
            </p>

            <div className="pt-1 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('peer-pilot')}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-secondary text-on-secondary text-[12px] font-semibold hover:bg-on-secondary-fixed-variant shadow-sm transition-all text-center"
              >
                <span className="material-symbols-outlined text-base">forum</span>
                <span>Explore Peer Pilot</span>
              </button>
              <span className="text-[11px] text-on-surface-variant text-center">
                Free • Safe pseudonym used • Zero academic pressure
              </span>
            </div>
          </div>

          {/* Quick Mood Pulse & Reset */}
          <div className="bg-surface-container-low rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-on-surface font-medium">Session Rhythm</span>
              <span className="text-[11px] text-tertiary-container font-semibold">
                {language === 'bn' ? '২২ মি. সক্রিয়' : '22m active'}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Emotional Grounding Level</span>
                <span className="text-primary font-semibold tabular-nums">Calming (+34%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                <div className="h-full bg-tertiary-container rounded-full w-2/3 transition-all duration-500" />
              </div>
            </div>

            {confirmingPurge ? (
              <div className="pt-2 flex items-center justify-between gap-2 bg-error-container/40 p-2.5 rounded-xl">
                <span className="text-[11px] font-medium text-on-error-container">
                  Purge dialogue thread?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onPurgeMessages();
                      setConfirmingPurge(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-secondary text-on-secondary text-[11px] font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingPurge(false)}
                    className="px-2.5 py-1 rounded-lg bg-surface text-on-surface text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex items-center justify-between text-on-surface-variant">
                <button
                  type="button"
                  onClick={() => setConfirmingPurge(true)}
                  className="text-[11px] font-semibold text-secondary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  <span>Purge Current Screen</span>
                </button>
                <span className="text-[11px]">Offline Local Encrypted</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Re-export helper so TypeScript sees usage if needed
export { generateCompanionReply };
