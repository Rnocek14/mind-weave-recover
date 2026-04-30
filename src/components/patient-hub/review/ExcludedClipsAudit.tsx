/**
 * Excluded Clips Audit — Speech Validity Gate trust UI.
 *
 * Shows clips that the gate excluded from scoring (filler / silence /
 * noise / low-confidence) so clinicians can:
 *   1. See *what* was filtered (transparency / trust)
 *   2. Listen to the audio
 *   3. 1-click reclassify if the gate got it wrong
 *      ("Mark as patient" / "Not patient" / "Noise" / "Filler")
 *
 * Reclassification is recorded in `clinician_validity_override` on the
 * underlying row. It is audit-only — historical scores are NOT recomputed.
 */
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Play, Pause, ChevronDown, ChevronRight, Check, X, Volume2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TrialData } from "@/hooks/useSessionDetail";

type Override = "patient" | "not_patient" | "noise" | "filler";

const LABEL_META: Record<string, { title: string; tone: "muted" | "warn" }> = {
  filler_only: { title: "Filler", tone: "muted" },
  no_response: { title: "Silent", tone: "muted" },
  background_noise: { title: "Noise", tone: "muted" },
  low_confidence: { title: "Flagged for review", tone: "warn" },
};

function isExcluded(t: TrialData): boolean {
  // Excluded if gate says so AND clinician hasn't reclassified as patient
  if (t.clinician_validity_override === "patient") return false;
  if (t.clinician_validity_override === "not_patient") return true;
  if (t.clinician_validity_override === "noise" || t.clinician_validity_override === "filler") return true;
  if (t.counts_toward_score === false) return true;
  if (t.validity_label && t.validity_label !== "valid_attempt") return true;
  return false;
}

interface Props {
  trials: TrialData[];
  /** Called after a clinician override succeeds, so the parent can refetch. */
  onOverridden?: () => void;
}

export function ExcludedClipsAudit({ trials, onOverridden }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const excluded = useMemo(
    () => trials.filter((t) => isExcluded(t) && !!t.audio_storage_path),
    [trials]
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(
    async (path: string, attemptId: string) => {
      if (playingId === attemptId) {
        stop();
        return;
      }
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
    },
    [playingId, stop]
  );

  const applyOverride = useCallback(
    async (trial: TrialData, override: Override) => {
      if (!trial.attempt_id) return;
      setSavingId(trial.attempt_id);
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id ?? null;
        const table = trial.source_table || "utterance_analyses";
        const patch = {
          clinician_validity_override: override,
          clinician_override_by: uid,
          clinician_override_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from(table)
          .update(patch)
          .eq("attempt_id", trial.attempt_id);
        if (error) throw error;
        toast({
          title:
            override === "patient"
              ? "Marked as patient attempt"
              : override === "not_patient"
              ? "Marked as not patient"
              : `Marked as ${override}`,
          description: "Voice Evidence will refresh.",
        });
        onOverridden?.();
      } catch (err: any) {
        toast({
          title: "Could not save override",
          description: err?.message ?? "Try again.",
          variant: "destructive",
        });
      } finally {
        setSavingId(null);
      }
    },
    [toast, onOverridden]
  );

  if (excluded.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 rounded-lg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground">
            Excluded clips ({excluded.length})
          </span>
          <span className="text-xs text-muted-foreground truncate">
            Filtered out of scoring · audio kept for clinician review
          </span>
        </div>
      </button>

      {open && (
        <ul className="divide-y divide-border">
          {excluded.map((t) => {
            const meta = LABEL_META[t.validity_label || ""] || {
              title: (t.validity_label || "Excluded").replace(/_/g, " "),
              tone: "muted" as const,
            };
            const playing = playingId === t.attempt_id;
            const saving = savingId === t.attempt_id;
            return (
              <li key={t.attempt_id} className="px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={meta.tone === "warn" ? "destructive" : "outline"}
                    className="text-[10px]"
                  >
                    {meta.tone === "warn" && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {meta.title}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                    Target: <span className="text-foreground">{t.target_word || "—"}</span>
                    {t.transcript ? (
                      <>
                        {" · "}
                        <span className="italic">"{t.transcript}"</span>
                      </>
                    ) : null}
                  </span>
                  <Button
                    size="sm"
                    variant={playing ? "secondary" : "ghost"}
                    className="h-7 px-2 shrink-0"
                    onClick={() =>
                      t.audio_storage_path && play(t.audio_storage_path, t.attempt_id)
                    }
                    aria-label={playing ? "Pause clip" : "Play clip"}
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                {t.validity_reason && (
                  <div className="text-[11px] text-muted-foreground pl-0.5">
                    {t.validity_reason}
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
                    Reclassify:
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    className="h-7 px-2 text-xs"
                    onClick={() => applyOverride(t, "patient")}
                  >
                    <Check className="w-3 h-3 mr-1" /> Patient
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    className="h-7 px-2 text-xs"
                    onClick={() => applyOverride(t, "not_patient")}
                  >
                    <X className="w-3 h-3 mr-1" /> Not patient
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => applyOverride(t, "noise")}
                  >
                    <Volume2 className="w-3 h-3 mr-1" /> Noise
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => applyOverride(t, "filler")}
                  >
                    Filler
                  </Button>
                  {t.clinician_validity_override && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      Override: {t.clinician_validity_override.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
