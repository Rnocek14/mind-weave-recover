import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { SessionDetail } from "@/hooks/useSessionHistory";
import { cn } from "@/lib/utils";
import { AudioPlayback } from "@/components/AudioPlayback";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

interface SessionHistoryTimelineProps {
  sessions: SessionDetail[];
}

export const SessionHistoryTimeline = ({
  sessions
}: SessionHistoryTimelineProps) => {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
      if (selectedSession === sessionId) {
        setSelectedSession(null);
      }
    } else {
      newExpanded.add(sessionId);
      setSelectedSession(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const getExerciseIcon = (slug: string) => {
    if (slug.includes("semantic")) return "💡";
    if (slug.includes("phonological")) return "🔊";
    if (slug.includes("sentence")) return "📝";
    if (slug.includes("photo")) return "📷";
    return "🎯";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getErrorTypeDistribution = (session: SessionDetail, exerciseSlug: string) => {
    const exercise = session.exercises.find((ex) => ex.slug === exerciseSlug);
    if (!exercise) return [];

    const errorCounts: Record<string, number> = {};
    exercise.trials.forEach((trial) => {
      if (trial.errorType && trial.score !== 1) {
        errorCounts[trial.errorType] = (errorCounts[trial.errorType] || 0) + 1;
      }
    });

    return Object.entries(errorCounts).map(([type, count]) => ({
      type: type.replace(/_/g, " "),
      count
    }));
  };

  if (sessions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No sessions found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session, idx) => {
        const isExpanded = expandedSessions.has(session.id);
        const avgAccuracy =
          session.exercises.reduce((sum, ex) => sum + ex.accuracy, 0) /
          session.exercises.length;
        const totalTrials = session.exercises.reduce(
          (sum, ex) => sum + ex.totalTrials,
          0
        );

        return (
          <Card
            key={session.id}
            className={cn(
              "overflow-hidden transition-all",
              isExpanded && "ring-2 ring-primary"
            )}
          >
            {/* Session Header */}
            <div
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleSession(session.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Timeline Marker */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        avgAccuracy >= 80
                          ? "bg-success"
                          : avgAccuracy >= 60
                          ? "bg-warning"
                          : "bg-destructive"
                      )}
                    />
                    {idx < sessions.length - 1 && (
                      <div className="w-0.5 h-full min-h-[40px] bg-border mt-2" />
                    )}
                  </div>

                  {/* Session Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">
                        {new Date(session.startedAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {new Date(session.startedAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {session.exercises.map((ex) => (
                        <Badge key={ex.slug} variant="secondary" className="gap-1">
                          <span>{getExerciseIcon(ex.slug)}</span>
                          <span>{ex.slug.replace(/-/g, " ")}</span>
                        </Badge>
                      ))}
                    </div>

                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDuration(session.durationSec)}
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        {avgAccuracy.toFixed(0)}% accuracy
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {totalTrials} trials
                      </div>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t bg-muted/30 p-6 space-y-6">
                {session.exercises.map((exercise) => {
                  const errorDist = getErrorTypeDistribution(session, exercise.slug);
                  const avgRT =
                    exercise.trials.length > 0
                      ? Math.round(
                          exercise.trials.reduce(
                            (sum, t) => sum + (t.reactionTimeMs || 0),
                            0
                          ) / exercise.trials.length
                        )
                      : 0;

                  return (
                    <div key={exercise.slug} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-lg">
                          {getExerciseIcon(exercise.slug)}{" "}
                          {exercise.slug.replace(/-/g, " ")}
                        </h4>
                        <div className="flex gap-4 text-sm">
                          <Badge
                            variant={
                              exercise.accuracy >= 80
                                ? "default"
                                : exercise.accuracy >= 60
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {exercise.accuracy}% accuracy
                          </Badge>
                          <span className="text-muted-foreground">
                            {exercise.totalTrials} trials
                          </span>
                          {avgRT > 0 && (
                            <span className="text-muted-foreground">
                              Avg RT: {avgRT}ms
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Error Distribution Chart */}
                      {errorDist.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Error Patterns
                          </h5>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={errorDist}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="type" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="count" fill="#ef4444" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Trial Details Table */}
                      <div>
                        <h5 className="text-sm font-medium mb-3">Trial Details</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr>
                                <th className="text-left py-2 px-3">Trial</th>
                                <th className="text-center py-2 px-3">Result</th>
                                <th className="text-right py-2 px-3">RT (ms)</th>
                                <th className="text-left py-2 px-3">Error Type</th>
                                <th className="text-center py-2 px-3">Cue Level</th>
                                <th className="text-center py-2 px-3">Audio</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exercise.trials.map((trial) => (
                                <tr
                                  key={trial.id}
                                  className="border-b hover:bg-muted/50"
                                >
                                  <td className="py-2 px-3">#{trial.round}</td>
                                  <td className="text-center py-2 px-3">
                                    {trial.score === 1 ? (
                                      <CheckCircle2 className="w-4 h-4 text-success inline" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-destructive inline" />
                                    )}
                                  </td>
                                  <td className="text-right py-2 px-3">
                                    {trial.reactionTimeMs || "-"}
                                  </td>
                                  <td className="py-2 px-3">
                                    {trial.errorType ? (
                                      <Badge variant="outline" className="text-xs">
                                        {trial.errorType.replace(/_/g, " ")}
                                      </Badge>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  <td className="text-center py-2 px-3">
                                    {trial.cueLevel ?? "-"}
                                  </td>
                                   <td className="text-center py-2 px-3">
                                     {(trial as any).audioStoragePath ? (
                                       <AudioPlayback storagePath={(trial as any).audioStoragePath} />
                                     ) : (
                                       <span className="text-muted-foreground text-xs">-</span>
                                     )}
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>

                         {/* Whisper Analysis Section */}
                         {exercise.trials.some((t: any) => t.whisperTranscript) && (
                           <div className="mt-4 space-y-2">
                             <h5 className="text-sm font-medium">Speech Analysis (Whisper AI)</h5>
                             {exercise.trials
                               .filter((t: any) => t.whisperTranscript)
                               .map((trial: any) => (
                                 <div key={trial.id} className="p-3 bg-muted/50 rounded space-y-1">
                                   <div className="flex items-center gap-2">
                                     <Badge variant="outline" className="text-xs">Trial #{trial.round}</Badge>
                                     <span className="text-xs text-muted-foreground">
                                       Confidence: {((trial.whisperConfidence || 0) * 100).toFixed(0)}%
                                     </span>
                                   </div>
                                   <p className="text-sm">&ldquo;{trial.whisperTranscript}&rdquo;</p>
                                   {trial.acousticMetrics && (
                                     <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                                       <div>
                                         <span className="font-medium">Speech Rate:</span> {trial.acousticMetrics.speechRateWpm} wpm
                                       </div>
                                       <div>
                                         <span className="font-medium">Pauses:</span> {trial.acousticMetrics.pauseCount} ({trial.acousticMetrics.avgPauseDurationMs}ms avg)
                                       </div>
                                       <div>
                                         <span className="font-medium">Duration:</span> {trial.acousticMetrics.totalDurationSec}s
                                       </div>
                                     </div>
                                   )}
                                 </div>
                               ))}
                           </div>
                         )}
                       </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
