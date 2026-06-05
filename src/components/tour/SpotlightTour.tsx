/**
 * SpotlightTour — an in-place coachmark tour.
 *
 * Unlike the centered RoleTourDialog (which shows *mock* UI), this dims the
 * real page, cuts a "spotlight" hole around an actual element, and anchors a
 * tooltip to it. Each step answers three things: WHAT it is, WHY it matters,
 * and HOW to act on it.
 *
 * Targets are matched by a `data-tour="<id>"` attribute on the real element.
 * Steps whose target isn't currently in the DOM are skipped automatically, so
 * conditional dashboard sections never break the flow.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An action run before a step is shown, used to reveal targets that live inside
 * collapsed drawers or inactive tabs. Each entry clicks `click` unless
 * `skipIfVisible` already resolves to a visible element (prevents toggling an
 * already-open collapsible shut).
 */
export interface SpotlightOpenStep {
  /** CSS selector to click to reveal the target. */
  click: string;
  /** If this selector is already visible, the click is skipped. */
  skipIfVisible?: string;
}

export interface SpotlightStep {
  /** Matches the `data-tour` attribute on the real element. */
  target: string;
  title: string;
  /** What the user is looking at. */
  what: string;
  /** Why it matters. */
  why: string;
  /** How to use / act on it. */
  how?: string;
  /** Optional actions that reveal the target (open drawer, switch tab, etc.). */
  openSteps?: SpotlightOpenStep[];
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isVisible(el: Element | null): boolean {
  if (!el) return false;
  const r = (el as HTMLElement).getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

interface SpotlightTourProps {
  steps: SpotlightStep[];
  open: boolean;
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // breathing room around the highlighted element
const TOOLTIP_W = 360;

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function SpotlightTour({ steps, open, onClose }: SpotlightTourProps) {
  // Resolve only the steps whose target currently exists in the DOM.
  const resolved = useMemo(() => {
    if (!open) return [];
    return steps.filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
    // Re-resolve whenever the tour opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, steps]);

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = resolved[index];
  const isFirst = index === 0;
  const isLast = index === resolved.length - 1;

  const close = useCallback(() => {
    onClose();
    setTimeout(() => setIndex(0), 200);
  }, [onClose]);

  // Reset to start each time the tour (re)opens.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // If nothing resolved, don't hold the user in an empty overlay.
  useEffect(() => {
    if (open && resolved.length === 0) close();
  }, [open, resolved.length, close]);

  // Scroll the target into view, then measure it (and keep it measured).
  useLayoutEffect(() => {
    if (!open || !current) return;
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    let raf = 0;
    const measure = () => setRect(getRect(el));
    // Measure after the smooth scroll settles, then keep it fresh.
    const t = setTimeout(() => {
      measure();
      raf = requestAnimationFrame(function loop() {
        measure();
        raf = requestAnimationFrame(loop);
      });
    }, 320);

    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [open, current]);

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, resolved.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, resolved.length, close]);

  if (!open || !current || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Spotlight hole.
  const holeTop = rect.top - PAD;
  const holeLeft = rect.left - PAD;
  const holeW = rect.width + PAD * 2;
  const holeH = rect.height + PAD * 2;

  // Tooltip placement: below the element if there's room, else above.
  const spaceBelow = vh - (rect.top + rect.height);
  const placeBelow = spaceBelow > 220 || spaceBelow > rect.top;
  const tooltipTop = placeBelow
    ? Math.min(rect.top + rect.height + PAD + 8, vh - 16)
    : Math.max(rect.top - PAD - 8, 16);
  let tooltipLeft = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  tooltipLeft = Math.max(12, Math.min(tooltipLeft, vw - TOOLTIP_W - 12));

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Dim everything except the spotlight hole (box-shadow trick). */}
      <div
        className="absolute rounded-xl ring-2 ring-primary transition-all duration-300 pointer-events-none"
        style={{
          top: holeTop,
          left: holeLeft,
          width: holeW,
          height: holeH,
          boxShadow: "0 0 0 9999px hsl(var(--foreground) / 0.55)",
        }}
      />

      {/* Click outside the tooltip skips the tour. */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close tour"
        onClick={close}
      />

      {/* Tooltip */}
      <div
        className={cn(
          "absolute rounded-xl border bg-card text-card-foreground shadow-xl p-4 space-y-3",
          placeBelow ? "origin-top" : "origin-bottom",
          !placeBelow && "-translate-y-full"
        )}
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_W, maxWidth: "calc(100vw - 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">{current.title}</h3>
          <button
            type="button"
            onClick={close}
            className="text-muted-foreground hover:text-foreground -mr-1 -mt-0.5"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-foreground">{current.what}</p>
          <p>
            <span className="font-medium text-foreground">Why it matters: </span>
            <span className="text-muted-foreground">{current.why}</span>
          </p>
          {current.how && (
            <p>
              <span className="font-medium text-foreground">How to use it: </span>
              <span className="text-muted-foreground">{current.how}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${resolved.length}`}>
            {resolved.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "bg-primary w-5" : "bg-muted w-1.5"
                )}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setIndex((i) => i - 1)}>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            )}
            <Button size="sm" className="gap-1" onClick={() => (isLast ? close() : setIndex((i) => i + 1))}>
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
