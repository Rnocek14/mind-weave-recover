/**
 * Glance Card 1 — Status
 * Answers: "Are they okay?"
 * One traffic light, one sentence. No more.
 */
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useRedFlagDetection } from "@/hooks/useRedFlagDetection";
import { useMemo } from "react";

interface StatusCardProps {
  userId: string;
  patientName: string;
}

type Status = "good" | "watch" | "concern";

export function StatusCard({ userId, patientName }: StatusCardProps) {
  const { sessions } = useSessionHistory(userId);
  const { flags, isLoading } = useRedFlagDetection(userId);

  const { status, headline, sub } = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recent = sessions.filter((s) => new Date(s.startedAt).getTime() > weekAgo).length;
    const redCount = flags.filter((f) => f.severity === "red").length;
    const orangeCount = flags.filter((f) => f.severity === "orange").length;

    if (redCount > 0) {
      return {
        status: "concern" as Status,
        headline: "Needs attention",
        sub: `${redCount} alert${redCount === 1 ? "" : "s"} to review below`,
      };
    }
    if (orangeCount > 0 || recent < 2) {
      return {
        status: "watch" as Status,
        headline: "Could use support",
        sub: recent < 2 ? "Practice has been light this week" : "Some signals to watch",
      };
    }
    return {
      status: "good" as Status,
      headline: "Doing well",
      sub: `${patientName} is on track`,
    };
  }, [sessions, flags, patientName]);

  const styles = {
    good: { ring: "ring-emerald-500/30 bg-emerald-500/5", dot: "bg-emerald-500", Icon: CheckCircle2, color: "text-emerald-600" },
    watch: { ring: "ring-amber-500/30 bg-amber-500/5", dot: "bg-amber-500", Icon: Circle, color: "text-amber-600" },
    concern: { ring: "ring-destructive/30 bg-destructive/5", dot: "bg-destructive", Icon: AlertTriangle, color: "text-destructive" },
  }[status];

  return (
    <Card className={`p-5 ring-1 ${styles.ring}`}>
      <div className="flex items-center gap-4">
        <div className={`shrink-0 w-12 h-12 rounded-full ${styles.dot} bg-opacity-15 flex items-center justify-center`}>
          <styles.Icon className={`w-6 h-6 ${styles.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Status</div>
          <div className={`text-xl font-bold ${styles.color} leading-tight`}>{isLoading ? "Checking…" : headline}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{sub}</div>
        </div>
      </div>
    </Card>
  );
}
