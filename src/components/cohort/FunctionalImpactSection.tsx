import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import type { FunctionalTrend } from "@/hooks/useCohortAnalytics";

export function FunctionalImpactSection({ trends }: { trends: FunctionalTrend[] }) {
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-primary" />Reported daily communication</CardTitle>
      <CardDescription>Mean check-in ratings on their original 1–5 scales. Who reported can change from day to day.</CardDescription></CardHeader>
    <CardContent>{!trends.length ? <p className="text-sm text-muted-foreground">No functional check-ins recorded.</p> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Check-in ratings by day. Empty ratings are shown as a dash.</caption>
        <thead className="border-b text-xs text-muted-foreground"><tr>{["Date","Reports","Expressing needs","Participation","Independence","Caregiver burden"].map(s =>
          <th scope="col" className="px-2 py-2" key={s}>{s}</th>)}</tr></thead>
        <tbody>{trends.slice().reverse().map(t => <tr className="border-b" key={t.checkinDate}>
          <th scope="row" className="whitespace-nowrap p-2 font-normal">{t.checkinDate}</th>
          {[t.count,t.avgCommunication,t.avgParticipation,t.avgIndependence,t.avgBurden].map((v,i) =>
            <td className="p-2 tabular-nums" key={i}>{v ?? "—"}</td>)}</tr>)}</tbody>
      </table></div>}</CardContent>
  </Card>;
}
