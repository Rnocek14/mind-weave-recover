import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSessionAdherence } from "@/hooks/useSessionAdherence";
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { Calendar, Flame, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionAdherenceTrackerProps {
  userId: string | null;
  currentStreak: number;
}

export const SessionAdherenceTracker = ({ userId, currentStreak }: SessionAdherenceTrackerProps) => {
  const { days, weeklyStats, loading } = useSessionAdherence(userId, 4);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Session Adherence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  
  const currentWeekDays = days.filter(day => 
    day.date >= weekStart && day.date <= weekEnd
  );

  const currentWeekStats = weeklyStats[weeklyStats.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Session Adherence
        </CardTitle>
        <CardDescription>
          Track your therapy consistency and build streaks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Streak */}
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className="text-2xl font-bold">{currentStreak} days</p>
            </div>
          </div>
          {currentStreak >= 7 && (
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              On Fire!
            </Badge>
          )}
        </div>

        {/* Current Week Calendar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">This Week</h4>
            {currentWeekStats && (
              <span className="text-sm text-muted-foreground">
                {currentWeekStats.completedDays}/7 days
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {currentWeekDays.map((day) => {
              const isToday = isSameDay(day.date, today);
              const isFuture = day.date > today;
              
              return (
                <div key={day.date.toISOString()} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {format(day.date, 'EEE')[0]}
                  </span>
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors",
                      day.hasSession && "bg-primary text-primary-foreground",
                      !day.hasSession && !isFuture && "bg-muted text-muted-foreground",
                      isFuture && "bg-background border border-border text-muted-foreground",
                      isToday && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    {format(day.date, 'd')}
                  </div>
                  {day.sessionCount > 1 && (
                    <span className="text-xs text-primary font-medium">
                      +{day.sessionCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {currentWeekStats && (
            <div className="space-y-2">
              <Progress value={currentWeekStats.completionRate} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {currentWeekStats.completionRate}% completion rate
              </p>
            </div>
          )}
        </div>

        {/* Weekly Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Last 4 Weeks</h4>
          <div className="space-y-2">
            {weeklyStats.map((week, idx) => (
              <div key={week.weekStart.toISOString()} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24">
                  {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'd')}
                </span>
                <Progress value={week.completionRate} className="h-2 flex-1" />
                <span className="text-xs font-medium w-12 text-right">
                  {week.completedDays}/7
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
