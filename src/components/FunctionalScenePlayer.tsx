/**
 * Functional Command Scenes — adult "say it, see it" player
 * (docs/functional-command-scenes-spec.md).
 *
 * Practice surface, not an assessment: no scores, no failure states.
 * Speech and tap both drive the scene; tapping MODELS the word aloud via
 * TTS before applying the effect (errorless practice). All effects are
 * physical (brightness, scale, position, fill, motion) on real photos.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mic,
  MicOff,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  Play,
  Square,
  FastForward,
  Rewind,
  Plus,
  Minus,
  Flame,
  Wind,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { FUNCTIONAL_SCENES } from '@/data/functionalSceneBank';
import {
  initialSceneState,
  applyCommandUtterance,
  feedbackFor,
  type SceneDefinition,
  type SceneState,
  type CommandApplication,
} from '@/lib/scenes/sceneEngine';
import { cn } from '@/lib/utils';

export interface SceneCommandEvent {
  sceneId: string;
  command: string;
  formUsed: string;
  inputMode: 'speech' | 'tap' | 'demo';
  changed: boolean;
  atLimit: boolean;
}

/**
 * Severe-aphasia support: every command word gets a pictographic icon so
 * the buttons work for non-readers (global aphasia frequently includes
 * alexia). Icons are decorative — the word remains the accessible name.
 */
const COMMAND_ICONS: Record<string, LucideIcon> = {
  brighter: Sun,
  darker: Moon,
  bigger: ZoomIn,
  smaller: ZoomOut,
  up: ArrowUp,
  down: ArrowDown,
  go: Play,
  stop: Square,
  faster: FastForward,
  slower: Rewind,
  more: Plus,
  less: Minus,
  light: Flame,
  out: Wind,
};

interface FunctionalScenePlayerProps {
  onCommandApplied?: (e: SceneCommandEvent) => void;
  onSceneChange?: (sceneId: string) => void;
}

const UNMATCHED_HINT = 'Try one of the words below.';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Physical CSS for each scene's state — brightness, scale, position, mood. */
function scenePhotoStyle(scene: SceneDefinition, state: SceneState, reduced: boolean): React.CSSProperties {
  const transition = reduced ? 'none' : 'transform 400ms ease, filter 400ms ease, opacity 400ms ease';
  switch (scene.id) {
    case 'lamp': {
      const b = Number(state.brightness); // 0..4
      return { transition, filter: `brightness(${0.4 + b * 0.3})` };
    }
    case 'ball': {
      const s = Number(state.size); // 0..4
      return { transition, transform: `scale(${0.55 + s * 0.18})` };
    }
    case 'bird': {
      const h = Number(state.height); // 0..4; up = negative Y
      return { transition, transform: `translateY(${(2 - h) * 26}px)` };
    }
    case 'car': {
      const moving = Boolean(state.moving);
      const speed = Number(state.speed); // 1..3
      if (!moving) return { transition, transform: 'translateX(0px)' };
      if (reduced) return { transition: 'none', transform: 'translateX(14px)' };
      return {
        transform: 'translateX(0px)',
        animation: `scene-car-drift ${4.2 - speed}s ease-in-out infinite alternate`,
      };
    }
    case 'candle': {
      const lit = Boolean(state.lit);
      return { transition, filter: lit ? 'brightness(1.15)' : 'brightness(0.55) grayscale(0.7)' };
    }
    default:
      return { transition };
  }
}

export function FunctionalScenePlayer({ onCommandApplied, onSceneChange }: FunctionalScenePlayerProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = FUNCTIONAL_SCENES[sceneIndex];
  const [states, setStates] = useState<Record<string, SceneState>>(() =>
    Object.fromEntries(FUNCTIONAL_SCENES.map((s) => [s.id, initialSceneState(s)])),
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const reduced = useMemo(prefersReducedMotion, []);
  const { speak } = useTextToSpeech();

  const state = states[scene.id];

  const applyUtterance = useCallback(
    (utterance: string, inputMode: 'speech' | 'tap' | 'demo') => {
      const app: CommandApplication = applyCommandUtterance(scene, states[scene.id], utterance);
      if (!app.matched) {
        if (inputMode === 'speech') setFeedback(UNMATCHED_HINT);
        return;
      }
      setStates((prev) => ({ ...prev, [scene.id]: app.next }));
      const line = feedbackFor(scene, app);
      setFeedback(line);
      // Spoken confirmation on SPEECH successes — comprehension support for
      // users who can't read the feedback line. (Tap already spoke the
      // word as its model; a second utterance would cut the first off.)
      if (inputMode === 'speech' && line) void speak(line);
      onCommandApplied?.({
        sceneId: scene.id,
        command: app.matched.word,
        formUsed: app.formUsed ?? 'canonical',
        inputMode,
        changed: app.changed,
        atLimit: app.atLimit,
      });
    },
    [scene, states, onCommandApplied, speak],
  );

  // Speak the scene prompt on entry — non-readers hear what to do.
  useEffect(() => {
    void speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // "Show me": errorless demonstration — model the first command aloud and
  // perform it, tagged 'demo' in telemetry so it never reads as the patient.
  const showMe = useCallback(() => {
    const first = scene.commands[0];
    void speak(first.word);
    applyUtterance(first.word, 'demo');
  }, [scene, speak, applyUtterance]);

  const { startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: (text: string) => {
      if (text.trim()) applyUtterance(text, 'speech');
    },
    autoStart: false,
    continuousListening: true,
    patientMode: true,
  });

  const toggleMic = useCallback(() => {
    if (micOn) {
      try { stopListening(); } catch { /* noop */ }
      setMicOn(false);
    } else {
      try { startListening(); setMicOn(true); } catch { /* noop */ }
    }
  }, [micOn, startListening, stopListening]);

  const handleTap = useCallback(
    (word: string) => {
      void speak(word); // model the word first — errorless practice
      applyUtterance(word, 'tap');
    },
    [speak, applyUtterance],
  );

  const goToScene = useCallback(
    (nextIndex: number) => {
      const idx = (nextIndex + FUNCTIONAL_SCENES.length) % FUNCTIONAL_SCENES.length;
      setSceneIndex(idx);
      setFeedback(null);
      onSceneChange?.(FUNCTIONAL_SCENES[idx].id);
    },
    [onSceneChange],
  );

  // Cup fill overlay height (only scene with an overlay effect).
  const fillLevel = scene.id === 'cup' ? Number(state.fill) : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      {/* keyframes for the car scene */}
      <style>{`@keyframes scene-car-drift { from { transform: translateX(-16px); } to { transform: translateX(16px); } }`}</style>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous scene"
          className="h-12 w-12"
          onClick={() => goToScene(sceneIndex - 1)}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
        <div className="text-center">
          <h2 className="text-xl font-semibold">{scene.title}</h2>
          <p className="text-sm text-muted-foreground">{scene.prompt}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next scene"
          className="h-12 w-12"
          onClick={() => goToScene(sceneIndex + 1)}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mx-auto flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
            {/* key by scene id: remount on scene change so the previous
                scene's transform never morphs into the next photo */}
            <div key={scene.id} className="relative inline-flex">
              <img
                src={scene.photo}
                alt={scene.title}
                data-testid="scene-photo"
                className="max-h-56 max-w-full object-contain"
                style={scenePhotoStyle(scene, state, reduced)}
              />
              {fillLevel != null && (
                <div
                  data-testid="cup-fill"
                  aria-hidden
                  className="pointer-events-none absolute overflow-hidden rounded-sm"
                  style={{ left: '32%', right: '32%', bottom: '14%', height: '42%' }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-sm bg-primary/40"
                    style={{
                      height: `${fillLevel * 25}%`,
                      transition: reduced ? 'none' : 'height 400ms ease',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div role="status" aria-live="polite" className="mt-3 min-h-6 text-center text-base font-medium">
            {feedback}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {scene.commands.map((c) => {
          const Icon = COMMAND_ICONS[c.word];
          return (
            <Button
              key={c.word}
              variant="secondary"
              size="lg"
              className="h-16 gap-2 text-lg capitalize"
              onClick={() => handleTap(c.word)}
            >
              {Icon && <Icon aria-hidden className="h-6 w-6" />}
              {c.word}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={showMe} className="gap-2">
          <Eye aria-hidden className="h-4 w-4" />
          Show me
        </Button>
        {isSupported && (
          <Button
            variant={micOn ? 'default' : 'outline'}
            onClick={toggleMic}
            aria-label={micOn ? 'Stop listening' : 'Start listening'}
            className={cn('gap-2', micOn && 'animate-pulse')}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            {micOn ? 'Listening — say a word' : 'Use my voice'}
          </Button>
        )}
      </div>
    </div>
  );
}
