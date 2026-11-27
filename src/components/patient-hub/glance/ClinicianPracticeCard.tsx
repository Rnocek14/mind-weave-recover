import { Card } from "@/components/ui/card";
import { localYYYYMMDD } from "@/lib/localDate";

interface Props {
  days: string[]; sessionCount: number; trialCount: number; recorded: number; minutes: number;
}
export function ClinicianPracticeCard({ days, sessionCount, trialCount, recorded, minutes }: Props) {
  const today = new Date();
  const practiced = new Set(days);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - 6 + i);
    return { date, practiced: practiced.has(localYYYYMMDD(date)) };
  });
  return <Card className="p-4 sm:p-5">
    <h2 className="text-sm font-semibold">Practice in the last 7 days</h2>
    <div className="my-3 flex flex-wrap items-baseline gap-x-2">
      <strong className="text-2xl tabular-nums">{week.filter(d => d.practiced).length}/7</strong>
      <span className="text-sm text-muted-foreground">days with a completed session</span>
    </div>
    <ol className="mb-4 grid grid-cols-7 gap-1 text-center">{week.map(d => <li key={localYYYYMMDD(d.date)}
      aria-label={`${d.date.toLocaleDateString()}: ${d.practiced ? "practice recorded" : "no qualifying session"}`}
      className={`rounded-md p-1.5 text-xs ${d.practiced ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
      {d.date.toLocaleDateString(undefined, { weekday:"short" })}<span className="block font-semibold">{d.practiced ? "✓" : "—"}</span>
    </li>)}</ol>
    <dl className="grid grid-cols-3 gap-2 border-t pt-3">
      {([["Sessions",sessionCount],["Scored attempts",trialCount],["Session minutes",minutes]] as const).map(([name,n]) =>
        <div key={name}><dt className="text-xs text-muted-foreground">{name}</dt><dd className="text-lg font-semibold tabular-nums">{n}</dd></div>)}
    </dl>
    <p className="mt-2 text-xs text-muted-foreground">Completed sessions lasting at least one minute. {trialCount} of {recorded} recorded attempts had eligible scores.</p>
  </Card>;
}
