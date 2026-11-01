/**
 * Read-only session facts. Every percentage has an eligible denominator,
 * and no eligible speech displays "not measured", not 0%.
 */
import { Calendar, Clock, Gamepad2, Target, SlidersHorizontal, Lightbulb, ShieldCheck } from "lucide-react";
import { formatPracticePercent } from "@/lib/clinical/metricsPresentation";

interface SessionSummaryStripProps {
  startedAt: string;
  durationSec: number | null;
  gamesPlayed: number;
  accuracyPct: number | null;
  highestLevel: number | null;
  cueDependencyPct: number | null;
  attemptedCount: number;
  eligibleCount: number;
  validityBuckets?: {
    valid: number;
    filler: number;
    silence: number;
    noise: number;
    flagged: number;
  } | null;
}

function fmtDate(iso: string) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  }) : "—";
}

function fmtDuration(sec: number | null) {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return "—";
  return String(Math.round(sec / 60)) + " min";
}

function Fact({
  icon: Icon, label, value, description,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
        <span className="break-words">{label}</span>
      </div>
      <p className="text-lg font-semibold leading-snug break-words tabular-nums text-foreground">{value}</p>
      {description && <p className="text-xs leading-snug text-muted-foreground break-words">{description}</p>}
    </div>
  );
}

export function SessionSummaryStrip({
  startedAt, durationSec, gamesPlayed, accuracyPct, highestLevel,
  cueDependencyPct, attemptedCount, eligibleCount, validityBuckets,
}: SessionSummaryStripProps) {
  const unscored = Math.max(0, attemptedCount - eligibleCount);
  const hasMeasurements = eligibleCount > 0;
  return (
    <section aria-label="Session measurements" className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Fact icon={Calendar} label="Session date" value={fmtDate(startedAt)} />
        <Fact icon={Clock} label="Time practiced" value={fmtDuration(durationSec)} />
        <Fact icon={Gamepad2} label="Activities" value={String(gamesPlayed)} description="From recorded attempts" />
        <Fact
          icon={Target} label="Correct answers"
          value={formatPracticePercent(accuracyPct)}
          description={hasMeasurements ? String(eligibleCount) + " scored responses" : "Not enough scored data"}
        />
        <Fact
          icon={SlidersHorizontal} label="Highest task difficulty"
          value={highestLevel == null ? "—" : String(highestLevel)}
          description="Not a clinical recovery level"
        />
        <Fact
          icon={Lightbulb} label="Responses with cues"
          value={formatPracticePercent(cueDependencyPct)}
          description={hasMeasurements ? "Of " + eligibleCount + " scored responses" : "Not enough scored data"}
        />
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="text-foreground">
              <strong>{eligibleCount} of {attemptedCount}</strong> responses included in these percentages.
              {unscored > 0 && (" " + unscored + (unscored === 1 ? " response was" : " responses were") + " not scored.")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              An unscored response is not a wrong answer. These are app practice measurements,
              not independently verified speaker identity or a clinical recovery score.
            </p>
            {validityBuckets && unscored > 0 && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Review reasons:
                {validityBuckets.filler > 0 && (" filler " + validityBuckets.filler + ";")}
                {validityBuckets.silence > 0 && (" silence " + validityBuckets.silence + ";")}
                {validityBuckets.noise > 0 && (" noise " + validityBuckets.noise + ";")}
                {validityBuckets.flagged > 0 && (" uncertain or unscored " + validityBuckets.flagged + ";")}
                {" "}see attempt details for evidence.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
