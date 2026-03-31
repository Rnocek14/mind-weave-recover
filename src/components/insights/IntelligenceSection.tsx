/**
 * Intelligence Section — unified "brain" of the insights page
 * 
 * Replaces the old "How It's Adapting" + "Proof" tabs with
 * four progressive-disclosure sections:
 *  1. Summary  — instant system status + key insight
 *  2. What Changed — adaptation timeline with reasoning
 *  3. Does It Work — accuracy, latency, difficulty trends
 *  4. Cue Learning — per-user cue optimization
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Brain, ChevronDown, ChevronRight, Clock, Info, Settings2,
  Target, Timer, TrendingUp, TrendingDown, Minus, Zap,
  BarChart3, ArrowUpRight, ArrowDownRight, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';
import { useAdaptationTimeline } from '@/hooks/useAdaptationTimeline';
import { useOutcomeProof } from '@/hooks/useOutcomeProof';
import { CuePreferenceLearner, type CueType } from '@/lib/cuePreferenceLearner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { HelpLabel } from '@/components/HelpTooltip';

interface IntelligenceSectionProps {
  userId: string;
  profileId?: string;
}

export function IntelligenceSection({ userId, profileId }: IntelligenceSectionProps) {
  const { events, isLoading: timelineLoading } = useAdaptationTimeline(userId, 14);
  const { data: proof, isLoading: proofLoading } = useOutcomeProof(userId, 30);

  const isLoading = timelineLoading || proofLoading;

  // Sections open state — summary + whatChanged default open, others collapsed
  const [openSections, setOpenSections] = useState({
    whatChanged: true,
    doesItWork: false,
    cueLearning: false,
  });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6"><div className="h-24 bg-muted rounded" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Compute top-level insight
  const learner = new CuePreferenceLearner(userId);
  const cueInsight = learner.generateInsight();
  const cueState = learner.getState();
  const cueData = (['semantic', 'phonemic', 'sentence', 'visual'] as CueType[])
    .map(ct => ({
      cueType: ct,
      successRate: cueState.stats[ct].attempts > 0
        ? cueState.stats[ct].successes / cueState.stats[ct].attempts
        : 0,
      attempts: cueState.stats[ct].attempts,
    }))
    .filter(c => c.attempts > 0);

  const hasData = (proof && proof.totalTrials > 0) || events.length > 0;

  // Generate smart headline
  const headline = generateHeadline(proof, events.length, cueInsight);

  return (
    <div className="space-y-4">
      {/* ─── 1. SUMMARY ─── */}
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-1">System Intelligence</p>
              <div className="space-y-1">
                {headline.map((line, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed flex items-center gap-1.5">
                    {i === 0 ? <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : 
                     <span className="w-3.5 flex-shrink-0 text-center text-muted-foreground/60">·</span>}
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          {proof && proof.totalTrials > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <MiniStat label="Trials" value={proof.totalTrials.toLocaleString()} />
              <MiniStat
                label="Accuracy"
                value={`${Math.round(proof.overallAccuracy * 100)}%`}
                highlight={proof.overallAccuracy >= 0.7}
              />
              <MiniStat
                label="Response"
                value={proof.avgLatencyMs > 0 ? `${(proof.avgLatencyMs / 1000).toFixed(1)}s` : '—'}
              />
              <MiniStat
                label="Adaptations"
                value={proof.totalAdaptations.toString()}
                highlight={proof.totalAdaptations > 0}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Intelligence Warming Up</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Play some exercises and the system will start adapting to you.
                You'll see every adjustment and its impact here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── 2. WHAT CHANGED ─── */}
      {hasData && (
        <CollapsibleSection
          title="What Changed"
          subtitle="Every adjustment the system made and why"
          icon={<Settings2 className="w-4 h-4" />}
          open={openSections.whatChanged}
          onToggle={() => toggle('whatChanged')}
          badge={events.length > 0 ? `${events.length}` : undefined}
        >
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No adaptations recorded yet. They'll appear as you practice.
            </p>
          ) : (
            <ScrollArea className="max-h-[280px] pr-2">
              <div className="space-y-2">
                {events.slice(0, 20).map(event => {
                  const { description, reason } = formatEvent(event);
                  return (
                     <div key={event.id} className="p-3 rounded-lg border bg-card/50">
                       <div className="flex items-center gap-2 mb-1">
                         {event.adaptation_type?.includes('up') || event.adaptation_type === 'difficulty_change' && (event.value_after as any) > (event.value_before as any)
                           ? <ArrowUpRight className="w-4 h-4 text-primary flex-shrink-0" />
                           : event.adaptation_type?.includes('down') || event.adaptation_type === 'frustration_stepdown'
                           ? <ArrowDownRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                           : <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                         }
                         <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                           {event.layer}
                         </Badge>
                         <span className="text-[11px] text-muted-foreground ml-auto">
                           {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                         </span>
                       </div>
                       <p className="text-sm font-medium">{description}</p>
                       {reason && (
                         <p className="text-xs text-muted-foreground mt-0.5 italic">
                           {reason}
                         </p>
                       )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CollapsibleSection>
      )}

      {/* ─── 3. DOES IT WORK ─── */}
      {proof && proof.totalTrials > 0 && (
        <CollapsibleSection
          title="Does It Work"
          subtitle="Accuracy, response time, and difficulty trends"
          icon={<Target className="w-4 h-4" />}
          open={openSections.doesItWork}
          onToggle={() => toggle('doesItWork')}
        >
          <div className="space-y-5">
            {/* Key Takeaway */}
            {(() => {
              const takeaway = generateDoesItWorkTakeaway(proof);
              return takeaway ? (
                <Alert className="border-primary/20 bg-primary/5">
                  <Target className="h-4 w-4" />
                  <AlertDescription className="text-sm font-medium">{takeaway}</AlertDescription>
                </Alert>
              ) : null;
            })()}

            {/* Latency Trend */}
            {proof.latencyTrend.length > 1 && (
              <div>
                <p className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Timer className="w-3.5 h-3.5 text-primary" />
                  Response Time by Week
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={proof.latencyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${(value / 1000).toFixed(2)}s`, 'Avg']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgLatencyMs"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Accuracy by Exercise */}
            {proof.accuracyTrends.length > 0 && (
              <div>
                <p className="text-sm font-medium flex items-center gap-2 mb-3">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  Accuracy by Exercise
                </p>
                <div className="space-y-3">
                  {proof.accuracyTrends.slice(0, 6).map(trend => {
                    const latest = trend.windows[trend.windows.length - 1];
                    const first = trend.windows[0];
                    const improving = trend.windows.length > 1 && latest.accuracy > first.accuracy;
                    const totalTrials = trend.windows.reduce((s, w) => s + w.trials, 0);

                    return (
                      <div key={trend.exercise}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium capitalize">
                            {trend.exercise.replace(/-/g, ' ').replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">n={totalTrials}</span>
                            {trend.windows.length > 1 && (
                              improving
                                ? <TrendingUp className="w-3 h-3 text-primary" />
                                : <Minus className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              latest.accuracy >= 0.8 ? 'bg-primary' :
                              latest.accuracy >= 0.6 ? 'bg-amber-500' : 'bg-destructive'
                            )}
                            style={{ width: `${Math.round(latest.accuracy * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {trend.windows.length > 1
                            ? `${Math.round(first.accuracy * 100)}% → ${Math.round(latest.accuracy * 100)}%`
                            : `${Math.round(latest.accuracy * 100)}%`
                          }
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Difficulty Steps */}
            {proof.difficultySteps.length > 0 && (
              <div>
                <p className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Difficulty Adjustments
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {proof.difficultySteps.slice(-10).map((step, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-1.5">
                        {step.direction === 'up'
                          ? <ArrowUpRight className="w-3 h-3 text-primary" />
                          : <ArrowDownRight className="w-3 h-3 text-amber-500" />
                        }
                        <span className="text-muted-foreground capitalize">
                          {step.exercise.replace(/-/g, ' ').replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        Lv {step.levelBefore} → {step.levelAfter}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── 4. CUE LEARNING ─── */}
      {cueData.length > 0 && (
        <CollapsibleSection
          title="Cue Learning"
          subtitle="What the system has learned about your cue preferences"
          icon={<Sparkles className="w-4 h-4" />}
          open={openSections.cueLearning}
          onToggle={() => toggle('cueLearning')}
        >
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={cueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="cueType"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  domain={[0, 1]}
                />
                <Tooltip
                  formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Success']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="successRate" radius={[6, 6, 0, 0]}>
                  {cueData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.successRate >= 0.7 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {cueInsight && (
              <Alert className="border-primary/20 bg-primary/5">
                <Brain className="h-4 w-4" />
                <AlertDescription className="text-sm font-medium">{cueInsight}</AlertDescription>
              </Alert>
            )}

            {/* "So what" — action statement */}
            {(() => {
              const best = cueData.reduce((a, b) => a.successRate > b.successRate ? a : b, cueData[0]);
              return best && best.successRate > 0.5 ? (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Zap className="w-3 h-3 inline mr-1 text-primary" />
                  The system will now prioritize <span className="font-medium text-foreground">{best.cueType}</span> cues 
                  to help you respond faster, while still exploring other types occasionally.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  The system is still exploring which cue types work best for you. 
                  It uses 80% exploitation / 20% exploration to learn your preferences.
                </p>
              );
            })()}
          </div>
        </CollapsibleSection>
      )}

      {/* Confidence note */}
      {proof && proof.totalTrials > 0 && proof.totalTrials < 50 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Preliminary data ({proof.totalTrials} trials). Trends become reliable after 50+ trials.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function CollapsibleSection({
  title, subtitle, icon, open, onToggle, badge, children,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  open: boolean; onToggle: () => void; badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-primary">{icon}</span>
                <CardTitle className="text-base">{title}</CardTitle>
                {badge && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>
                )}
              </div>
              {open
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
            </div>
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn('text-lg font-bold', highlight && 'text-primary')}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function formatEvent(event: any) {
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
    case 'difficulty_change':
      const lvBefore = typeof before === 'number' ? before : (before as any)?.level ?? '?';
      const lvAfter = typeof after === 'number' ? after : (after as any)?.level ?? '?';
      const dir = lvAfter > lvBefore ? 'increased' : 'decreased';
      description = `Difficulty ${dir}: ${lvBefore} → ${lvAfter}`;
      reason = evidence.successRate
        ? `Success rate: ${Math.round(evidence.successRate * 100)}%`
        : '';
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
      reason = "You need more time—that's okay";
      break;
    default:
      description = event.adaptation_type.replace(/_/g, ' ');
      reason = '';
  }

  return { description, reason };
}

function generateHeadline(
  proof: ReturnType<typeof useOutcomeProof>['data'],
  adaptationCount: number,
  cueInsight: string | null,
): string {
  if (!proof || proof.totalTrials === 0) {
    return 'The system is ready to adapt to you. Start practicing to see intelligence in action.';
  }

  const parts: string[] = [];

  // Accuracy assessment
  if (proof.overallAccuracy >= 0.85) {
    parts.push('You\'re performing strongly');
  } else if (proof.overallAccuracy >= 0.7) {
    parts.push('The system is keeping you in the optimal challenge zone');
  } else {
    parts.push('The system is adjusting to find your sweet spot');
  }

  // Latency trend
  if (proof.latencyTrend.length >= 2) {
    const first = proof.latencyTrend[0].avgLatencyMs;
    const last = proof.latencyTrend[proof.latencyTrend.length - 1].avgLatencyMs;
    const change = Math.round(((first - last) / first) * 100);
    if (change > 10) {
      parts.push(`response time improved ${change}%`);
    }
  }

  // Adaptations
  if (adaptationCount > 0) {
    parts.push(`${adaptationCount} real-time adjustments made`);
  }

  // Cue learning
  if (cueInsight) {
    parts.push(cueInsight.toLowerCase());
  }

  return parts.join('. ') + '.';
}
