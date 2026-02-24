import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Heart, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare,
  Sun
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useDailyReadiness } from '@/hooks/useDailyReadiness';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useNavigate } from 'react-router-dom';

export function CaregiverTodayCard() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const navigate = useNavigate();
  const { todayCheckin, hasCheckedInToday } = useDailyReadiness(profileId);
  const { timeline, lastActiveDate } = useWeeklyRecoverySnapshot(profileId, 7);

  const patientName = activeProfile?.profile_name || 'Patient';

  // Compute streak
  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter(d => d.hasAnySignal).length;

  // Missed yesterday?
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const missedYesterday = timeline.length > 0 && !timeline.find(d => d.date === yesterdayStr)?.hasAnySignal;

  // Fatigue safety
  const fatigueHigh = todayCheckin && todayCheckin.fatigue_rating >= 4;
  const fatigueSafe = todayCheckin && todayCheckin.fatigue_rating <= 2;

  // Recommended action
  const actionText = fatigueHigh
    ? 'Consider a lighter or shorter session today'
    : 'Encourage a practice session today';

  const actionIcon = fatigueHigh ? AlertTriangle : Play;
  const ActionIcon = actionIcon;

  return (
    <Card className="p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
      <div className="flex items-center gap-2 mb-4">
        <Sun className="w-5 h-5 text-amber-500" />
        <h2 className="font-bold text-lg">Today's Plan</h2>
      </div>

      <div className="space-y-3">
        {/* 1. Recommended action */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <ActionIcon className={`w-5 h-5 mt-0.5 shrink-0 ${fatigueHigh ? 'text-amber-500' : 'text-primary'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{actionText}</p>
            {!fatigueHigh && (
              <Button 
                size="sm" 
                className="mt-2 gap-1.5" 
                onClick={() => navigate('/dashboard')}
              >
                <Play className="w-3.5 h-3.5" />
                Start Session
              </Button>
            )}
          </div>
        </div>

        {/* 2. Safety check — fatigue */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <Heart className={`w-5 h-5 mt-0.5 shrink-0 ${fatigueHigh ? 'text-red-500' : fatigueSafe ? 'text-green-500' : 'text-muted-foreground'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {!hasCheckedInToday 
                ? 'No check-in yet today'
                : fatigueHigh
                  ? `${patientName} reported high fatigue (${todayCheckin!.fatigue_rating}/5)`
                  : `Fatigue: ${todayCheckin!.fatigue_rating}/5 — looking good`
              }
            </p>
            {fatigueHigh && (
              <p className="text-xs text-muted-foreground mt-1">
                Consider rest or a shorter, easier session.
              </p>
            )}
          </div>
        </div>

        {/* 3. Adherence nudge */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <TrendingUp className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            {missedYesterday ? (
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Missed yesterday — a short session today helps maintain progress
              </p>
            ) : (
              <p className="text-sm font-medium">
                {activeDays}/7 active days this week
                {activeDays >= 5 && (
                  <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-600/30">Great streak!</Badge>
                )}
              </p>
            )}
          </div>
        </div>

        {/* 4. Quick context note prompt */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
          <MessageSquare className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Had visitors? Bad sleep? Note anything that might affect today's practice.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}