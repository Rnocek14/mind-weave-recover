/**
 * Voice Evidence Grid — 4 curated audio clips for clinical review.
 *
 *   Best response · Representative error · Hardest successful · Most recent
 *
 * Each clip card surfaces the data SLPs actually use:
 *   ▶ play · target · transcript · error type · cue used · RT
 */
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { TrialData } from "@/hooks/useSessionDetail";
import { cn } from "@/lib/utils";

interface VoiceEvidenceGridProps {
  trials: TrialData[];
}

type ClipKind = "best" | "error" | "hardest" | "recent";

interface ClipPick {
  kind: ClipKind;
  label: string;
  description: string;
  trial: TrialData;
}

const QUALITY_MIN_MS = 400;

/**
 * Voice Evidence MUST respect the Speech Validity Gate.
 * Excluded labels (filler / silence / noise / low-confidence) never appear
 * as "best clip" or "representative error" — that would break clinician trust.
 * Clinician override `patient` re-admits a clip; `not_patient`/`noise`/`filler` excludes it.
 */
function isValidPatientAttempt(t: TrialData): boolean {
  const ov = t.clinician_validity_override;
  if (ov === 'patient') return true;
  if (ov === 'not_patient' || ov === 'noise' || ov === 'filler') return false;
  // Phase-1 gate: only `valid_attempt` (or no label at all, for legacy rows) counts.
  if (t.validity_label && t.validity_label !== 'valid_attempt') return false;
  if (t.counts_toward_score === false) return false;
  return true;
}

function hasAudio(t: TrialData): boolean {
  return !!t.audio_storage_path && (t.recording_duration_ms ?? 0) >= QUALITY_MIN_MS;
}

function difficultyOf(t: TrialData): number {
  const tp = t.taskParameters as any;
  return Number(tp?.difficulty ?? tp?.level ?? tp?.cue_level ?? 0) || 0;
}

function pickClips(trials: TrialData[]): ClipPick[] {
  const withAudio = trials.filter((t) => hasAudio(t) && isValidPatientAttempt(t));
  if (withAudio.length === 0) return [];

  const correct = withAudio.filter((t) => t.is_correct === true);
  const incorrect = withAudio.filter((t) => t.is_correct === false);

  // Best: correct, no cue, fastest RT
  const bestPool = correct.filter((t) => !t.cue_type_given);
  const best = (bestPool.length ? bestPool : correct)
    .slice()
    .sort((a, b) => (a.latency_ms ?? Infinity) - (b.latency_ms ?? Infinity))[0];

  // Representative error: most-frequent error type
  const errorCounts = new Map<string, number>();
  incorrect.forEach((t) => {
    const k = t.error_type || "uncategorized";
    errorCounts.set(k, (errorCounts.get(k) || 0) + 1);
  });
  let topError: string | null = null;
  let topErrorN = 0;
  for (const [k, n] of errorCounts) {
    if (n > topErrorN) { topErrorN = n; topError = k; }
  }
  const repError = topError
    ? incorrect.find((t) => (t.error_type || "uncategorized") === topError)
    : incorrect[0];

  // Hardest successful: highest difficulty among correct
  const hardest = correct.slice().sort((a, b) => difficultyOf(b) - difficultyOf(a))[0];

  // Most recent: last by created_at
  const recent = withAudio
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];

  const picks: ClipPick[] = [];
  if (best) picks.push({
    kind: "best", label: "Best response",
    description: "Correct, no cue, fastest", trial: best,
  });
  if (repError) picks.push({
    kind: "error", label: "Representative error",
    description: `Most-frequent error type${topError ? ` (${topError})` : ""}`,
    trial: repError,
  });
  if (hardest && hardest.attempt_id !== best?.attempt_id) picks.push({
    kind: "hardest", label: "Hardest successful",
    description: "Highest difficulty correct", trial: hardest,
  });
  if (recent && !picks.some((p) => p.trial.attempt_id === recent.attempt_id)) picks.push({
    kind: "recent", label: "Most recent",
    description: "Last attempt this session", trial: recent,
  });

  return picks;
}

function ClipCard({
  pick,
  playingId,
  onPlay,
}: {
  pick: ClipPick;
  playingId: string | null;
  onPlay: (path: string, attemptId: string) => void;
}) {
  const t = pick.trial;
  const playing = playingId === t.attempt_id;
  const errorChip = t.error_type;
  const cueChip = t.cue_type_given;
  const rt = t.latency_ms;

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {pick.label}
          </div>
          <div className="text-sm text-foreground font-medium truncate">
            {pick.description}
          </div>
        </div>
        <Button
          size="sm"
          variant={playing ? "secondary" : "default"}
          onClick={() => t.audio_storage_path && onPlay(t.audio_storage_path, t.attempt_id)}
          className="h-8 px-2.5 shrink-0"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs text-muted-foreground">Target:</span>
        <span className="text-sm font-semibold text-foreground">
          {t.target_word || "—"}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <Mic className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-sm text-foreground/90 italic">
          {t.transcript ? `"${t.transcript}"` : <span className="text-muted-foreground not-italic">(no transcript)</span>}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {errorChip && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {errorChip.replace(/_/g, " ")}
          </Badge>
        )}
        {cueChip ? (
          <Badge variant="secondary" className="text-[10px] capitalize">
            cue: {cueChip}
          </Badge>
        ) : pick.kind === "best" ? (
          <Badge variant="outline" className="text-[10px]">no cue</Badge>
        ) : null}
        {rt != null && rt > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {(rt / 1000).toFixed(1)}s
          </Badge>
        )}
      </div>
    </div>
  );
}

export function VoiceEvidenceGrid({ trials }: VoiceEvidenceGridProps) {
  const picks = useMemo(() => pickClips(trials), [trials]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(async (path: string, attemptId: string) => {
    if (playingId === attemptId) { stop(); return; }
    stop();
    try {
      const { data } = await supabase.storage
        .from("session-recordings")
        .createSignedUrl(path, 60);
      if (!data?.signedUrl) return;
      const audio = new Audio(data.signedUrl);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(attemptId);
      await audio.play();
    } catch {
      setPlayingId(null);
    }
  }, [playingId, stop]);

  if (picks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No voice recordings of sufficient quality in this session.
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", "grid-cols-1 sm:grid-cols-2")}>
      {picks.map((p) => (
        <ClipCard key={p.kind + p.trial.attempt_id} pick={p} playingId={playingId} onPlay={play} />
      ))}
    </div>
  );
}
