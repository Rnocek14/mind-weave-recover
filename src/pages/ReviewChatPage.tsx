import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mic, MicOff, ThumbsUp, ThumbsDown, SkipForward, CheckCircle2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKidsMode } from "@/contexts/KidsModeContext";
import { getTodaysPracticedWords, clearReviewedWords } from "@/lib/reviewQueue";
import { recordTransferEvent, getCarryoverPriorityWords } from "@/lib/transferLedger";
import {
  startReview,
  onUserUtterance,
  onRepairAnswer,
  onSkipTopic,
  onFinishRequest,
  onSilence,
  onCuedProduction,
  summarize,
  type ReviewState,
  type ReviewEvent,
  type ReviewSummary,
} from "@/lib/reviewConversation";

/**
 * Review Chat — the post-practice transfer conversation (Phase 1 of the
 * transfer engine). A thin UI over the pure reviewConversation state machine:
 * the engine owns every conversational decision; this layer owns TTS, ASR,
 * silence timing, and the escape hatches.
 *
 * Discipline carried over from the rest of the app:
 *  - TTS echo lock: Maya's own voice can never be scored as the patient's.
 *  - Multi-hypothesis deciphering: all ASR alternates reach the engine.
 *  - Repair answers accept BOTH speech ("yes") and big-button taps.
 *  - Escape hatches are always visible. Nobody is ever trapped in a chat.
 *  - Device-local: no DB writes until the transfer metric is validated.
 */

const SILENCE_TIMEOUT_MS = 12000;
const TTS_ECHO_TAIL_MS = 900;

function speakLine(text: string, echoLockRef: { current: number }, kidVoice: boolean) {
  const lock = (ms: number) => {
    echoLockRef.current = Math.max(echoLockRef.current, Date.now() + ms);
  };
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    lock(Math.max(2000, text.length * 85) + TTS_ECHO_TAIL_MS);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = kidVoice ? 0.9 : 0.85; // slow, clear speech for aphasia
    u.pitch = kidVoice ? 1.2 : 1.0;
    u.onend = () => lock(TTS_ECHO_TAIL_MS);
    u.onerror = () => lock(TTS_ECHO_TAIL_MS);
    synth.speak(u);
  } catch {
    /* no TTS — text carries the conversation */
  }
}

export default function ReviewChatPage() {
  const navigate = useNavigate();
  const { kidsMode } = useKidsMode();

  // CLOSED LOOP: today's practiced words + up to 2 carryover-priority words
  // (fading/lost per the transfer ledger) that need conversational retrieval
  // even though they weren't practiced today. The re-practice signal is
  // real-world usage decay, not quiz scores.
  const practiced = useMemo(() => {
    const todays = getTodaysPracticedWords();
    const todaysSet = new Set(todays.map((p) => p.word));
    const carryover = getCarryoverPriorityWords(2)
      .filter((c) => !todaysSet.has(c.word))
      .map((c) => ({ word: c.word, category: c.category, struggled: c.status === "lost", day: "" }));
    return [...todays, ...carryover];
  }, []);
  const [engineState, setEngineState] = useState<ReviewState | null>(null);
  const [mayaLine, setMayaLine] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const echoLockRef = useRef(0);
  const stateRef = useRef<ReviewState | null>(null);
  stateRef.current = engineState;
  const silenceTimerRef = useRef<number | null>(null);

  const applyTurn = useCallback(
    (turn: { state: ReviewState; mayaLine: string; events: ReviewEvent[] }) => {
      // No-op turns (noise, duplicate ASR finals, inert input) must not
      // re-render state — a re-render re-arms the silence timer, and ambient
      // noise would otherwise keep the conversation from ever moving forward.
      if (!turn.mayaLine && turn.events.length === 0) return;
      setEngineState({ ...turn.state });
      if (turn.mayaLine) {
        setMayaLine(turn.mayaLine);
        speakLine(turn.mayaLine, echoLockRef, kidsMode);
      }
      // Feed the transfer ledger: every conversational outcome becomes a
      // point on that word's carryover curve.
      for (const e of turn.events) {
        if (
          e.type === "spontaneous_use" ||
          e.type === "elicited_use" ||
          e.type === "cued_use" ||
          e.type === "item_released"
        ) {
          const item = turn.state.items.find((i) => i.word === e.word);
          const tier =
            e.type === "spontaneous_use" ? "spontaneous"
            : e.type === "elicited_use" ? "elicited"
            : e.type === "cued_use" ? "cued"
            : "released";
          recordTransferEvent(e.word, item?.category ?? "generic", tier);
        }
      }
      const complete = turn.events.find((e) => e.type === "review_complete");
      if (complete && complete.type === "review_complete") {
        setSummary(complete.summary);
        clearReviewedWords(turn.state.items.map((i) => i.word));
      }
      if (turn.events.some((e) => e.type === "spontaneous_use")) {
        setCelebrating(true);
        window.setTimeout(() => setCelebrating(false), 2500);
      }
    },
    [kidsMode],
  );

  // ── Speech in ────────────────────────────────────────────────────────────
  const handleSpeech = useCallback(
    (transcript: string) => {
      const s = stateRef.current;
      if (!s || s.phase === "done") return;
      if (Date.now() < echoLockRef.current) return; // Maya's own voice
      setHeard(transcript);
      const rec = getLastRecognitionRef.current?.();
      const alternatives = rec?.transcript === transcript.trim().toLowerCase() ? rec.alternatives : [];
      const confidence = rec?.transcript === transcript.trim().toLowerCase() ? rec.confidence : null;
      applyTurn(onUserUtterance(s, transcript, alternatives, confidence));
    },
    [applyTurn],
  );

  const {
    isListening,
    startListening,
    stopListening,
    isSupported,
    error: speechError,
    getLastRecognition,
  } = useSpeechRecognition({
    onResult: handleSpeech,
    autoStart: false,
    continuousListening: true,
    patientMode: true,
    enabled: engineState !== null && engineState.phase !== "done",
  });
  const getLastRecognitionRef = useRef<typeof getLastRecognition | null>(null);
  getLastRecognitionRef.current = getLastRecognition;

  const micBlocked =
    !isSupported ||
    (speechError ?? "").toLowerCase().includes("denied") ||
    (speechError ?? "").toLowerCase().includes("not-allowed");

  useEffect(() => {
    if (engineState && engineState.phase !== "done" && !micBlocked && !isListening) startListening();
    if ((!engineState || engineState.phase === "done") && isListening) stopListening();
  }, [engineState, micBlocked, isListening, startListening, stopListening]);

  // ── Silence handling (engine-driven forward motion) ──────────────────────
  // The patient's silence window must not start until Maya has FINISHED
  // speaking: slow responders who politely wait for her to finish must get
  // the full window. On fire, if the echo lock was still recently active,
  // re-arm for the remaining time instead of stealing the turn.
  useEffect(() => {
    if (!engineState || engineState.phase === "done" || micBlocked) return;

    const arm = (delay: number) => {
      silenceTimerRef.current = window.setTimeout(() => {
        const s = stateRef.current;
        if (!s || s.phase === "done") return;
        const sinceLockLifted = Date.now() - echoLockRef.current;
        if (sinceLockLifted < SILENCE_TIMEOUT_MS) {
          arm(SILENCE_TIMEOUT_MS - Math.max(0, sinceLockLifted));
          return;
        }
        applyTurn(onSilence(s));
      }, delay);
    };

    const untilLockLifts = Math.max(0, echoLockRef.current - Date.now());
    arm(untilLockLifts + SILENCE_TIMEOUT_MS);
    return () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    };
  }, [engineState, micBlocked, applyTurn]);

  // ── Start / teardown ─────────────────────────────────────────────────────
  const begin = () => applyTurn(startReview(practiced));
  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const inRepair = engineState?.phase === "repair";
  const done = engineState?.phase === "done";

  // ── Empty queue: friendly redirect, never a dead screen ──────────────────
  if (practiced.length === 0) {
    return (
      <div className="min-h-dvh bg-gradient-calm flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl" aria-hidden>💬</div>
        <h1 className="text-xl font-bold">Nothing to review yet</h1>
        <p className="text-muted-foreground max-w-xs">
          Play a naming game first — then come back and we&apos;ll chat about the words you practiced.
        </p>
        <Button onClick={() => navigate("/practice")}>Go to Practice</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-calm flex flex-col items-center px-4 py-6">
      {/* Header with the always-visible exit */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {engineState && !done && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => stateRef.current && applyTurn(onFinishRequest(stateRef.current))}
          >
            All done <CheckCircle2 className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {/* ── Not started ── */}
      {!engineState && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center max-w-sm">
          <div className="text-6xl" aria-hidden>💬</div>
          <h1 className="text-2xl font-bold text-primary">Quick chat about today&apos;s words</h1>
          <p className="text-foreground/80">
            A short conversation with Maya — {Math.min(practiced.length, 4)} words, a few minutes.
            Just talk naturally.
          </p>
          <Button size="lg" className="text-lg font-bold rounded-2xl px-8" onClick={begin}>
            Start the chat
          </Button>
        </div>
      )}

      {/* ── Conversation ── */}
      {engineState && !done && (
        <div className="flex-1 w-full max-w-md flex flex-col items-center gap-5">
          {/* Maya */}
          <div className={`text-6xl ${celebrating ? "kids-pet-evolve" : "kids-pet-idle"}`} aria-hidden>
            {celebrating ? "🤩" : "🙂"}
          </div>
          <Card className="w-full p-5 rounded-3xl" aria-live="polite">
            <p className="text-lg sm:text-xl font-medium text-foreground text-center leading-relaxed">
              {mayaLine}
            </p>
          </Card>

          {/* Repair: big yes/no — taps always work even when speech doesn't */}
          {inRepair && (
            <div className="flex gap-4">
              <Button
                size="lg"
                className="rounded-2xl text-lg font-bold gap-2 px-8"
                onClick={() => stateRef.current && applyTurn(onRepairAnswer(stateRef.current, true))}
              >
                <ThumbsUp className="w-5 h-5" /> Yes
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-2xl text-lg font-bold gap-2 px-8"
                onClick={() => stateRef.current && applyTurn(onRepairAnswer(stateRef.current, false))}
              >
                <ThumbsDown className="w-5 h-5" /> No
              </Button>
            </div>
          )}

          {/* Mic-blocked participation: say it aloud, then self-report. The
              production is real speech we couldn't verify — scored as cued
              (same honest tier as any modeled/unverified production). */}
          {micBlocked && !inRepair && engineState.activeItem >= 0 && (
            <Button
              size="lg"
              className="rounded-2xl text-lg font-bold gap-2 px-8"
              onClick={() => stateRef.current && applyTurn(onCuedProduction(stateRef.current))}
            >
              🗣️ I said “{engineState.items[engineState.activeItem]?.word}”
            </Button>
          )}

          {/* Mic + heard feedback */}
          <div className="flex flex-col items-center gap-1.5">
            {micBlocked ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MicOff className="w-4 h-4" /> Mic unavailable — say the words out loud, then tap
              </p>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mic className={`w-4 h-4 ${isListening ? "text-primary kids-mic-live" : ""}`} />
                {isListening ? "Maya is listening..." : "Warming up the mic..."}
              </p>
            )}
            {heard && <p className="text-xs text-muted-foreground/70" aria-live="polite">Heard: “{heard}”</p>}
          </div>

          {/* Escape hatch: change topic */}
          {!inRepair && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-auto text-muted-foreground"
              onClick={() => stateRef.current && applyTurn(onSkipTopic(stateRef.current))}
            >
              <SkipForward className="w-4 h-4 mr-1" /> New topic
            </Button>
          )}
        </div>
      )}

      {/* ── Done: the transfer summary ── */}
      {done && engineState && (
        <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-5 text-center">
          <div className="text-6xl" aria-hidden>🎉</div>
          <h1 className="text-2xl font-bold text-primary">Nice chat!</h1>
          <Card className="w-full p-5 rounded-3xl space-y-2 text-left">
            {(summary ?? summarize(engineState)).spontaneous > 0 && (
              <p className="font-semibold text-secondary">
                ⭐ {(summary ?? summarize(engineState)).spontaneous} word
                {(summary ?? summarize(engineState)).spontaneous === 1 ? "" : "s"} used all on your own
                — you found them without any help.
              </p>
            )}
            {(summary ?? summarize(engineState)).elicited > 0 && (
              <p>💬 {(summary ?? summarize(engineState)).elicited} found in conversation</p>
            )}
            {(summary ?? summarize(engineState)).cued > 0 && (
              <p>🔤 {(summary ?? summarize(engineState)).cued} with a little help</p>
            )}
            {(summary ?? summarize(engineState)).released > 0 && (
              <p className="text-muted-foreground">
                🌱 {(summary ?? summarize(engineState)).released} saved for next time — no pressure.
              </p>
            )}
          </Card>
          <Button size="lg" className="rounded-2xl text-lg font-bold" onClick={() => navigate("/practice")}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
