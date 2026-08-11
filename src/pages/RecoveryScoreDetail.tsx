/**
 * Recovery Score Detail — Deep breakdown of the composite recovery score
 * 
 * Shows: score breakdown, trend over time, component analysis, contributing factors
 */

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUiMode } from '@/hooks/useUiMode';
import { useRecoveryScore } from '@/hooks/useRecoveryScore';
import { BackButton } from '@/components/layout/BackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, Shield, Brain, BookOpen, Zap, Battery, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, BarChart, Bar, Cell,
} from 'recharts';

const COMPONENTS = [
  { key: 'accuracy' as const, label: 'Accuracy', icon: Target, weight: '25%', description: 'How often you name words correctly, and whether that\'s improving', color: 'hsl(var(--success))' },
  { key: 'cueIndependence' as const, label: 'Independence', icon: Shield, weight: '25%', description: 'Needing less help over time — the strongest recovery signal', color: 'hsl(var(--primary))' },
  { key: 'errorQuality' as const, label: 'Error Quality', icon: Brain, weight: '15%', description: 'Even wrong answers are getting closer to correct', color: 'hsl(142, 71%, 45%)' },
  { key: 'wordMastery' as const, label: 'Word Mastery', icon: BookOpen, weight: '15%', description: 'Words you can reliably say — tangible progress', color: 'hsl(38, 92%, 50%)' },
  { key: 'latency' as const, label: 'Speed', icon: Zap, weight: '10%', description: 'Word retrieval becoming faster and more automatic', color: 'hsl(262, 83%, 58%)' },
  { key: 'endurance' as const, label: 'Endurance', icon: Battery, weight: '10%', description: 'Sustaining quality performance through longer sessions', color: 'hsl(199, 89%, 48%)' },
];

const CONFIDENCE_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  high: { label: 'High confidence', variant: 'default' },
  moderate: { label: 'Moderate confidence', variant: 'secondary' },
  low: { label: 'Limited data', variant: 'outline' },
  insufficient: { label: 'Building baseline', variant: 'outline' },
};

export default function RecoveryScoreDetail() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const isClinician = isAtLeast('clinician');
  const userId = user?.id;
  const profileId = activeProfile?.id;

  const { score, breakdown, confidence, trend, weeklyDelta, loading, history } = useRecoveryScore(userId, profileId, { persistSnapshot: false });

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const confBadge = CONFIDENCE_BADGES[confidence] ?? CONFIDENCE_BADGES.low;

  const barData = breakdown
    ? COMPONENTS.map(c => ({
        name: c.label,
        score: breakdown[c.key],
        weight: c.weight,
        color: c.color,
      }))
    : [];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <BackButton />
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Recovery Score
        </h1>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">Beta</Badge>
      </div>

      {/* Hero Score */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-2">
              <div className="text-6xl md:text-7xl font-bold text-foreground leading-none tracking-tight">
                {score ?? '—'}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
              <div className="flex items-center gap-3 mt-2">
                {weeklyDelta != null && (
                  <div className={cn(
                    'flex items-center gap-1 text-sm font-semibold',
                    weeklyDelta > 0 ? 'text-success' : weeklyDelta < 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {weeklyDelta > 0 ? <TrendingUp className="h-4 w-4" /> : weeklyDelta < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    {weeklyDelta > 0 ? '+' : ''}{weeklyDelta} this week
                  </div>
                )}
                <Badge variant={confBadge.variant}>{confBadge.label}</Badge>
              </div>
            </div>

            {/* Mini history chart */}
            {history.length >= 3 && (
              <div className="w-full md:w-72 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.slice(-30)} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      labelFormatter={l => String(l)}
                      formatter={(v: number) => [v, 'Score']}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Score Breakdown</h2>
        <div className="grid gap-3">
          {COMPONENTS.map(comp => {
            const value = breakdown?.[comp.key] ?? 0;
            const Icon = comp.icon;
            return (
              <Card key={comp.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${comp.color}15` }}>
                      <Icon className="h-4 w-4" style={{ color: comp.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{comp.label}</span>
                          {isClinician && (
                            <span className="text-[10px] text-muted-foreground font-mono">{comp.weight}</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-foreground">{Math.round(value)}</span>
                      </div>
                      <Progress value={value} className="h-2" />
                      <p className="text-[11px] text-muted-foreground mt-1">{comp.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Component Comparison Chart */}
      {barData.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Component Comparison</h2>
          <Card>
            <CardContent className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      formatter={(v: number, _name: string, entry: any) => [`${Math.round(v)} / 100 (weight: ${entry.payload.weight})`, '']}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Trend Over Time */}
      {history.length >= 5 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Score Over Time</h2>
          <Card>
            <CardContent className="p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#histGrad)" dot={{ r: 2 }} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      formatter={(v: number) => [v, 'Score']}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Scoring Methodology */}
      {isClinician && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">Scoring Methodology</h2>
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                The Recovery Score (v1) is a weighted composite of 6 normalized components.
                Each component is independently scaled to 0–100 before weighting.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {COMPONENTS.map(c => (
                  <div key={c.key} className="flex items-center gap-2 p-2 rounded bg-muted/40">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground ml-auto">{c.weight}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Accuracy + Independence = 50% (core functional recovery).
                Error quality + Word mastery = 30% (depth of recovery).
                Speed + Endurance = 20% (supporting signals).
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Disclaimer */}
      <footer className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The Recovery Score is a directional measure based on practice data. It is not a validated clinical assessment.
          Score version: v1. Formula weights may be adjusted as more data is collected.
        </p>
      </footer>
    </div>
  );
}
