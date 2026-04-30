/**
 * Error Pattern Breakdown — counts + horizontal bars per error category.
 *
 * Categories combine native `error_type` values with derived flags:
 *   - perseveration  (derived: same wrong response across distinct targets)
 *   - agrammatic     (derived: very short response on multi-word target)
 *
 * Click any bar to filter the trial list under it.
 */
import { useMemo } from "react";
import type { TrialData } from "@/hooks/useSessionDetail";
import { derivePerseveration } from "@/lib/clinical/derivePerseveration";
import { cn } from "@/lib/utils";

interface ErrorPatternBreakdownProps {
  trials: TrialData[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  phonemic_paraphasia: "Phonemic paraphasia",
  semantic_paraphasia: "Semantic paraphasia",
  circumlocution: "Circumlocution",
  self_corrected: "Self-corrected",
  no_response: "No response",
  neologism: "Neologism",
  perseveration: "Perseveration",
  agrammatic: "Agrammatic / telegraphic",
  uncategorized: "Other / uncategorized",
};

const ORDER = [
  "phonemic_paraphasia",
  "semantic_paraphasia",
  "circumlocution",
  "self_corrected",
  "no_response",
  "neologism",
  "perseveration",
  "agrammatic",
  "uncategorized",
];

function isAgrammatic(t: TrialData): boolean {
  // Heuristic: multi-word target, response is 1–2 words, and not a naming task.
  const targetWords = (t.target_word || "").trim().split(/\s+/).filter(Boolean).length;
  const respWords = (t.transcript || "").trim().split(/\s+/).filter(Boolean).length;
  if (targetWords < 3) return false;
  if (respWords === 0) return false;
  return respWords <= 2 && t.is_correct === false;
}

function normalizeErrorType(raw: string | null | undefined): string {
  if (!raw) return "uncategorized";
  const k = raw.toLowerCase();
  if (k.includes("phonem") || k === "phonological") return "phonemic_paraphasia";
  if (k.includes("semantic")) return "semantic_paraphasia";
  if (k.includes("circumloc")) return "circumlocution";
  if (k.includes("self") && k.includes("correct")) return "self_corrected";
  if (k.includes("no_response") || k.includes("no_attempt") || k === "timeout") return "no_response";
  if (k.includes("neolog")) return "neologism";
  return CATEGORY_LABELS[k] ? k : "uncategorized";
}

export function ErrorPatternBreakdown({ trials, selected, onSelect }: ErrorPatternBreakdownProps) {
  const incorrect = useMemo(() => trials.filter((t) => t.is_correct === false), [trials]);

  const buckets = useMemo(() => {
    const counts = new Map<string, number>();
    const persev = derivePerseveration(
      trials.map((t) => ({
        attempt_id: t.attempt_id,
        target_word: t.target_word,
        transcript: t.transcript,
        is_correct: t.is_correct,
      }))
    );

    incorrect.forEach((t) => {
      const cat = normalizeErrorType(t.error_type);
      counts.set(cat, (counts.get(cat) || 0) + 1);
      if (isAgrammatic(t)) {
        counts.set("agrammatic", (counts.get("agrammatic") || 0) + 1);
      }
    });

    if (persev.perseverationCount > 0) {
      counts.set("perseveration", persev.perseverationCount);
    }

    return ORDER
      .map((k) => ({ key: k, label: CATEGORY_LABELS[k], count: counts.get(k) || 0 }))
      .filter((b) => b.count > 0);
  }, [trials, incorrect]);

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const totalIncorrect = incorrect.length;

  if (buckets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No errors recorded this session.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {buckets.map((b) => {
        const pct = totalIncorrect > 0 ? Math.round((b.count / totalIncorrect) * 100) : 0;
        const widthPct = (b.count / max) * 100;
        const isSel = selected === b.key;
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onSelect(isSel ? null : b.key)}
            className={cn(
              "w-full text-left group rounded-md px-2 py-1.5 transition-colors",
              "hover:bg-muted/50",
              isSel && "bg-muted"
            )}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm text-foreground">{b.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {b.count} · {pct}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isSel ? "bg-primary" : "bg-primary/60"
                )}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </button>
        );
      })}
      {selected && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs text-muted-foreground hover:text-foreground underline pt-1"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

/** Exported for the trial-list filter to reuse. */
export function categoryOfTrial(t: TrialData): string[] {
  const cats: string[] = [];
  if (t.is_correct === false) {
    cats.push(normalizeErrorType(t.error_type));
    if (isAgrammatic(t)) cats.push("agrammatic");
  }
  return cats;
}
