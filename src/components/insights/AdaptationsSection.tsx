/**
 * Insights Section: "How Is The System Adapting?"
 * 
 * Shows difficulty changes, lane switches, focus word/phoneme shifts, cue escalation
 * Explicit "why" statements for trust building
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, Clock, ChevronRight, Info } from 'lucide-react';
import { useAdaptationTimeline } from '@/hooks/useAdaptationTimeline';
import { AdaptationExecutiveSummary } from '@/components/AdaptationExecutiveSummary';
import { AdaptationProofPanel } from '@/components/AdaptationProofPanel';
import { formatDistanceToNow } from 'date-fns';
import type { TodayFocus } from '@/lib/adaptiveDecisionEngine';
import { useUiMode } from '@/hooks/useUiMode';
import { cn } from '@/lib/utils';
import { HelpLabel } from '@/components/HelpTooltip';

interface AdaptationsSectionProps {
  userId: string;
  profileId?: string;
  todayFocus?: TodayFocus | null;
}

export function AdaptationsSection({ userId, profileId, todayFocus }: AdaptationsSectionProps) {
  const { events, isLoading } = useAdaptationTimeline(userId, 14);
  const { isAtLeast } = useUiMode();
  const showEvidencePanel = isAtLeast('caregiver');

  // Format adaptation description with "why"
  const formatEvent = (event: any) => {
    const before = event.value_before;
    const after = event.value_after;
    const evidence = event.evidence as Record<string, any> || {};
    
    let description = '';
    let reason = '';
    
    switch (event.adaptation_type) {
      case 'difficulty_up':
        description = `Difficulty increased: ${before} → ${after}`;
        reason = evidence.successRate 
          ? `You succeeded ${Math.round(evidence.successRate * 100)}% on recent trials` 
          : 'Strong performance detected';
        break;
      case 'difficulty_down':
        description = `Difficulty decreased: ${before} → ${after}`;
        reason = evidence.consecutiveErrors 
          ? `${evidence.consecutiveErrors} errors in a row` 
          : 'Reducing challenge to rebuild confidence';
        break;
      case 'lane_switch':
        description = `Content lane changed: ${before} → ${after}`;
        reason = 'Adjusting content to match your current level';
        break;
      case 'cue_delivered':
        description = `Cue shown: ${after}`;
        reason = event.trigger_condition || 'You seemed stuck';
        break;
      case 'frustration_stepdown':
        description = 'Emergency difficulty reduction';
        reason = 'Multiple errors detected—taking a step back';
        break;
      case 'timeout_extended':
        description = 'Response time extended';
        reason = 'You need more time—that\'s okay';
        break;
      default:
        description = event.adaptation_type.replace(/_/g, ' ');
        reason = '';
    }
    
    return { description, reason };
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <AdaptationExecutiveSummary userId={userId} daysBack={14} />

      <Card id="adaptations">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Settings2 className="w-5 h-5" />
          How Is The System Adapting?
        </CardTitle>
        <CardDescription>
          Every adjustment is made to help you succeed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Today's Focus (if available) */}
        {todayFocus && todayFocus.rulesApplied.length > 0 && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <h4 className="font-medium">Today's Session Plan</h4>
            </div>
            <div className="space-y-2">
              {todayFocus.rulesApplied.map((rule, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span>{rule.description}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Because: {rule.condition}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adaptation Timeline */}
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No adaptations recorded yet</p>
            <p className="text-sm mt-1">
              Difficulty adjustments will appear here as you practice.
            </p>
            <div className="mt-4 text-xs bg-muted/50 rounded-lg p-3 text-left max-w-sm mx-auto">
              <p className="font-medium mb-2">Exercises that track adaptations:</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Photo Naming
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Two Clues
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Phrase Practice
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Phonological Awareness
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Semantic Features
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Adjustments
            </h4>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {events.map(event => {
                  const { description, reason } = formatEvent(event);
                  return (
                    <div key={event.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {event.layer}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="font-medium text-sm">{description}</p>
                          {reason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Why: {reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Evidence & Outcomes Panel - clinician+ only */}
      {showEvidencePanel && (
        <AdaptationProofPanel userId={userId} daysBack={14} />
      )}
    </div>
  );
}
