/**
 * Honest recap of simulated in-app roleplay.
 *
 * The legacy scenario engine computes experimental intent/latency heuristics
 * (e.g. 3+ words can satisfy intent), which cannot establish comprehension
 * or real-world communication. Display only observed participation/support,
 * and never an unvalidated "readiness" percent or "message understood" claim.
 */
export interface ScenarioPracticeSummaryProps {
  title: string;
  exchangeCount: number;
  hintCount: number;
  repeatCount: number;
  helpCount: number;
  automaticWhispers: number;
}

export function ScenarioPracticeSummary({
  title,
  exchangeCount,
  hintCount,
  repeatCount,
  helpCount,
  automaticWhispers,
}: ScenarioPracticeSummaryProps) {
  const manualSupports = hintCount + helpCount;
  return (
    <div className="space-y-4" aria-label="In-app roleplay practice summary">
      <div className="text-center space-y-2">
        <span className="text-4xl" aria-hidden="true">🌱</span>
        <p className="text-lg font-semibold text-foreground">Roleplay practice complete</p>
        <p className="text-sm text-muted-foreground">
          You practiced {title.toLowerCase()} with Maya.
        </p>
      </div>

      <div className="bg-muted/50 rounded-2xl p-4 space-y-2">
        <p className="text-sm text-foreground">
          {exchangeCount} conversation exchange{exchangeCount === 1 ? "" : "s"} practiced
        </p>
        <p className="text-sm text-foreground">
          Hints or help requested: {manualSupports}
        </p>
        <p className="text-sm text-foreground">
          Repeats requested: {repeatCount}
        </p>
        {automaticWhispers > 0 && (
          <p className="text-sm text-foreground">
            Automatic hints offered: {automaticWhispers}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        This is an in-app practice activity, not a measured real-world communication outcome.
      </p>
    </div>
  );
}
