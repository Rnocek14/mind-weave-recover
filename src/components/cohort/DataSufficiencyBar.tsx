import { Card, CardContent } from "@/components/ui/card";

export interface CohortCoverage {
  patientCount: number; sessionCount: number; trialCount: number; indexedCount: number; unindexedCount: number;
  retentionWordCount: number; functionalCheckinCount: number;
}

export function coverageFields(p: CohortCoverage) {
  return [
    ["Patient profiles", p.patientCount], ["Practice sessions", p.sessionCount],
    ["Recorded attempts", p.trialCount], ["Indexed opportunities", p.indexedCount],
    ["Attempts without a trial index", p.unindexedCount], ["Retention records", p.retentionWordCount], ["Functional check-ins", p.functionalCheckinCount],
  ] as const;
}

export function DataSufficiencyBar(p: CohortCoverage) {
  return <Card><CardContent className="space-y-3 p-5">
    <h2 className="text-base font-semibold">Cohort coverage</h2>
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {coverageFields(p).map(([label, value]) => <div key={label}>
        <dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
      </div>)}
    </dl>
    <p className="text-xs text-muted-foreground">All visible patient profiles, including those with no sessions. Sessions include visits with no recorded attempts.
      {" "}Each indexed opportunity is one trial index within a session and game.</p>
  </CardContent></Card>;
}
