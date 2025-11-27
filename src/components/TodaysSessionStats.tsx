import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodaysSessionStats } from "@/hooks/useTodaysSessionStats";
import { Clock, Target, CheckCircle2, SkipForward } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function TodaysSessionStats() {
  const { stats, loading } = useTodaysSessionStats();

  // Don't show if no activity today
  if (!loading && stats.totalTrials === 0 && stats.timeWorkedMinutes === 0) {
    return null;
  }

  const timeProgress = (stats.timeWorkedMinutes / stats.dailyGoalMinutes) * 100;
  const goalReached = stats.timeWorkedMinutes >= stats.dailyGoalMinutes;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg">Today's Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Time Practiced</span>
            </div>
            <span className={goalReached ? "text-green-600 font-semibold" : "text-muted-foreground"}>
              {stats.timeWorkedMinutes} / {stats.dailyGoalMinutes} min
            </span>
          </div>
          <Progress value={Math.min(timeProgress, 100)} className="h-2" />
          {goalReached && (
            <p className="text-xs text-green-600 font-medium">🎉 Daily goal reached!</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Accuracy */}
          <div className="space-y-1 text-center p-3 rounded-lg bg-muted/50">
            <Target className="h-4 w-4 mx-auto text-primary" />
            <p className="text-2xl font-bold">{stats.accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
            <p className="text-xs text-muted-foreground">{stats.correctTrials}/{stats.totalTrials}</p>
          </div>

          {/* Exercises Completed */}
          <div className="space-y-1 text-center p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600" />
            <p className="text-2xl font-bold">{stats.exercisesCompleted}</p>
            <p className="text-xs text-muted-foreground">Exercises</p>
            <p className="text-xs text-muted-foreground">Practiced</p>
          </div>

          {/* Skipped */}
          <div className="space-y-1 text-center p-3 rounded-lg bg-muted/50">
            <SkipForward className="h-4 w-4 mx-auto text-orange-500" />
            <p className="text-2xl font-bold">{stats.exercisesSkipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
