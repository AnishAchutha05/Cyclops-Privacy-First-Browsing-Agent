/**
 * VoiceInput.tsx
 *
 * Ports the Cyclops_Training voice engine into a React component.
 * Uses the Web Speech API (SpeechRecognition) with:
 *  - Continuous + interim results
 *  - Indian-English (en-IN) tuning — mirrors Cyclops_Training/content-voice.js
 *  - Keep-alive restart on session end
 *
 * Props:
 *   onTranscript(text) — called with the confirmed transcript text
 *   onClose()         — called when the modal is dismissed
 */

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Check } from "lucide-react";

/* ── Type shims for Web Speech API ─────────────────────
   SpeechRecognition is available in Chrome but the tsconfig
   `lib` doesn't include dom.speech, so we define minimal types. */

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultEntry {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResultEntry;
  [index: number]: SpeechRecognitionResultEntry;
  resultIndex: number;
}

interface SpeechRecognitionEventShim extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventShim extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEventShim) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventShim) => void) | null;
  onend: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface WindowWithSpeech {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

function getSpeechConstructor():
  | (new () => SpeechRecognitionInstance)
  | undefined {
  const w = window as unknown as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/* ── Props ───────────────────────────────────────────── */

interface Props {
  onTranscript: (text: string) => void;
  onClose: () => void;
}

type VoiceState = "idle" | "listening" | "error";

/* ── Component ───────────────────────────────────────── */

export default function VoiceInput({ onTranscript, onClose }: Props) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const keepAliveRef = useRef(false);
  const finalAccumulatorRef = useRef("");

  const SpeechConstructor = getSpeechConstructor();
  const supported = !!SpeechConstructor;

  /* ── Start ────────────────────────────────────────── */

  function startListening() {
    if (!SpeechConstructor) return;

    finalAccumulatorRef.current = "";
    setFinalText("");
    setInterimText("");
    setErrorMsg("");
    keepAliveRef.current = true;

    const recognition = new SpeechConstructor();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Indian-English — mirrors Cyclops_Training
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setVoiceState("listening");

    recognition.onresult = (event: SpeechRecognitionEventShim) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalAccumulatorRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      setFinalText(finalAccumulatorRef.current);
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventShim) => {
      const msg =
        event.error === "not-allowed"
          ? "Microphone access denied. Please allow mic in browser settings."
          : `Voice error: ${event.error}`;
      setErrorMsg(msg);
      setVoiceState("error");
      keepAliveRef.current = false;
    };

    recognition.onend = () => {
      if (keepAliveRef.current) {
        // Keep-alive restart — matches Cyclops_Training/content-voice.js
        try {
          recognition.start();
        } catch (_) {
          /* already restarting */
        }
      } else {
        setVoiceState("idle");
      }
    };

    recognition.start();
  }

  /* ── Stop ─────────────────────────────────────────── */

  function stopListening() {
    keepAliveRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch (_) {
      /* ignore */
    }
    setVoiceState("idle");
    setInterimText("");
  }

  /* ── Confirm ──────────────────────────────────────── */

  function handleConfirm() {
    const text = finalAccumulatorRef.current.trim();
    if (text) onTranscript(text);
    stopListening();
    onClose();
  }

  /* ── Cleanup on unmount ───────────────────────────── */

  useEffect(() => {
    return () => {
      keepAliveRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  /* ── Render ───────────────────────────────────────── */

  return (
    <div
      className="voice-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Voice Input"
    >
      <div className="voice-modal">
        {/* Header */}
        <div className="voice-modal-header">
          <span className="section-label">VOICE INPUT</span>
          <button
            type="button"
            className="voice-modal-close"
            onClick={() => {
              stopListening();
              onClose();
            }}
            aria-label="Close voice input"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status */}
        <div className={`voice-status-badge voice-status-${voiceState}`}>
          <span className="voice-indicator-dot" />
          <span>
            {voiceState === "listening"
              ? "LISTENING (en-IN)..."
              : voiceState === "error"
                ? "MIC ERROR"
                : "READY"}
          </span>
        </div>

        {/* Transcript terminal */}
        <div className="voice-terminal" aria-live="polite">
          {!supported ? (
            <span className="voice-unsupported">
              Web Speech API is not supported in this browser.
            </span>
          ) : errorMsg ? (
            <span className="voice-error-text">{errorMsg}</span>
          ) : finalText || interimText ? (
            <>
              <span className="voice-final">{finalText}</span>
              <span className="voice-interim">{interimText}</span>
            </>
          ) : (
            <span className="voice-hint">
              {voiceState === "listening"
                ? "Speak clearly now..."
                : "Click Start to begin voice input."}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="voice-controls">
          {voiceState !== "listening" ? (
            <button
              type="button"
              className="voice-start-button"
              onClick={startListening}
              disabled={!supported}
            >
              <Mic size={15} />
              START LISTENING
            </button>
          ) : (
            <button
              type="button"
              className="voice-stop-button"
              onClick={stopListening}
            >
              <MicOff size={15} />
              STOP
            </button>
          )}

          <button
            type="button"
            className="voice-confirm-button"
            onClick={handleConfirm}
            disabled={!finalText.trim()}
          >
            <Check size={15} />
            USE TEXT
          </button>
        </div>
      </div>
    </div>
  );
}
