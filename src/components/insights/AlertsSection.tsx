/**
 * Insights Section: "Anything Concerning?"
 * 
 * Shows red flags, stalled progress, inconsistencies, missed sessions
 * Even when empty, shows reassurance
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Calendar, TrendingDown, Activity } from 'lucide-react';
import { useRedFlagDetection } from '@/hooks/useRedFlagDetection';
import { useSessionAdherence } from '@/hooks/useSessionAdherence';
import { cn } from '@/lib/utils';

interface AlertsSectionProps {
  userId: string;
}

export function AlertsSection({ userId }: AlertsSectionProps) {
  const { flags, isLoading: flagsLoading } = useRedFlagDetection(userId);
  const { weeklyStats, loading: adherenceLoading } = useSessionAdherence(userId);

  const isLoading = flagsLoading || adherenceLoading;

  // Check for concerning patterns - calculate from weekly stats
  const thisWeek = weeklyStats[0];
  const missedDays = thisWeek ? (thisWeek.totalDays - thisWeek.completedDays) : 0;
  const hasAdherenceConcern = missedDays >= 5;

  const hasAnyAlerts = flags.length > 0 || hasAdherenceConcern;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="alerts" className={cn(
      hasAnyAlerts && 'border-warning/50'
    )}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {hasAnyAlerts ? (
            <AlertTriangle className="w-5 h-5 text-warning" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-success" />
          )}
          Anything Concerning?
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyAlerts ? (
          /* The golden line */
          <div className="p-6 rounded-lg bg-success/10 border border-success/20 text-center">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-success mb-1">
              No concerns detected
            </h3>
            <p className="text-sm text-muted-foreground">
              Your therapy data looks healthy over the last 14 days
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Red flags */}
            {flags.map((flag, i) => (
              <Alert 
                key={i} 
                variant={flag.severity === 'red' ? 'destructive' : 'default'}
                className={flag.severity === 'orange' ? 'border-warning bg-warning/10' : ''}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{flag.message}</span>
                  <Badge variant={flag.severity === 'red' ? 'destructive' : 'secondary'}>
                    {flag.severity}
                  </Badge>
                </AlertDescription>
              </Alert>
            ))}

            {/* Adherence concern */}
            {hasAdherenceConcern && (
              <Alert className="border-warning bg-warning/10">
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  {missedDays} missed days this week. Consistent practice helps build lasting progress.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
