/**
 * Axis Evidence Panel — clinician-facing per-attempt explanation
 * (Voice Engine v2 Phase 4, docs/voice-engine-v2-spec.md §9.1).
 *
 * For every voice attempt that has a shadow verdict: a plain-language reason
 * line, then an expandable evidence panel with the three always-on axes
 * (Word Retrieval, Communication Success, Independence), the strategy label,
 * measurement confidence, and each axis's evidence lines.
 *
 * Rules enforced here, not just documented:
 *   • Communication Success renders its NAMED STATE ("Gist conveyed, detail
 *     missing"), never the decimal — the five rungs are defined states, not
 *     samples of a curve.
 *   • The whole panel is explicitly labeled a v2 SHADOW preview: v1 still
 *     scores this session, and disagreements are surfaced, not hidden.
 *   • Advisory axes (pronunciation / semantic content / fluency — Phase 3)
 *     render with an "advisory" tag and the note that they never gate.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Info, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TrialData } from "@/hooks/useSessionDetail";
import {
  computePronunciationAxis,
  computeFluencyAxis,
  computeSemanticContentAxis,
  type ErrorType,
} from "@/lib/voiceEngine/axisEngine";

interface AxisEvidencePanelProps {
  trials: TrialData[];
}

/** Communication Success — named ordinal states (spec §1.1). Labels, not decimals. */
function commSuccessLabel(value: number): { label: string; tone: "good" | "mid" | "bad" } {
  if (value >= 1.0) return { label: "Fully conveyed", tone: "good" };
  if (value >= 0.75) return { label: "Gist conveyed, detail missing", tone: "good" };
  if (value >= 0.5) return { label: "Category conveyed", tone: "mid" };
  if (value >= 0.25) return { label: "Fragmentary", tone: "mid" };
  return { label: "Not conveyed", tone: "bad" };
}

function retrievalLabel(value: number): string {
  if (value >= 1.0) return "Retrieved clean";
  if (value >= 0.85) return "Retrieved after self-correction";
  if (value >= 0.45) return "Retrieved with cue";
  if (value >= 0.4) return "Phonemic approximation";
  return "Not retrieved";
}

function independenceLabel(value: number): string {
  if (value >= 1.0) return "Independent";
  if (value >= 0.7) return "Semantic cue needed";
  if (value >= 0.6) return "Manually confirmed";
  if (value >= 0.5) return "Phonemic cue needed";
  return "Heavy scaffolding";
}

const STRATEGY_LABELS: Record<string, string> = {
  spontaneous: "Spontaneous retrieval",
  effortful_search: "Effortful search (found it)",
  self_correction: "Self-correction",
  circumlocution: "Circumlocution",
  self_cued: "Self-cued attempt",
  cue_dependent: "Needed a cue",
  abandoned: "Search not resolved",
  none: "No attempt",
};

const PRIMARY_STYLES: Record<string, string> = {
  success: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  partial: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  retry: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  no_score: "bg-muted text-muted-foreground border-border",
};

function AxisRow({
  name,
  stateLabel,
  confidence,
  evidence,
  advisory,
}: {
  name: string;
  stateLabel: string;
  confidence: number;
  evidence: string[];
  advisory?: boolean;
}) {
  return (
    <div className="py-1.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <span className="flex items-center gap-1.5">
          {advisory && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
              advisory — never gates
            </Badge>
          )}
          <span className="text-xs text-foreground/90">{stateLabel}</span>
        </span>
      </div>
      {evidence.length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {evidence.map((e, i) => (
            <li key={i} className="text-[11px] text-muted-foreground pl-2 border-l-2 border-border">
              {e}
            </li>
          ))}
        </ul>
      )}
      {confidence < 0.5 && (
        <div className="text-[10px] text-muted-foreground mt-0.5 italic">
          low confidence in this axis
        </div>
      )}
    </div>
  );
}

function AttemptRow({ trial }: { trial: TrialData }) {
  const [open, setOpen] = useState(false);
  const primary = trial.verdict_primary ?? "no_score";
  const agreement = trial.shadow_v1_agreement;

  // ── Advisory axes (Phase 3) — derived at display time from persisted
  // evidence (spec §1.2). Structural "never gates" guarantee: these values are
  // computed here in the read path and exist nowhere the scorer can see.
  const storedAxes = trial.axis_scores as any;
  const gop = trial.gop_data as any;
  const axes = storedAxes
    ? {
        ...storedAxes,
        pronunciation:
          storedAxes.pronunciation ??
          computePronunciationAxis(
            gop
              ? { pronunciationScore: gop.pronunciationScore, accuracyScore: gop.accuracyScore }
              : null,
          ),
        semanticContent:
          storedAxes.semanticContent ??
          computeSemanticContentAxis(
            trial.semantic_similarity,
            (trial.error_type ?? undefined) as ErrorType | undefined,
          ),
        fluency:
          storedAxes.fluency ??
          computeFluencyAxis({
            speechRateWpm: trial.speech_rate_wpm,
            pauseCount: trial.pause_count,
            effortfulSpeech: trial.effortful_speech,
            azureFluencyScore: gop?.fluencyScore,
          }),
      }
    : null;

  const commState = axes?.communicationSuccess
    ? commSuccessLabel(axes.communicationSuccess.value)
    : null;

  const PrimaryIcon =
    primary === "success" ? CheckCircle2 : primary === "no_score" ? Info : AlertTriangle;

  return (
    <li className="rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-foreground truncate">
            <span className="font-medium">{trial.target_word || "—"}</span>
            {trial.transcript && (
              <>
                <span className="text-muted-foreground"> → </span>
                <span className="italic">"{trial.transcript}"</span>
              </>
            )}
          </div>
          {/* The reason line IS the clinical statement — plain language, no numbers. */}
          <div className="text-xs text-muted-foreground truncate">{trial.verdict_reason}</div>
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] capitalize shrink-0 gap-1", PRIMARY_STYLES[primary])}
        >
          <PrimaryIcon className="w-3 h-3" />
          {primary.replace(/_/g, " ")}
        </Badge>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {trial.strategy_used && (
              <Badge variant="secondary" className="text-[10px]">
                {STRATEGY_LABELS[trial.strategy_used] ?? trial.strategy_used}
              </Badge>
            )}
            {trial.measurement_confidence && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  trial.measurement_confidence === "low" && "text-muted-foreground"
                )}
              >
                measurement: {trial.measurement_confidence}
              </Badge>
            )}
            {agreement && agreement.agrees === false && (
              <Badge variant="outline" className="text-[10px] text-yellow-700 dark:text-yellow-400 border-yellow-500/40">
                disagrees with current scoring
              </Badge>
            )}
          </div>

          {axes && (
            <div className="rounded-md bg-muted/30 px-2.5 py-1">
              {axes.communicationSuccess && commState && (
                <AxisRow
                  name="Communication success"
                  stateLabel={commState.label}
                  confidence={axes.communicationSuccess.confidence}
                  evidence={axes.communicationSuccess.evidence ?? []}
                />
              )}
              {axes.wordRetrieval && (
                <AxisRow
                  name="Word retrieval"
                  stateLabel={retrievalLabel(axes.wordRetrieval.value)}
                  confidence={axes.wordRetrieval.confidence}
                  evidence={axes.wordRetrieval.evidence ?? []}
                />
              )}
              {axes.independence && (
                <AxisRow
                  name="Independence"
                  stateLabel={independenceLabel(axes.independence.value)}
                  confidence={axes.independence.confidence}
                  evidence={axes.independence.evidence ?? []}
                />
              )}
              {/* Phase 3 advisory axes render automatically when present. */}
              {axes.pronunciation && (
                <AxisRow
                  name="Pronunciation"
                  stateLabel={`${Math.round(axes.pronunciation.value * 100)}/100`}
                  confidence={axes.pronunciation.confidence}
                  evidence={axes.pronunciation.evidence ?? []}
                  advisory
                />
              )}
              {axes.semanticContent && (
                <AxisRow
                  name="Semantic content"
                  stateLabel={`${Math.round(axes.semanticContent.value * 100)}/100`}
                  confidence={axes.semanticContent.confidence}
                  evidence={axes.semanticContent.evidence ?? []}
                  advisory
                />
              )}
              {axes.fluency && (
                <AxisRow
                  name="Fluency"
                  stateLabel={`${Math.round(axes.fluency.value * 100)}/100`}
                  confidence={axes.fluency.confidence}
                  evidence={axes.fluency.evidence ?? []}
                  advisory
                />
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function AxisEvidencePanel({ trials }: AxisEvidencePanelProps) {
  const withVerdicts = trials.filter((t) => t.verdict_primary && t.axis_scores);

  if (withVerdicts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No axis-level evidence recorded for this session yet. Attempts made after the
        Voice Engine v2 update will appear here.
      </div>
    );
  }

  const disagreements = withVerdicts.filter(
    (t) => t.shadow_v1_agreement?.agrees === false
  ).length;

  return (
    <div className="space-y-2">
      {/* Shadow disclosure — it must be impossible to mistake this for the live score. */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <FlaskConical className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Preview — new scoring model.</span>{" "}
          These axis verdicts run alongside the current scoring and do not affect this
          session's accuracy or progression yet.
          {disagreements > 0 && (
            <> {disagreements} attempt{disagreements === 1 ? "" : "s"} where the two models
            disagree {disagreements === 1 ? "is" : "are"} flagged below.</>
          )}
        </p>
      </div>
      <ul className="space-y-1.5">
        {withVerdicts.map((t) => (
          <AttemptRow key={t.attempt_id} trial={t} />
        ))}
      </ul>
    </div>
  );
}
