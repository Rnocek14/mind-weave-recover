import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Gamepad2 } from "lucide-react";
import { cohortDimensions, type CohortDimension, type GamePracticeRow } from "@/lib/clinical/pairedGamePractice";
import { getGameClinicalProfile } from "@/lib/leveling/clinicalRungs";
import { toProgressionSlug } from "@/lib/exerciseSlugNormalizer";

type Props = { rows: GamePracticeRow[]; dimension: CohortDimension; onDimension: (d: CohortDimension) => void };
const pp = (n: number) => `${n > 0 ? "+" : ""}${n}`;

export function GameEffectivenessSection({ rows, dimension, onDimension }: Props) {
  return <Card>
    <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg"><Gamepad2 aria-hidden="true" className="h-5 w-5 text-primary" />Practice change by game</CardTitle>
        <CardDescription>How did recorded task credit change between the first and fourth weeks for the same people?</CardDescription>
      </div>
      <label className="flex shrink-0 flex-col gap-1 text-xs font-medium">Group patients by
        <select className="rounded-md border bg-background px-2 py-2 text-sm" value={dimension} onChange={e => onDimension(e.target.value as CohortDimension)}>
          {Object.entries(cohortDimensions).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
    </CardHeader>
    <CardContent className="space-y-4">
      {rows.length ? <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Task credit by game and current documented {cohortDimensions[dimension].toLowerCase()}</caption>
          <thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr>
            {["Game", cohortDimensions[dimension], "Recorded", "Baseline", "Paired", "Median change", "Middle 50%"].map(h =>
              <th key={h} scope="col" className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}
          </tr></thead>
          <tbody>{rows.map(r => <tr key={JSON.stringify([r.game,r.group])} className="border-b">
            <th scope="row" className="px-2 py-3 font-medium">{getGameClinicalProfile(toProgressionSlug(r.game))?.title ?? r.game.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase())}</th>
            <td className="px-2 capitalize">{r.group.replace(/_/g," ")}</td>
            <td className="px-2 tabular-nums">{r.recorded}</td><td className="px-2 tabular-nums">{r.baseline}</td>
            <td className="px-2"><details><summary className="cursor-pointer tabular-nums" aria-label={`Coverage for ${r.game}, ${r.group}: ${r.paired} paired`}>{r.paired}</summary>
              <dl className="min-w-36 py-2 text-xs text-muted-foreground">
                {([["No eligible baseline",r.recorded-r.baseline],["Week 4 still open",r.pending],["No eligible follow-up",r.absent],["No matching condition",r.unmatched]] as const)
                  .map(([label,n]) => <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd>{n}</dd></div>)}
              </dl></details></td>
            <td className="whitespace-nowrap px-2 font-semibold tabular-nums">{r.median === null ? "Too few pairs" : `${pp(r.median)} pp`}</td>
            <td className="whitespace-nowrap px-2 text-muted-foreground">{r.q1 === null || r.q3 === null ? "—" : `${pp(r.q1)} to ${pp(r.q3)} pp`}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-sm text-muted-foreground">No game attempts have been recorded for these profiles.</p>}
      <details className="text-sm"><summary className="cursor-pointer font-medium">How this comparison works</summary>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>The first eligible attempt for each person and game starts the clock. Days 1–7 and 22–28 use UTC calendar dates. Both windows must be complete. Rows with more paired patients appear first. Expand a paired count to see who could contribute.</p>
          <p>Eligible attempts use the unified trial record, a binary task score, a recorded game level and response mode. Explicitly excluded, manually confirmed and caregiver-assisted attempts do not qualify. A credited answer can include cueing.</p>
          <p>Within each person, matching game levels, response modes and recorded interaction settings get equal weight. The median and middle 50% use one change per person and require at least two pairs. Values are percentage points (pp).</p>
          <p>Groups use the current profile. Differences in item familiarity, cueing, other therapy and who returned can affect the result. A treatment-effect comparison requires a defined comparator and outcome.</p>
        </div>
      </details>
    </CardContent>
  </Card>;
}
