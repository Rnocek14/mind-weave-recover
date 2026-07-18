import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useKidsMode } from "@/contexts/KidsModeContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKidsSounds } from "@/hooks/useKidsSounds";
import { getKidsPhotoTrials, getKidsPraise } from "@/data/kidsContent";
import { matchAnswer } from "@/lib/answerMatcher";
import { KidsCelebration } from "@/components/KidsCelebration";
import { PetDisplay } from "@/components/kids/PetDisplay";
import { awardPetXp, loadPet, type KidsPetState } from "@/lib/kidsPet";
import type { PhotoTrial } from "@/data/photoBank";

/**
 * Feed the Monster — Kids Mode voice-controlled mini-game (Phase 1 prototype).
 *
 * The inversion this prototypes: SPEECH IS THE CONTROLLER. Saying the word
 * is not an answer that gets graded — it's the action that feeds the monster.
 * Repetition is driven by wanting the effect, not by being asked to retry.
 *
 * Design constraints, deliberately:
 *  - Kids Mode ONLY. Adult mode redirects to /practice. No shared-code paths.
 *  - NO database writes, NO sessions, NO telemetry: device-local play until
 *    the pediatric consent story is resolved. The pet (localStorage) is the
 *    only persistence.
 *  - Never a dead end: mic-blocked or unsupported browsers get tap mode;
 *    stuck kids get a spoken model then a tap hint; a grown-up confirm chip
 *    accepts speech the ASR couldn't verify.
 *  - Short burst: 8 feeds ≈ 3-5 minutes.
 */

const ROUND_COUNT = 8;
const HINT_DELAY_MS = 7000;
const TAP_HINT_DELAY_MS = 14000;

type Phase = "intro" | "playing" | "chomping" | "done";
type FeedMethod = "spoken" | "grown_up" | "tapped";

/** Child-friendly TTS, separate from Maya's voice pipeline. */
/**
 * Echo-tail after TTS finishes before the mic scores again. Mirrors the
 * adult games' mic-lock: without this, the device speaker saying the target
 * word ("Can you say... apple?") is picked up by the mic and feeds the
 * monster from the app's own voice.
 */
const TTS_ECHO_TAIL_MS = 900;

function speakKid(text: string, echoLockRef?: { current: number }) {
  const lock = (ms: number) => {
    if (echoLockRef) echoLockRef.current = Math.max(echoLockRef.current, Date.now() + ms);
  };
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    // Pessimistic estimate up front (~90ms/char at our rate) in case the
    // engine never fires onend (some mobile browsers drop it).
    lock(Math.max(2000, text.length * 90) + TTS_ECHO_TAIL_MS);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.2;
    u.onend = () => lock(TTS_ECHO_TAIL_MS);
    u.onerror = () => lock(TTS_ECHO_TAIL_MS);
    synth.speak(u);
  } catch {
    /* no TTS — visuals carry the game */
  }
}

const MONSTER_REACTIONS = ["😋", "🤤", "😍", "🥳", "😆"];

export default function FeedTheMonsterExercise() {
  const navigate = useNavigate();
  const { kidsMode } = useKidsMode();
  const kidsSounds = useKidsSounds();

  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [feeds, setFeeds] = useState<FeedMethod[]>([]);
  const [showHintWord, setShowHintWord] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const [monsterReaction, setMonsterReaction] = useState<string | null>(null);
  const [praise, setPraise] = useState<string>("");
  const [pet, setPet] = useState<KidsPetState>(() => loadPet());
  const [petCelebrate, setPetCelebrate] = useState(false);

  // Momo happily munches food, objects, and clothing (monsters eating shoes
  // is classic kid comedy) — but never animals or body parts, which reads as
  // scary rather than silly to young kids.
  const trials = useMemo<PhotoTrial[]>(() => {
    const NOT_MONSTER_FOOD = new Set([
      "animals", "farm_animal", "wild_animal", "domestic_animal", "insect", "bird",
      "body", "body_part",
    ]);
    const pool = getKidsPhotoTrials(60).filter((t) => !NOT_MONSTER_FOOD.has(t.category));
    return pool.slice(0, ROUND_COUNT);
  }, []);
  const currentTrial = trials[roundIndex] ?? null;

  /** Timestamp until which the mic must ignore transcripts (TTS echo lock). */
  const echoLockRef = useRef(0);

  const phaseRef = useRef<Phase>("intro");
  phaseRef.current = phase;
  const roundRef = useRef(0);
  roundRef.current = roundIndex;
  const hintTimerRef = useRef<number | null>(null);
  const tapHintTimerRef = useRef<number | null>(null);

  // ── Feeding (single path for all input methods) ──────────────────────────
  const feed = useCallback(
    (method: FeedMethod) => {
      if (phaseRef.current !== "playing") return;
      const trial = trials[roundRef.current];
      if (!trial) return;

      setPhase("chomping");
      setShowHintWord(false);
      setShowTapHint(false);
      setMonsterReaction(MONSTER_REACTIONS[Math.floor(Math.random() * MONSTER_REACTIONS.length)]);
      setPraise(getKidsPraise());
      setFeeds((prev) => [...prev, method]);
      kidsSounds.playKidsSuccess();
      speakKid(`Yum yum! ${trial.target}!`, echoLockRef);

      window.setTimeout(() => {
        const nextIndex = roundRef.current + 1;
        if (nextIndex >= trials.length) {
          finishGame([...feedsRef.current]);
        } else {
          setRoundIndex(nextIndex);
          setMonsterReaction(null);
          setPhase("playing");
        }
      }, 1800);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trials, kidsSounds],
  );

  // feeds ref for the finish closure (feed appends async)
  const feedsRef = useRef<FeedMethod[]>([]);
  useEffect(() => {
    feedsRef.current = feeds;
  }, [feeds]);

  const finishGame = useCallback(
    (allFeeds: FeedMethod[]) => {
      // Spoken feeds earn double pet XP — production is the therapeutic act.
      const xp = allFeeds.reduce((sum, m) => sum + (m === "spoken" || m === "grown_up" ? 2 : 1), 0);
      const result = awardPetXp(xp);
      setPet(result.pet);
      setPetCelebrate(result.leveledUp);
      setPhase("done");
      kidsSounds.playKidsFanfare();
      speakKid(
        result.leveledUp
          ? `Amazing! ${result.pet.name} grew into a ${result.stage.label}!`
          : `All done! ${result.pet.name} loved that!`,
        echoLockRef,
      );
    },
    [kidsSounds],
  );

  // ── Speech: the word IS the button ───────────────────────────────────────
  const handleSpeech = useCallback(
    (transcript: string) => {
      if (phaseRef.current !== "playing") return;
      // Echo lock: while Momo is talking (and for a short tail after), the
      // transcript is very likely the app's own voice — never score it.
      if (Date.now() < echoLockRef.current) return;
      const trial = trials[roundRef.current];
      if (!trial) return;

      const match = matchAnswer(
        transcript,
        trial.target,
        trial.semanticFoils,
        trial.category,
        trial.phonologicalFoils ?? [],
      );
      if (match.countsAsCorrect) {
        feed("spoken");
        return;
      }
      // Check the ASR's alternate hypotheses — for child speech the target
      // often hides in a lower-ranked hypothesis.
      const rec = getLastRecognitionRef.current?.();
      if (rec) {
        const t = trial.target.toLowerCase();
        const hit = rec.alternatives.some((a) => {
          const w = a.transcript.replace(/[^a-z' ]/g, "").trim();
          return w === t || w.split(/\s+/).includes(t);
        });
        if (hit) feed("spoken");
      }
    },
    [trials, feed],
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
    enabled: kidsMode && phase === "playing",
  });
  const getLastRecognitionRef = useRef<typeof getLastRecognition | null>(null);
  getLastRecognitionRef.current = getLastRecognition;

  const micBlocked =
    !isSupported || (speechError ?? "").toLowerCase().includes("denied") ||
    (speechError ?? "").toLowerCase().includes("not-allowed");

  // Keep the mic running during play
  useEffect(() => {
    if (phase === "playing" && !micBlocked && !isListening) {
      startListening();
    }
    if (phase !== "playing" && isListening) {
      stopListening();
    }
  }, [phase, micBlocked, isListening, startListening, stopListening]);

  // ── Per-round prompts + escalating help ──────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !currentTrial) return;
    setShowHintWord(false);
    setShowTapHint(micBlocked); // no mic → tapping is the game, hint immediately
    speakKid(`Momo is hungry! Can you say... ${currentTrial.target}?`, echoLockRef);

    hintTimerRef.current = window.setTimeout(() => {
      setShowHintWord(true);
      speakKid(`Say ${currentTrial.target}!`, echoLockRef);
    }, HINT_DELAY_MS);
    tapHintTimerRef.current = window.setTimeout(() => {
      setShowTapHint(true);
    }, TAP_HINT_DELAY_MS);

    return () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      if (tapHintTimerRef.current) window.clearTimeout(tapHintTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundIndex, micBlocked]);

  // Spoken intro for pre-readers: the screen must explain itself out loud,
  // not just in text (same reason the adult games speak their instructions).
  const introSpokenRef = useRef(false);
  useEffect(() => {
    if (phase !== "intro" || introSpokenRef.current || !kidsMode) return;
    introSpokenRef.current = true;
    const t = window.setTimeout(() => {
      speakKid(
        "Momo is SO hungry! Say the words out loud to feed him. Tap the big button to start!",
        echoLockRef,
      );
    }, 600);
    return () => window.clearTimeout(t);
  }, [phase, kidsMode]);

  // Cancel TTS when leaving
  useEffect(() => () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  // ── Adult mode: this page does not exist ─────────────────────────────────
  useEffect(() => {
    if (!kidsMode) navigate("/practice", { replace: true });
  }, [kidsMode, navigate]);
  if (!kidsMode) return null;

  const spokenCount = feeds.filter((m) => m === "spoken" || m === "grown_up").length;

  return (
    <div className="min-h-screen bg-gradient-calm flex flex-col items-center px-4 py-6">
      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center max-w-sm">
          <div className="text-8xl kids-monster-idle" role="img" aria-label="Momo the monster">👾</div>
          <h1 className="text-3xl font-bold text-primary">Momo is SO hungry!</h1>
          <p className="text-lg text-foreground/80">
            Say the food words out loud to feed Momo. Your words are magic!
          </p>
          <PetDisplay pet={pet} compact />
          <Button
            size="lg"
            className="text-xl font-bold rounded-3xl px-10 py-7"
            onClick={() => {
              setPhase("playing");
              speakKid("Let's feed Momo!", echoLockRef);
            }}
          >
            Let&apos;s Play! 🍽️
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
        </div>
      )}

      {/* ── Playing / chomping ── */}
      {(phase === "playing" || phase === "chomping") && currentTrial && (
        <div className="flex-1 w-full max-w-md flex flex-col items-center gap-4">
          {/* Feed progress: little plates */}
          <div className="flex gap-1" aria-label={`${feeds.length} of ${trials.length} foods eaten`}>
            {trials.map((_, i) => (
              <span key={i} aria-hidden className={i < feeds.length ? "text-xl" : "text-xl opacity-25 grayscale"}>
                🍽️
              </span>
            ))}
          </div>

          {/* The monster */}
          <div className="relative">
            <div
              className={`text-8xl ${phase === "chomping" ? "kids-monster-chomp" : "kids-monster-idle"}`}
              role="img"
              aria-label="Momo the monster"
            >
              {phase === "chomping" ? (monsterReaction ?? "😋") : "👾"}
            </div>
            {phase === "chomping" && <KidsCelebration burstKey={roundIndex} />}
          </div>

          {phase === "chomping" ? (
            <p className="text-2xl font-bold text-secondary min-h-[2.5rem]">{praise}</p>
          ) : (
            <p className="text-xl font-semibold text-foreground min-h-[2.5rem]">
              {showHintWord ? (
                <>Say <span className="text-primary font-extrabold text-2xl">“{currentTrial.target}”</span>!</>
              ) : (
                <>Momo wants this! What is it?</>
              )}
            </p>
          )}

          {/* The food — tappable as the always-available fallback */}
          <button
            onClick={() => phase === "playing" && feed("tapped")}
            className={`rounded-3xl overflow-hidden border-4 transition-all ${
              showTapHint && phase === "playing"
                ? "border-accent kids-tap-hint"
                : "border-primary/20"
            } ${phase === "chomping" ? "opacity-30 scale-75" : ""}`}
            aria-label={`Feed the ${currentTrial.target} to Momo`}
          >
            <img
              src={currentTrial.imageUrl}
              alt={currentTrial.target}
              className="w-52 h-52 sm:w-60 sm:h-60 object-cover"
            />
          </button>

          {/* Mic status — kid-legible */}
          {phase === "playing" && (
            micBlocked ? (
              <p className="text-sm text-muted-foreground">🖐️ Tap the food to feed Momo!</p>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <span className={isListening ? "kids-mic-live" : ""} aria-hidden>🎤</span>
                {isListening ? "Momo is listening..." : "Getting ears ready..."}
              </p>
            )
          )}

          {/* Grown-up confirm: accepts real speech the ASR couldn't verify.
              Small + labeled for adults on purpose. */}
          {phase === "playing" && !micBlocked && (
            <button
              onClick={() => feed("grown_up")}
              className="mt-auto mb-1 text-xs text-muted-foreground underline underline-offset-2 py-2 px-3"
            >
              Grown-ups: they said it 👍
            </button>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {phase === "done" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center max-w-sm">
          <div className="text-7xl" role="img" aria-label="Full and happy monster">🤗</div>
          <h1 className="text-2xl font-bold text-primary">Momo is full!</h1>
          <p className="text-lg">
            You fed Momo <span className="font-bold">{feeds.length}</span> yummy things
            {spokenCount > 0 && (
              <> — <span className="font-bold text-secondary">{spokenCount} with your words!</span></>
            )}
          </p>

          <div className="rounded-3xl border-2 border-primary/25 bg-card shadow-card p-5 w-full">
            {petCelebrate && (
              <p className="text-lg font-bold text-secondary mb-2">✨ Your pet grew! ✨</p>
            )}
            <PetDisplay pet={pet} celebrate={petCelebrate} />
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              className="text-lg font-bold rounded-3xl"
              onClick={() => {
                // Fresh trials for a new burst
                window.location.reload();
              }}
            >
              Play Again! 🔁
            </Button>
            <Button size="lg" variant="outline" className="text-lg rounded-3xl" onClick={() => navigate("/practice")}>
              All Done ✔️
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
