/**
 * SessionPauseControl — Global pause affordance for in-session exercises.
 *
 * Mounted once at the App root. Renders only when:
 *   - Current route starts with /exercise/
 *   - User is inside a Full Coaching / Guided session (lessonFlowState_resume present)
 *
 * Behavior:
 *   - Always-visible small button top-right of viewport
 *   - Tap → full-screen PauseOverlay (dim + breathing dot)
 *   - While paused: blocks all pointer/keyboard input to the exercise via
 *     a fullscreen overlay; stops any active SpeechRecognition + TTS centrally.
 *   - Resume: dismisses overlay, exercises pick up where they were.
 *   - End early: clears resume state, navigates to /today.
 *
 * No clinical logic touched. No per-game changes required. Telemetry is logged
 * via console for now; can be wired to analytics later.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AboutGameLink } from '@/components/leveling/AboutGameLink';
import { useUiProfile } from '@/hooks/useUiProfile';
import { variantClass, isMinimal } from '@/lib/ui/variantClass';

export function SessionPauseControl() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUiProfile();
  const { variant } = profile;
  const [isPaused, setIsPaused] = useState(false);
  const pauseStartRef = useRef<number | null>(null);

  // Show on any /exercise/* route. Pause is universally useful, so we don't
  // gate on lesson resume state (which only exists mid-flow).
  const onExerciseRoute = location.pathname.startsWith('/exercise/');
  const visible = onExerciseRoute;
  const currentSlug = useMemo(() => {
    const m = location.pathname.match(/^\/exercise\/([^/?#]+)/);
    return m ? m[1] : null;
  }, [location.pathname]);

  // ── Pause side effects: stop mic + TTS centrally ────────────────
  const enterPause = useCallback(() => {
    pauseStartRef.current = Date.now();
    setIsPaused(true);
    console.log('[SessionPause] Paused');

    // Stop any active SpeechRecognition the page has spun up.
    // Each game holds its own recognizer ref, but they all listen for
    // 'pause-session' events as a fallback. Dispatch one and also
    // brute-force-stop any SpeechSynthesis so Maya goes quiet immediately.
    try { window.speechSynthesis?.cancel(); } catch {}
    window.dispatchEvent(new CustomEvent('session-pause'));
  }, []);

  const exitPause = useCallback(() => {
    const durMs = pauseStartRef.current ? Date.now() - pauseStartRef.current : 0;
    pauseStartRef.current = null;
    setIsPaused(false);
    console.log('[SessionPause] Resumed after', Math.round(durMs / 1000), 's');
    window.dispatchEvent(new CustomEvent('session-resume', { detail: { pausedMs: durMs } }));
  }, []);

  const handleEndEarly = useCallback(() => {
    console.log('[SessionPause] User ended session from pause overlay');
    setIsPaused(false);
    pauseStartRef.current = null;
    // Clear resume state so the "Continue session" card doesn't appear later.
    try {
      localStorage.removeItem('lessonFlowState_resume');
      sessionStorage.removeItem('lessonFlowState');
    } catch {}
    navigate('/today', { replace: true });
  }, [navigate]);

  // Auto-clear pause if user navigates away (route change).
  useEffect(() => {
    if (isPaused) exitPause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Spacebar shortcut for caregivers / desktop users.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack when typing in an input/textarea.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Escape' && isPaused) {
        e.preventDefault();
        exitPause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, isPaused, exitPause]);

  if (!visible) return null;

  return (
    <>
      {/* Always-visible pause button (top-right). Hidden while overlay is up. */}
      {!isPaused && (
        <button
          type="button"
          onClick={enterPause}
          aria-label="Pause session"
          className={variantClass(variant, {
            // top-16 + z-[55]: exercise pages render a sticky `z-50` header
            // (h-14) with its own Home button top-right — a `top-3 z-40`
            // button sat underneath it, invisible and unclickable. Sit just
            // below the header row and above its stacking level.
            base: 'fixed top-16 right-3 z-[55] h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors',
            simplified: 'h-14 w-14 right-4 text-foreground border-2',
          })}
        >
          <Pause className={variantClass(variant, { base: 'w-4 h-4', simplified: 'w-6 h-6' })} />
        </button>
      )}

      {/* Full-screen pause overlay — blocks all input to exercise underneath. */}
      {isPaused && (
        <div
          className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200"
          role="dialog"
          aria-label="Session paused"
        >
          <div className={variantClass(variant, {
            base: 'max-w-sm w-full text-center space-y-8',
            simplified: 'max-w-md w-full text-center space-y-10',
          })}>
            {/* Breathing dot — calm, not animated frantically */}
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/10" />
              <div className="absolute inset-2 rounded-full bg-primary/20 animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Pause className="w-7 h-7 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className={variantClass(variant, {
                base: 'text-2xl font-semibold text-foreground',
                simplified: 'text-3xl',
              })}>Paused</h2>
              <p className={variantClass(variant, {
                base: 'text-muted-foreground text-base',
                simplified: 'text-lg',
              })}>
                Take your time. Resume whenever you're ready.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button
                size="lg"
                onClick={exitPause}
                className={variantClass(variant, { base: 'w-full gap-2', simplified: 'h-16 text-lg' })}
              >
                <Play className="w-4 h-4" />
                Resume
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={handleEndEarly}
                className={variantClass(variant, {
                  base: 'w-full text-muted-foreground gap-2',
                  simplified: 'h-16 text-lg',
                })}
              >
                <X className="w-4 h-4" />
                End session early
              </Button>
            </div>

            {/* Keyboard tip is desktop-oriented detail; hidden in minimal. */}
            {!isMinimal(variant) && (
              <p className="text-xs text-muted-foreground/60">
                Tip: press Esc to resume
              </p>
            )}

            {currentSlug && (
              <div className="pt-1">
                <AboutGameLink
                  slug={currentSlug}
                  variant="inline"
                  label="How this supports recovery"
                  source="pause-overlay"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
