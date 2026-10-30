import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mic, MicOff, Volume2, Lightbulb, SkipForward, CheckCircle2 } from "lucide-react";
import { useSpeechRecognition, type RecognitionDetail } from "@/hooks/useSpeechRecognition";
import { resolveReviewSessionId } from "@/lib/reviewRouteScope";
import { getPresentedFunctionalScripts } from "@/lib/scriptPracticeQueue";
import {
  FUNCTIONAL_SCRIPTS,
  startFunctionalProbe,
  receiveProbeTranscript,
  confirmProbeHearing,
  requestProbeHint,
  skipFunctionalContext,
  reportUnverifiedProbeAttempt,
  summarizeFunctionalProbe,
  type FunctionalProbeState,
  type FunctionalScriptId,
} from "@/lib/functionalTransfer";

/**
 * Opt-in, experimental practice only. The two conversations use different
 * situations but NOT a generative AI partner or a validated transfer rubric.
 * The browser transcript is shown for patient confirmation before any in-app
 * lexical candidate is recorded. No recordings, transcripts or outcomes are
 * sent to a database; clinical/game progression is completely unchanged.
 */
export default function FunctionalTransferPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const lessonId = resolveReviewSessionId(location.search, location.state);
  const offered = useMemo(() => getPresentedFunctionalScripts(lessonId), [lessonId]);
  const [selectedId, setSelectedId] = useState<FunctionalScriptId | null>(
    () => offered[0]?.scriptId ?? null,
  );
  const [probe, setProbe] = useState<FunctionalProbeState | null>(null);
  const [heard, setHeard] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const stateRef = useRef<FunctionalProbeState | null>(null);
  stateRef.current = probe;
  const readingRef = useRef(false);
  const echoGuardUntilRef = useRef(0);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const recognitionRef = useRef<(() => RecognitionDetail | null) | null>(null);
  const lastAutoReadRef = useRef<string>("");

  const apply = useCallback((next: FunctionalProbeState) => {
    stateRef.current = next;
    setProbe(next);
    setHeard(next.pendingTranscript ?? "");
  }, []);

  const handleSpeech = useCallback((transcript: string) => {
    const current = stateRef.current;
    if (!current || current.phase !== "asking") return;
    if (readingRef.current || Date.now() < echoGuardUntilRef.current) return;
    const recognition = recognitionRef.current?.();
    const confidence = recognition?.transcript === transcript.trim().toLowerCase()
      ? recognition.confidence : null;
    const next = receiveProbeTranscript(current, transcript, confidence);
    if (next === current) return;
    // Claim the context synchronously so a second final cannot move ahead.
    stateRef.current = next;
    setProbe(next);
    setHeard(next.pendingTranscript ?? "");
    stopListeningRef.current?.();
  }, []);

  const {
    isListening, startListening, stopListening, resetTranscript,
    isSupported, error: micError, getLastRecognition,
  } = useSpeechRecognition({
    onResult: handleSpeech,
    autoStart: false,
    continuousListening: false,
    patientMode: false,
    enabled: probe !== null && probe.phase === "asking",
  });
  stopListeningRef.current = stopListening;
  recognitionRef.current = getLastRecognition;

  const micBlocked = !isSupported || /denied|not-allowed|permission/i.test(micError ?? "");

  const readAloud = useCallback((line: string) => {
    if (!line || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    // Explicit mic ownership: never listen while Maya reads the prompt/hint.
    stopListeningRef.current?.();
    window.speechSynthesis.cancel();
    readingRef.current = true;
    setSpeaking(true);
    echoGuardUntilRef.current = Date.now() + Math.max(3000, line.length * 100) + 900;
    try {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = 0.85;
      utterance.onend = () => {
        echoGuardUntilRef.current = Date.now() + 900;
        readingRef.current = false;
        setSpeaking(false);
      };
      utterance.onerror = () => {
        echoGuardUntilRef.current = Date.now() + 900;
        readingRef.current = false;
        setSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      readingRef.current = false;
      setSpeaking(false);
    }
  }, []);

  useEffect(() => {
    if (!probe || probe.phase !== "asking") return;
    const key = `${probe.scriptId}:${probe.contextIndex}`;
    if (lastAutoReadRef.current === key) return;
    lastAutoReadRef.current = key;
    const scene = FUNCTIONAL_SCRIPTS[probe.scriptId].contexts[probe.contextIndex];
    if (scene) readAloud(scene.prompt);
  }, [probe, readAloud]);

  useEffect(() => () => {
    readingRef.current = false;
    stopListeningRef.current?.();
    window.speechSynthesis?.cancel();
  }, []);

  const start = () => {
    if (!selectedId || !offered.some(item => item.scriptId === selectedId)) return;
    stopListening();
    setHeard("");
    lastAutoReadRef.current = "";
    apply(startFunctionalProbe(selectedId));
  };

  const beginListening = () => {
    if (!probe || probe.phase !== "asking" || micBlocked || speaking ||
      readingRef.current || Date.now() < echoGuardUntilRef.current) return;
    resetTranscript();
    setHeard("");
    startListening();
  };

  const onHint = () => {
    const s = stateRef.current;
    if (!s) return;
    const next = requestProbeHint(s);
    if (next === s) return;
    apply(next);
    readAloud(FUNCTIONAL_SCRIPTS[next.scriptId].hints[next.supportLevel - 1]);
  };

  const onConfirm = (yes: boolean) => {
    const s = stateRef.current;
    if (!s) return;
    apply(confirmProbeHearing(s, yes));
  };

  const endContext = (kind: "skip" | "unverified") => {
    const s = stateRef.current;
    if (!s) return;
    stopListening();
    apply(kind === "skip" ? skipFunctionalContext(s) : reportUnverifiedProbeAttempt(s));
  };

  const available = [...new Set(offered.map(item => item.scriptId))];
  const script = probe ? FUNCTIONAL_SCRIPTS[probe.scriptId] : null;
  const scene = probe && script ? script.contexts[probe.contextIndex] : null;
  const results = probe?.phase === "done" ? summarizeFunctionalProbe(probe) : null;

  if (!offered.length) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-5 text-center">
        <h1 className="text-2xl font-bold">No phrase practice to review</h1>
        <p className="max-w-sm text-muted-foreground">
          Finish Phrase Practice in a lesson first. This chat only uses phrases from that same lesson.
        </p>
        <Button size="lg" onClick={() => navigate("/practice")}>Back to practice</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-5 gap-5">
      <div className="w-full max-w-md flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">Optional Maya practice</span>
      </div>

      {!probe && (
        <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-5 text-center">
          <span className="text-5xl" aria-hidden>💬</span>
          <h1 className="text-2xl font-bold">Use it in a conversation</h1>
          <p className="text-lg">
            Try a phrase from your games in two everyday situations. Maya will help if you need it.
          </p>
          {available.length > 1 && (
            <div className="w-full flex flex-col gap-2" role="group" aria-label="Choose a phrase">
              {available.map(id => (
                <Button key={id} size="lg" variant={selectedId === id ? "default" : "outline"}
                  onClick={() => setSelectedId(id)}>
                  {FUNCTIONAL_SCRIPTS[id].title}
                </Button>
              ))}
            </div>
          )}
          {selectedId && <p className="text-muted-foreground">{FUNCTIONAL_SCRIPTS[selectedId].title}</p>}
          <Button size="lg" className="w-full min-h-16 text-xl" onClick={start}>Start</Button>
        </div>
      )}

      {probe && probe.phase !== "done" && script && scene && (
        <div className="w-full max-w-md flex-1 flex flex-col gap-5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Situation {probe.contextIndex + 1} of 2</p>
            <h1 className="text-xl font-bold">{script.title}</h1>
          </div>
          <Card className="p-6 space-y-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Maya · {scene.partner}</p>
            <p className="text-xl leading-relaxed" aria-live="polite">{scene.prompt}</p>
            <Button variant="outline" size="lg" className="w-full min-h-14"
              onClick={() => readAloud(scene.prompt)}>
              <Volume2 className="w-5 h-5 mr-2" /> Hear it again
            </Button>
          </Card>

          {probe.phase === "confirm_heard" ? (
            <Card className="p-5 space-y-5">
              <p className="text-xl font-semibold">Did Maya hear you correctly?</p>
              <p className="text-lg" aria-live="polite">“{heard}”</p>
              <div className="grid grid-cols-2 gap-3">
                <Button className="min-h-16 text-xl" size="lg" onClick={() => onConfirm(true)}>Yes</Button>
                <Button className="min-h-16 text-xl" size="lg" variant="outline"
                  onClick={() => onConfirm(false)}>No</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Saying yes only confirms the words shown. It does not grade your communication.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-full min-h-16 text-xl"
                disabled={micBlocked || speaking}
                onClick={() => isListening ? stopListening() : beginListening()}>
                {isListening
                  ? <><Mic className="w-6 h-6 mr-2" /> Stop listening</>
                  : <><Mic className="w-6 h-6 mr-2" /> Speak</>}
              </Button>
              {micBlocked && (
                <p className="text-sm text-muted-foreground text-center">
                  <MicOff className="inline w-4 h-4 mr-1" />
                  Microphone unavailable. Your practice still counts as participation.
                </p>
              )}
              {speaking && <p className="text-sm text-muted-foreground text-center">Maya is speaking…</p>}
              <Button variant="outline" size="lg" className="min-h-14"
                disabled={probe.supportLevel >= 2} onClick={onHint}>
                <Lightbulb className="w-5 h-5 mr-2" />
                {probe.supportLevel >= 2 ? "All hints shown" : "Give me a hint"}
              </Button>
              {probe.supportLevel > 0 && (
                <p className="text-base text-center" aria-live="polite">
                  {script.hints[probe.supportLevel - 1]}
                </p>
              )}
              {micBlocked && (
                <Button variant="outline" size="lg" className="min-h-14"
                  onClick={() => endContext("unverified")}>
                  I tried saying it
                </Button>
              )}
              <Button variant="ghost" size="lg" className="min-h-14"
                onClick={() => endContext("skip")}>
                <SkipForward className="w-5 h-5 mr-2" /> Skip this situation
              </Button>
            </div>
          )}
        </div>
      )}

      {probe?.phase === "done" && results && (
        <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-5 text-center">
          <CheckCircle2 className="w-14 h-14 text-primary" />
          <h1 className="text-2xl font-bold">Conversation practice complete</h1>
          <Card className="w-full p-5 text-left space-y-3">
            <p>{results.contextsTried} short situations practiced</p>
            <p>{results.unpromptedCandidates} possible responses matched before hints</p>
            <p>{results.supportedCandidates} possible responses matched with hints</p>
            <p>{results.needsReview} responses not classified by this early prototype</p>
            <p>{results.unverifiedOrSkipped} unverified or skipped attempts</p>
          </Card>
          <p className="text-sm text-muted-foreground">
            These are unvalidated, in-app observations. A clinician or communication partner
            must evaluate actual message understanding and real-world transfer.
          </p>
          <Button size="lg" className="w-full min-h-16 text-xl"
            onClick={() => navigate("/practice")}>Done</Button>
        </div>
      )}
    </div>
  );
}
