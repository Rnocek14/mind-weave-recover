/**
 * Unified Analytics + Adaptation Panel
 * 
 * Single source of truth for:
 * - Tab 1: Recovery Insights (analytics consolidation)
 * - Tab 2: Adaptation Inspector (active adaptations + timeline)
 * 
 * Supports Patient/Caregiver/Clinician/Admin view modes.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Settings2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useUnifiedAnalytics, type ActiveAdaptation } from '@/hooks/useUnifiedAnalytics';
import { useUiMode } from '@/hooks/useUiMode';
import { formatDistanceToNow } from 'date-fns';
import type { TodayFocus, ConfidenceLevel } from '@/lib/adaptiveDecisionEngine';
import { getConfidenceBadgeColor } from '@/lib/adaptiveDecisionEngine';
import { cn } from '@/lib/utils';

interface UnifiedAnalyticsPanelProps {
  userId: string;
  profileId?: string;
  todayFocus: TodayFocus | null;
  defaultTab?: 'insights' | 'adaptations';
}

export const UnifiedAnalyticsPanel = ({
  userId,
  profileId,
  todayFocus,
  defaultTab = 'insights' as const,
}: UnifiedAnalyticsPanelProps) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const { uiMode, isAtLeast } = useUiMode();
  
  const {
    analytics,
    activeAdaptations,
    adaptationTimeline,
    refresh,
  } = useUnifiedAnalytics(userId, profileId, todayFocus);

  const showAdaptationsTab = isAtLeast('caregiver');
  const showDetailedEvidence = isAtLeast('clinician');
  const showAdminDiagnostics = uiMode === 'admin';

  if (analytics.isLoading) {
    return <UnifiedAnalyticsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="insights" className="gap-2">
              <Activity className="w-4 h-4" />
              Insights
            </TabsTrigger>
            {showAdaptationsTab && (
              <TabsTrigger value="adaptations" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Adaptations
                {activeAdaptations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeAdaptations.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
          
          <Button variant="ghost" size="sm" onClick={refresh} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {/* Tab 1: Recovery Insights */}
        <TabsContent value="insights" className="space-y-4">
          <InsightsTab 
            analytics={analytics} 
            showEvidence={showDetailedEvidence}
            showAdmin={showAdminDiagnostics}
          />
        </TabsContent>

        {/* Tab 2: Adaptation Inspector */}
        {showAdaptationsTab && (
          <TabsContent value="adaptations" className="space-y-4">
            <AdaptationsTab
              todayFocus={todayFocus}
              activeAdaptations={activeAdaptations}
              timeline={adaptationTimeline}
              showEvidence={showDetailedEvidence}
              showAdmin={showAdminDiagnostics}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// ============ Tab 1: Insights ============

interface InsightsTabProps {
  analytics: ReturnType<typeof useUnifiedAnalytics>['analytics'];
  showEvidence: boolean;
  showAdmin: boolean;
}

const InsightsTab = ({ analytics, showEvidence, showAdmin }: InsightsTabProps) => {
  const { summary, trends, cues, challenges, recommendations, alerts, dataCompleteness } = analytics;

  const TrendIcon = summary.trend === 'improving' ? TrendingUp :
                    summary.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = summary.trend === 'improving' ? 'text-success' :
                     summary.trend === 'declining' ? 'text-warning' : 'text-primary';

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Accuracy"
          value={`${summary.overallAccuracy}%`}
          subtitle={`${summary.totalTrials} trials`}
          icon={<Target className="w-4 h-4" />}
        />
        <KPICard
          label="Sessions"
          value={summary.totalSessions.toString()}
          subtitle={`last ${analytics.window.days} days`}
          icon={<Activity className="w-4 h-4" />}
        />
        <KPICard
          label="Trend"
          value={<span className={trendColor}><TrendIcon className="w-5 h-5" /></span>}
          subtitle={summary.trend.replace('_', ' ')}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KPICard
          label="Best Strategy"
          value={cues.length > 0 
            ? cues.reduce((a, b) => a.successRate > b.successRate ? a : b).cueType 
            : 'N/A'}
          subtitle={cues.length > 0 
            ? `${Math.round(cues.reduce((a, b) => a.successRate > b.successRate ? a : b).successRate * 100)}% effective`
            : 'Building baseline'}
          icon={<Lightbulb className="w-4 h-4" />}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {alerts.length} alert{alerts.length > 1 ? 's' : ''}: {alerts[0].message}
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Challenges */}
      {challenges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4" />
              Current Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {challenges.map((challenge, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <Badge variant={challenge.severity === 'high' ? 'destructive' : 'secondary'}>
                  {challenge.severity}
                </Badge>
                <span className="text-sm">{challenge.description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Domain Trends (Clinician+) */}
      {showEvidence && trends.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Learning Rates by Domain</CardTitle>
            <CardDescription>Accuracy slope over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.map(trend => (
                <div key={trend.domain} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span className="font-medium capitalize">{trend.domain}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm',
                      trend.trend === 'improving' ? 'text-success' : 
                      trend.trend === 'declining' ? 'text-warning' : 'text-muted-foreground'
                    )}>
                      {trend.accuracySlope > 0 ? '+' : ''}{(trend.accuracySlope * 100).toFixed(1)}%/week
                    </span>
                    <Badge variant="outline" className="text-xs">
                      n={trend.trialCount}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Completeness (Admin) */}
      {showAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Data Completeness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(dataCompleteness).map(([key, has]) => (
                <div key={key} className="flex items-center gap-2">
                  {has ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={has ? '' : 'text-muted-foreground'}>
                    {key.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ============ Tab 2: Adaptations ============

interface AdaptationsTabProps {
  todayFocus: TodayFocus | null;
  activeAdaptations: ActiveAdaptation[];
  timeline: ReturnType<typeof useUnifiedAnalytics>['adaptationTimeline'];
  showEvidence: boolean;
  showAdmin: boolean;
}

const AdaptationsTab = ({
  todayFocus,
  activeAdaptations,
  timeline,
  showEvidence,
  showAdmin,
}: AdaptationsTabProps) => {
  const [rulesExpanded, setRulesExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Confidence Badge */}
      {todayFocus && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Badge className={getConfidenceBadgeColor(todayFocus.confidence)}>
            {todayFocus.confidence} Confidence
          </Badge>
          <span className="text-sm text-muted-foreground">
            Based on {todayFocus.inputSnapshot.trialCount} trials, {todayFocus.inputSnapshot.utteranceCount} utterances
          </span>
        </div>
      )}

      {/* Active Adaptations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Active Adaptations
            {activeAdaptations.length === 0 && (
              <Badge variant="outline" className="ml-2">None</Badge>
            )}
          </CardTitle>
          <CardDescription>
            System adjustments currently applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeAdaptations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No adaptations active. Performance is within normal range.
            </p>
          ) : (
            <div className="space-y-3">
              {activeAdaptations.map((adaptation, i) => (
                <AdaptationCard key={i} adaptation={adaptation} showEvidence={showEvidence} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Inspector (Clinician+) */}
      {showEvidence && todayFocus && (
        <Collapsible open={rulesExpanded} onOpenChange={setRulesExpanded}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Rule Inspector</CardTitle>
                {rulesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2">
                {todayFocus.rulesApplied.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules fired</p>
                ) : (
                  todayFocus.rulesApplied.map((rule, i) => (
                    <div key={i} className="p-3 rounded border bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="font-medium text-sm">{rule.ruleId}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                      <p className="text-xs mt-1"><strong>Condition:</strong> {rule.condition}</p>
                      <p className="text-xs"><strong>Adaptation:</strong> {rule.adaptation}</p>
                    </div>
                  ))
                )}
                
                {/* Show reasoning */}
                {todayFocus.reasoning.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium mb-1">Reasoning:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {todayFocus.reasoning.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Adaptation Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Adaptations
            </CardTitle>
            <CardDescription>In-game adjustments made during sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {timeline.map(event => (
                  <div key={event.id} className="flex items-start gap-3 p-2 rounded bg-muted/30 text-sm">
                    <div className="flex-shrink-0 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {event.layer}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{event.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {timeline.length === 0 && (
        <Alert>
          <AlertDescription>
            No adaptation events logged yet. Events will appear here as you play.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// ============ Subcomponents ============

const KPICard = ({ 
  label, 
  value, 
  subtitle, 
  icon 
}: { 
  label: string; 
  value: React.ReactNode; 
  subtitle: string; 
  icon: React.ReactNode;
}) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-primary">{icon}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-muted-foreground">{subtitle}</div>
  </Card>
);

const AdaptationCard = ({ 
  adaptation, 
  showEvidence 
}: { 
  adaptation: ActiveAdaptation; 
  showEvidence: boolean;
}) => (
  <div className="p-3 rounded-lg border bg-card">
    <div className="flex items-center justify-between mb-1">
      <span className="font-medium text-sm">
        {adaptation.adaptationType.replace(/_/g, ' ')}
      </span>
      <Badge variant="outline">{String(adaptation.currentValue)}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">{adaptation.triggerReason}</p>
    {showEvidence && adaptation.evidenceSummary && (
      <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">
        <strong>Evidence:</strong> {adaptation.evidenceSummary}
      </p>
    )}
  </div>
);

const UnifiedAnalyticsSkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-4">
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-28" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
    <Skeleton className="h-40" />
  </div>
);
