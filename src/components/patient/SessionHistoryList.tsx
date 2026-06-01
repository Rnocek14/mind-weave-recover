import { Card } from "@/components/ui/card";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useMemo } from "react";
import { Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface SessionHistoryListProps {
  userId: string;
  profileId?: string | null;
}

function sessionRating(accuracy: number): { label: string; className: string; icon: typeof CheckCircle } {
  if (accuracy >= 80) return { label: "Great", className: "text-emerald-600", icon: CheckCircle };
  if (accuracy >= 60) return { label: "Good", className: "text-primary", icon: CheckCircle };
  return { label: "Keep at it", className: "text-amber-500", icon: AlertTriangle };
}

/**
 * Compact session history for patient view.
 * Shows last 5 sessions with date, duration, and plain-language rating.
 */
export function SessionHistoryList({ userId, profileId }: SessionHistoryListProps) {
  const { sessions, loading } = useSessionHistory(userId, profileId);

  const recent = useMemo(() => sessions.slice(0, 5), [sessions]);

  if (loading) return null;

  if (recent.length === 0) {
    return (
      <Card className="p-5 border border-dashed text-center space-y-1">
        <Clock className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-foreground">No sessions yet</p>
        <p className="text-xs text-muted-foreground">Your recent sessions will appear here after you practice</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-foreground px-1">Recent Sessions</h3>
      {recent.map((session) => {
        const avgAccuracy =
          session.exercises.length > 0
            ? Math.round(
                session.exercises.reduce((sum, ex) => sum + ex.accuracy, 0) /
                  session.exercises.length
              )
            : 0;
        const rating = sessionRating(avgAccuracy);
        const Icon = rating.icon;
        const duration = session.durationSec
          ? `${Math.round(session.durationSec / 60)} min`
          : "";
        const dateLabel = session.startedAt
          ? format(parseISO(session.startedAt), "EEE, MMM d")
          : "";

        return (
          <Card key={session.id} className="p-3.5 border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium text-foreground">{dateLabel}</div>
                {duration && (
                  <div className="text-xs text-muted-foreground">{duration} · {session.exercises.length} activit{session.exercises.length !== 1 ? "ies" : "y"}</div>
                )}
              </div>
            </div>
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${rating.className}`}>
              <Icon className="w-4 h-4" />
              {rating.label}
            </span>
          </Card>
        );
      })}
    </div>
  );
}
