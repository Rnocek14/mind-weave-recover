/**
 * Recovery Progress — Longitudinal outcomes visualization (Beta)
 * 
 * Shows 4 core recovery metrics over time:
 * 1. Accuracy Trajectory
 * 2. Cue Independence  
 * 3. Word Mastery
 * 4. Error Quality Evolution
 * 
 * Positioned as internal/demo/beta — not clinical proof yet.
 */

import { useAuth } from '@/hooks/useAuth';
import { useLearningRate } from '@/hooks/useLearningRate';
import { useCueIndependence } from '@/hooks/useCueIndependence';
import { useWordMastery } from '@/hooks/useWordMastery';
import { useErrorQualityScore } from '@/hooks/useErrorQualityScore';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Brain, BookOpen, Shield, ArrowRight, Info } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';

// ── Tunable thresholds (centralized for easy adjustment) ──
const THRESHOLDS = {
  mastery: { minAttempts: 3, masteredAccuracy: 0.8, emergingAccuracy: 0.4, maxCueForMastered: 1 },
  cueIndependence: { improvingDelta: 0.03, decliningDelta: -0.03 },
  errorQuality: { improvingDelta: 0.05, decliningDelta: -0.05 },
  accuracy: { strongSlope: 0.02, weakSlope: -0.01 },
  comparison: { recentWindowDays: 14 },
};

function TrendBadge({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'insufficient' }) {
  const config = {
    improving: { label: 'Improving', icon: TrendingUp, variant: 'default' as const, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
    stable: { label: 'Stable', icon: Minus, variant: 'secondary' as const, className: 'bg-muted text-muted-foreground' },
    declining: { label: 'Declining', icon: TrendingDown, variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive border-destructive/20' },
    insufficient: { label: 'Not enough data', icon: AlertTriangle, variant: 'outline' as const, className: 'text-muted-foreground' },
  };
  const c = config[trend];
  const Icon = c.icon;
  return (
    <Badge variant={c.variant} className={`gap-1 ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function ScoreDisplay({ value, label, format: fmt = 'percent' }: { value: number | null; label: string; format?: 'percent' | 'count' | 'ratio' }) {
  if (value === null) return (
    <div className="text-center">
      <div className="text-2xl font-bold text-muted-foreground">—</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
  const display = fmt === 'percent' ? `${Math.round(value * 100)}%`
    : fmt === 'ratio' ? value.toFixed(2)
    : String(value);
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-foreground">{display}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MiniTrendChart({ data, dataKey, color }: { data: { date: string; value: number }[]; dataKey: string; color: string }) {
  if (data.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">Not enough data points</div>;
  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} dot={false} />
        <RechartsTooltip
          contentStyle={{ fontSize: 11, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          labelFormatter={(l) => l}
          formatter={(v: number) => [`${Math.round(v * 100)}%`, '']}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function RecoveryProgress() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const userId = user?.id;

  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { dataPoints: cueData, currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId);
  const { words, mastered, emerging, struggling, loading: wordLoading } = useWordMastery(userId);
  const { dataPoints: errorData, currentScore: errorScore, trend: errorTrend, loading: errorLoading } = useErrorQualityScore(userId);

  const loading = lrLoading || cueLoading || wordLoading || errorLoading;
  const strokeDate = activeProfile?.stroke_date;
  const daysInProgram = strokeDate ? differenceInDays(new Date(), new Date(strokeDate)) : null;

  // Derive accuracy trend from learning rates
  const speechRate = learningRates?.find(r => r.domain === 'naming' || r.domain === 'speech_therapy');
  const accuracyTrend: 'improving' | 'stable' | 'declining' | 'insufficient' =
    !speechRate ? 'insufficient'
    : (speechRate.accuracySlope ?? 0) > THRESHOLDS.accuracy.strongSlope ? 'improving'
    : (speechRate.accuracySlope ?? 0) < THRESHOLDS.accuracy.weakSlope ? 'declining'
    : 'stable';

  // Build comparison: first 2 weeks vs recent 2 weeks from cue data
  const comparison = (() => {
    if (cueData.length < 4) return null;
    const sorted = [...cueData].sort((a, b) => a.date.localeCompare(b.date));
    const early = sorted.slice(0, Math.min(7, Math.floor(sorted.length / 2)));
    const recent = sorted.slice(-Math.min(7, Math.floor(sorted.length / 2)));
    const avgEarly = early.reduce((s, d) => s + d.independenceScore, 0) / early.length;
    const avgRecent = recent.reduce((s, d) => s + d.independenceScore, 0) / recent.length;
    return {
      earlyPeriod: `${early[0]?.date} – ${early[early.length - 1]?.date}`,
      recentPeriod: `${recent[0]?.date} – ${recent[recent.length - 1]?.date}`,
      earlyIndependence: avgEarly,
      recentIndependence: avgRecent,
      delta: avgRecent - avgEarly,
    };
  })();

  // Word movement evidence
  const recentMastered = words
    .filter(w => w.level === 'mastered')
    .sort((a, b) => b.lastAttempted.localeCompare(a.lastAttempted))
    .slice(0, 5);
  const recentEmerging = words
    .filter(w => w.level === 'emerging')
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Recovery Progress</h1>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Longitudinal recovery tracking across key functional dimensions.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {strokeDate && (
            <span>Baseline: {format(new Date(strokeDate), 'MMM d, yyyy')}</span>
          )}
          {daysInProgram !== null && (
            <span>{daysInProgram} days in program</span>
          )}
          <span>Last updated: {format(new Date(), 'MMM d, yyyy')}</span>
        </div>
      </div>

      {/* ── 4 Core Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Accuracy Trajectory */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Accuracy Trajectory</CardTitle>
              </div>
              <TrendBadge trend={accuracyTrend} />
            </div>
            <CardDescription className="text-xs">Naming accuracy over time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-around">
              <ScoreDisplay value={speechRate?.endAccuracy ?? null} label="Current" />
              <ScoreDisplay value={speechRate?.startAccuracy ?? null} label="Baseline" />
              <ScoreDisplay
                value={speechRate ? (speechRate.endAccuracy ?? 0) - (speechRate.startAccuracy ?? 0) : null}
                label="Change"
              />
            </div>
            {speechRate && (
              <div className="text-xs text-muted-foreground text-center">
                {speechRate.trialCount} trials over {speechRate.window} days
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Cue Independence */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Cue Independence</CardTitle>
              </div>
              <TrendBadge trend={cueTrend} />
            </div>
            <CardDescription className="text-xs">Performing without support</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreDisplay value={cueScore} label="Independence Score" />
            <MiniTrendChart
              data={cueData.map(d => ({ date: d.date, value: d.independenceScore }))}
              dataKey="cue"
              color="hsl(142, 71%, 45%)"
            />
          </CardContent>
        </Card>

        {/* 3. Word Mastery */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Word Mastery</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">{words.length} words tracked</Badge>
            </div>
            <CardDescription className="text-xs">Words reliably retrieved without support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around mb-3">
              <ScoreDisplay value={mastered} label="Mastered" format="count" />
              <ScoreDisplay value={emerging} label="Emerging" format="count" />
              <ScoreDisplay value={struggling} label="Struggling" format="count" />
            </div>
            {words.length > 0 && (
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(mastered / words.length) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${(emerging / words.length) * 100}%` }}
                />
                <div
                  className="h-full bg-destructive/60 transition-all"
                  style={{ width: `${(struggling / words.length) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Error Quality */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Error Quality</CardTitle>
              </div>
              <TrendBadge trend={errorTrend} />
            </div>
            <CardDescription className="text-xs">Errors shifting from severe to mild</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreDisplay value={errorScore} label="Quality Score" />
            <MiniTrendChart
              data={errorData.map(d => ({ date: d.date, value: d.qualityScore }))}
              dataKey="error"
              color="hsl(217, 91%, 60%)"
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Comparison Block ── */}
      {comparison && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Early vs Recent Comparison</CardTitle>
            <CardDescription className="text-xs">Cue independence: first sessions vs most recent sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around gap-4">
              <div className="text-center space-y-1">
                <div className="text-xs text-muted-foreground">Early</div>
                <div className="text-lg font-semibold text-foreground">{Math.round(comparison.earlyIndependence * 100)}%</div>
                <div className="text-[10px] text-muted-foreground">{comparison.earlyPeriod}</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <Badge
                  variant={comparison.delta > 0 ? 'default' : comparison.delta < 0 ? 'destructive' : 'secondary'}
                  className={comparison.delta > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : ''}
                >
                  {comparison.delta > 0 ? '+' : ''}{Math.round(comparison.delta * 100)}%
                </Badge>
              </div>
              <div className="text-center space-y-1">
                <div className="text-xs text-muted-foreground">Recent</div>
                <div className="text-lg font-semibold text-foreground">{Math.round(comparison.recentIndependence * 100)}%</div>
                <div className="text-[10px] text-muted-foreground">{comparison.recentPeriod}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Evidence: Word Movement ── */}
      {(recentMastered.length > 0 || recentEmerging.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Word Progress Evidence</CardTitle>
            <CardDescription className="text-xs">Words moving toward mastery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentMastered.length > 0 && (
              <div>
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">Mastered</div>
                <div className="flex flex-wrap gap-2">
                  {recentMastered.map(w => (
                    <Badge key={w.word} variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                      {w.word} <span className="ml-1 text-[10px] opacity-70">{Math.round(w.accuracy * 100)}%</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {recentEmerging.length > 0 && (
              <div>
                <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Emerging</div>
                <div className="flex flex-wrap gap-2">
                  {recentEmerging.map(w => (
                    <Badge key={w.word} variant="outline" className="bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-400/20">
                      {w.word} <span className="ml-1 text-[10px] opacity-70">{Math.round(w.accuracy * 100)}%</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Disclaimer ── */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Outcome metrics are directional and intended for clinical review. 
          These measures have not been independently validated and should be interpreted 
          alongside formal assessments. Thresholds may be adjusted as more data becomes available.
        </p>
      </div>
    </div>
  );
}
