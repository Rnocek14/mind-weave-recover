import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDayDetails } from "@/hooks/useDayDetails";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Target, Smile, Meh, Frown, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { HelpLabel } from "@/components/HelpTooltip";

interface DayDetailsDialogProps {
  date: string | null;
  onClose: () => void;
}

export function DayDetailsDialog({ date, onClose }: DayDetailsDialogProps) {
  const { sessions, loading } = useDayDetails(date);

  const displayDate = date ? format(new Date(date), "EEEE, MMMM d, yyyy") : "";

  const getMoodIcon = (rating: number | null) => {
    if (!rating) return null;
    if (rating >= 4) return <Smile className="h-4 w-4 text-green-600" />;
    if (rating >= 3) return <Meh className="h-4 w-4 text-yellow-600" />;
    return <Frown className="h-4 w-4 text-orange-600" />;
  };

  return (
    <Dialog open={!!date} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayDate}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sessions recorded for this day
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session, index) => {
              const totalTrials = session.exercises.reduce((sum, ex) => sum + ex.trials, 0);
              const totalCorrect = session.exercises.reduce((sum, ex) => sum + ex.correct, 0);
              const sessionAccuracy = totalTrials > 0 ? Math.round((totalCorrect / totalTrials) * 100) : 0;
              const durationMin = Math.round((session.duration_sec || 0) / 60);

              return (
                <Card key={session.id} className="border-2">
                  <CardContent className="pt-6 space-y-4">
                    {/* Session Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Session {index + 1}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(session.started_at), "h:mm a")}
                            {session.ended_at && 
                              ` - ${format(new Date(session.ended_at), "h:mm a")}`
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{durationMin} min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <HelpLabel term="Accuracy"><span>{sessionAccuracy}% accuracy</span></HelpLabel>
                          </div>
                          {session.mood_rating && (
                            <div className="flex items-center gap-1">
                              {getMoodIcon(session.mood_rating)}
                              <span>Mood: {session.mood_rating}/5</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Exercises Breakdown */}
                    {session.exercises.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Exercises Practiced
                        </h4>
                        <div className="space-y-2">
                          {session.exercises.map((exercise) => (
                            <div
                              key={exercise.exercise_slug}
                              className="p-3 rounded-lg bg-muted/50 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                  {exercise.exercise_title}
                                </span>
                                <Badge variant={exercise.accuracy >= 75 ? "default" : "secondary"}>
                                  {exercise.accuracy}%
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{exercise.correct} / {exercise.trials} correct</span>
                                  {exercise.avgReactionTime && (
                                    <span>Avg: {Math.round(exercise.avgReactionTime)}ms</span>
                                  )}
                                </div>
                                <Progress value={exercise.accuracy} className="h-1" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
