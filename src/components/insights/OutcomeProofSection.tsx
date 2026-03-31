/**
 * Outcome Proof Section
 * 
 * Surfaces observable intelligence metrics:
 * - Difficulty progression over sessions
 * - Success rate windows  
 * - Cue effectiveness by type
 * - Latency improvement trends
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, TrendingDown, Brain, Zap, Timer, Target, 
  BarChart3, ArrowUpRight, ArrowDownRight, Minus, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, Cell 
} from 'recharts';
import { useOutcomeProof } from '@/hooks/useOutcomeProof';
import { cn } from '@/lib/utils';

interface OutcomeProofSectionProps {
  userId: string;
  profileId?: string;
  daysBack?: number;
}

export function OutcomeProofSection({ userId, daysBack = 30 }: OutcomeProofSectionProps) {
  const { data, isLoading } = useOutcomeProof(userId, daysBack);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data || data.totalTrials === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No Outcome Data Yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Play some exercises to see how the system is adapting and improving your results.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Trials"
          value={data.totalTrials.toLocaleString()}
          icon={<Target className="w-4 h-4" />}
        />
        <StatCard
          label="Overall Accuracy"
          value={`${Math.round(data.overallAccuracy * 100)}%`}
          icon={<BarChart3 className="w-4 h-4" />}
          highlight={data.overallAccuracy >= 0.7}
        />
        <StatCard
          label="Avg Response"
          value={data.avgLatencyMs > 0 ? `${(data.avgLatencyMs / 1000).toFixed(1)}s` : '—'}
          icon={<Timer className="w-4 h-4" />}
        />
        <StatCard
          label="Adaptations"
          value={data.totalAdaptations.toString()}
          icon={<Zap className="w-4 h-4" />}
          highlight={data.totalAdaptations > 0}
        />
      </div>

      {/* Difficulty Progression */}
      {data.difficultySteps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Difficulty Progression
            </CardTitle>
            <CardDescription>
              Real-time difficulty adjustments made by the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.difficultySteps.slice(-15).map((step, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {step.direction === 'up' ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className="text-muted-foreground capitalize">
                      {step.exercise.replace(/-/g, ' ').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Lv {step.levelBefore} → {step.levelAfter}
                    </span>
                    <Badge 
                      variant={step.direction === 'up' ? 'default' : 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {Math.round(step.successRate * 100)}% acc
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latency Trend */}
      {data.latencyTrend.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Response Time Trend
            </CardTitle>
            <CardDescription>
              Average response time by week — lower is better
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.latencyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="weekLabel" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
                />
                <Tooltip 
                  formatter={(value: number) => [`${(value / 1000).toFixed(2)}s`, 'Avg Response']}
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
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Accuracy by Exercise */}
      {data.accuracyTrends.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Accuracy by Exercise
            </CardTitle>
            <CardDescription>
              Weekly accuracy across your most-played exercises
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.accuracyTrends.slice(0, 6).map(trend => {
                const latestWindow = trend.windows[trend.windows.length - 1];
                const firstWindow = trend.windows[0];
                const improving = trend.windows.length > 1 && latestWindow.accuracy > firstWindow.accuracy;
                const totalTrials = trend.windows.reduce((s, w) => s + w.trials, 0);

                return (
                  <div key={trend.exercise}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium capitalize">
                        {trend.exercise.replace(/-/g, ' ').replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">n={totalTrials}</span>
                        {trend.windows.length > 1 && (
                          improving ? (
                            <TrendingUp className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                          )
                        )}
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          latestWindow.accuracy >= 0.8 ? 'bg-primary' :
                          latestWindow.accuracy >= 0.6 ? 'bg-amber-500' : 'bg-destructive'
                        )}
                        style={{ width: `${Math.round(latestWindow.accuracy * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>
                        {trend.windows.length > 1 
                          ? `${Math.round(firstWindow.accuracy * 100)}% → ${Math.round(latestWindow.accuracy * 100)}%`
                          : `${Math.round(latestWindow.accuracy * 100)}%`
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cue Effectiveness */}
      {data.cueEffectiveness.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Cue Effectiveness
            </CardTitle>
            <CardDescription>
              Which support types work best for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.cueEffectiveness}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="cueType" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  domain={[0, 1]}
                />
                <Tooltip 
                  formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Success Rate']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="successRate" radius={[6, 6, 0, 0]}>
                  {data.cueEffectiveness.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.successRate >= 0.7 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {data.cueInsight && (
              <Alert className="mt-3">
                <Brain className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {data.cueInsight}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data confidence note */}
      {data.totalTrials < 50 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Results are preliminary ({data.totalTrials} trials). 
            Trends become more reliable after 50+ trials across multiple sessions.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { 
  label: string; value: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && 'border-primary/30')}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className={cn('text-xl font-bold', highlight && 'text-primary')}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
