/**
 * Insights Section: "What's Helping?"
 * 
 * Shows cue success rates, which cue types work best, before/after comparisons
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, CheckCircle2, Clock } from 'lucide-react';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { getCueLabel } from '@/lib/insightLanguageMap';
import { cn } from '@/lib/utils';

interface StrategiesSectionProps {
  userId: string;
  profileId?: string;
}

export function StrategiesSection({ userId, profileId }: StrategiesSectionProps) {
  // Note: profileId will be used when useErrorPatternAnalytics supports it
  const { analytics, isLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4 });

  const cueEfficacy = analytics?.cueEfficacy || [];
  const sortedCues = [...cueEfficacy].sort((a, b) => b.efficacyRate - a.efficacyRate);
  const bestCue = sortedCues[0];

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="strategies">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Lightbulb className="w-5 h-5" />
          What's Helping?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cueEfficacy.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Complete sessions with cues to see what works best for you</p>
          </div>
        ) : (
          <>
            {/* Best Strategy Highlight */}
            {bestCue && (
              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <h4 className="font-semibold">Best Strategy</h4>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-medium">{getCueLabel(bestCue.cueType)}</div>
                    <div className="text-sm text-muted-foreground">
                      Works {Math.round(bestCue.efficacyRate * 100)}% of the time
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {Math.round(bestCue.efficacyRate * 100)}%
                  </Badge>
                </div>
              </div>
            )}

            {/* All Cue Types */}
            <div>
              <h4 className="font-medium mb-3">Cue Effectiveness</h4>
              <div className="space-y-3">
                {sortedCues.map(cue => {
                  const isBest = cue === bestCue;
                  const effectiveness = cue.efficacyRate;
                  const color = effectiveness > 0.6 ? 'bg-success' : 
                               effectiveness > 0.4 ? 'bg-primary' : 'bg-muted-foreground';
                  
                  return (
                    <div key={cue.cueType} className={cn(
                      'p-3 rounded-lg border bg-card',
                      isBest && 'ring-2 ring-success/50'
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getCueLabel(cue.cueType)}</span>
                          {isBest && <Badge variant="outline" className="text-xs">Best</Badge>}
                        </div>
                        <span className={cn(
                          'font-semibold',
                          effectiveness > 0.6 ? 'text-success' : 
                          effectiveness > 0.4 ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {Math.round(effectiveness * 100)}%
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                        <div 
                          className={cn('h-full rounded-full transition-all', color)}
                          style={{ width: `${effectiveness * 100}%` }}
                        />
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{cue.totalGiven} times used</span>
                        <span>{cue.effectiveCount} successful</span>
                        {cue.avgTimeToSuccessMs && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {(cue.avgTimeToSuccessMs / 1000).toFixed(1)}s avg
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
