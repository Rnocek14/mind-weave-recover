/**
 * Recovery Progress — Longitudinal outcomes visualization
 * 
 * The central "proof of recovery" page. Answers:
 * - "Is this person recovering?"
 * - "How do we know?"
 * - "What specifically is improving?"
 * 
 * Role-aware: patients see encouraging plain language,
 * clinicians see full metric detail.
 */

import { useAuth } from '@/hooks/useAuth';
import { useLearningRate } from '@/hooks/useLearningRate';
import { useCueIndependence } from '@/hooks/useCueIndependence';
import { useWordMastery } from '@/hooks/useWordMastery';
import { useErrorQualityScore } from '@/hooks/useErrorQualityScore';
import { useProfile } from '@/hooks/useProfile';
import { useUiMode } from '@/hooks/useUiMode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Brain, BookOpen, Shield, ArrowRight, Info, Sparkles } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  ResponsiveContainer, Area, AreaChart, Tooltip as RechartsTooltip,
} from 'recharts';

// ── Tunable thresholds (centralized for easy adjustment) ──
const THRESHOLDS = {
  mastery: { minAttempts: 3, masteredAccuracy: 0.8, emergingAccuracy: 0.4, maxCueForMastered: 1 },
  cueIndependence: { improvingDelta: 0.03, decliningDelta: -0.03 },
  errorQuality: { improvingDelta: 0.05, decliningDelta: -0.05 },
  accuracy: { strongSlope: 0.02, weakSlope: -0.01 },
};

function TrendBadge({ trend }: { trend: 'improving' | 'stable' | 'declining' | 'insufficient' }) {
  const config = {
    improving: { label: 'Improving', icon: TrendingUp, variant: 'default' as const, className: 'bg-success/10 text-success border-success/20' },
    stable: { label: 'Stable', icon: Minus, variant: 'secondary' as const, className: 'bg-muted text-muted-foreground' },
    declining: { label: 'Needs attention', icon: TrendingDown, variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive border-destructive/20' },
    insufficient: { label: 'Building data', icon: AlertTriangle, variant: 'outline' as const, className: 'text-muted-foreground' },
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

/** Plain-language trend for patients */
function patientTrendText(trend: 'improving' | 'stable' | 'declining' | 'insufficient'): string {
  switch (trend) {
    case 'improving': return 'Getting stronger 🎉';
    case 'stable': return 'Holding steady';
    case 'declining': return 'Let\'s keep practicing';
    case 'insufficient': return 'Keep going — building your data';
  }
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
  if (data.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">Not enough data points yet</div>;
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

/** Compute a simple recovery headline from the 4 core metrics */
function getRecoveryHeadline(
  accuracyTrend: string,
  cueTrend: string,
  mastered: number,
  errorTrend: string,
): { text: string; subtext: string; positive: boolean } {
  const improving = [accuracyTrend, cueTrend, errorTrend].filter(t => t === 'improving').length;
  const declining = [accuracyTrend, cueTrend, errorTrend].filter(t => t === 'declining').length;

  if (improving >= 2 && mastered > 0) {
    return { text: 'Recovery is progressing', subtext: `${mastered} words mastered, multiple metrics improving`, positive: true };
  }
  if (improving >= 1) {
    return { text: 'Signs of improvement', subtext: 'Some metrics trending positively', positive: true };
  }
  if (declining >= 2) {
    return { text: 'Progress has slowed', subtext: 'Some areas need attention — keep practicing', positive: false };
  }
  return { text: 'Building your recovery picture', subtext: 'More sessions will strengthen these trends', positive: true };
}

export default function RecoveryProgress() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const isClinician = isAtLeast('clinician');
  const userId = user?.id;

  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { dataPoints: cueData, currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId);
  const { words, mastered, emerging, struggling, loading: wordLoading } = useWordMastery(userId);
  const { dataPoints: errorData, currentScore: errorScore, trend: errorTrend, loading: errorLoading } = useErrorQualityScore(userId);

  const loading = lrLoading || cueLoading || wordLoading || errorLoading;
  const strokeDate = activeProfile?.stroke_date;
  const daysInProgram = strokeDate ? differenceInDays(new Date(), new Date(strokeDate)) : null;

  const speechRate = learningRates?.find(r => r.domain === 'naming' || r.domain === 'speech_therapy');
  const accuracyTrend: 'improving' | 'stable' | 'declining' | 'insufficient' =
    !speechRate ? 'insufficient'
    : (speechRate.accuracySlope ?? 0) > THRESHOLDS.accuracy.strongSlope ? 'improving'
    : (speechRate.accuracySlope ?? 0) < THRESHOLDS.accuracy.weakSlope ? 'declining'
    : 'stable';

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

  const recentMastered = words.filter(w => w.level === 'mastered').sort((a, b) => b.lastAttempted.localeCompare(a.lastAttempted)).slice(0, 5);
  const recentEmerging = words.filter(w => w.level === 'emerging').sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);

  const headline = getRecoveryHeadline(accuracyTrend, cueTrend, mastered, errorTrend);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Recovery Summary Header ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Recovery Progress</h1>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </div>

        {/* Big headline — the answer to "Is this working?" */}
        <Card className={`p-5 border-2 ${headline.positive ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
          <div className="flex items-center gap-3">
            <Sparkles className={`w-6 h-6 shrink-0 ${headline.positive ? 'text-success' : 'text-warning'}`} />
            <div>
              <h2 className="text-lg font-bold text-foreground">{headline.text}</h2>
              <p className="text-sm text-muted-foreground">{headline.subtext}</p>
            </div>
          </div>
        </Card>

        {/* Context bar */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {strokeDate && <span>Baseline: {format(new Date(strokeDate), 'MMM d, yyyy')}</span>}
          {daysInProgram !== null && <span>{daysInProgram} days in program</span>}
          <span>Updated {format(new Date(), 'MMM d')}</span>
        </div>
      </div>

      {/* ── Word Mastery (lead with the most tangible metric) ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">
                {isClinician ? 'Word Mastery' : 'Words You Can Say'}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">{words.length} tracked</Badge>
          </div>
          <CardDescription className="text-xs">
            {isClinician
              ? 'Words reliably retrieved without support (≥80% accuracy, cue level ≤1)'
              : 'Words you can find and say on your own'}
          </CardDescription>
          <p className="text-[11px] text-muted-foreground/70 italic mt-1">
            {isClinician
              ? 'Why it matters: Demonstrates functional vocabulary recovery beyond repeated practice'
              : 'Shows words you can now say on your own — real progress'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around mb-3">
            <ScoreDisplay value={mastered} label={isClinician ? 'Mastered' : '✅ Got it'} format="count" />
            <ScoreDisplay value={emerging} label={isClinician ? 'Emerging' : '📈 Getting there'} format="count" />
            <ScoreDisplay value={struggling} label={isClinician ? 'Struggling' : '💪 Practicing'} format="count" />
          </div>
          {words.length > 0 && (
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-success transition-all" style={{ width: `${(mastered / words.length) * 100}%` }} />
              <div className="h-full bg-warning transition-all" style={{ width: `${(emerging / words.length) * 100}%` }} />
              <div className="h-full bg-destructive/60 transition-all" style={{ width: `${(struggling / words.length) * 100}%` }} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Core Metrics Grid (2x2) ── */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">
          {isClinician ? 'Core Recovery Metrics' : 'How You\'re Doing'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Accuracy Trajectory */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    {isClinician ? 'Accuracy Trajectory' : 'Getting It Right'}
                  </CardTitle>
                </div>
                {isClinician ? <TrendBadge trend={accuracyTrend} /> : (
                  <span className="text-xs font-medium text-muted-foreground">{patientTrendText(accuracyTrend)}</span>
                )}
              </div>
              <CardDescription className="text-xs">
                {isClinician ? 'Naming accuracy over time' : 'How often you say the right word'}
              </CardDescription>
              <p className="text-[11px] text-muted-foreground/70 italic mt-1">
                {isClinician
                  ? 'Why it matters: Core language performance trend across targeted tasks'
                  : 'Tracks how often you get the right word over time'}
              </p>
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
              {isClinician && speechRate && (
                <div className="text-xs text-muted-foreground text-center">
                  {speechRate.trialCount} trials over {speechRate.window} days
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cue Independence */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    {isClinician ? 'Cue Independence' : 'Doing It On Your Own'}
                  </CardTitle>
                </div>
                {isClinician ? <TrendBadge trend={cueTrend} /> : (
                  <span className="text-xs font-medium text-muted-foreground">{patientTrendText(cueTrend)}</span>
                )}
              </div>
              <CardDescription className="text-xs">
                {isClinician ? 'Performing without cueing support' : 'Needing less help over time'}
              </CardDescription>
              <p className="text-[11px] text-muted-foreground/70 italic mt-1">
                {isClinician
                  ? 'Why it matters: Reduced cue dependence is a stronger recovery signal than accuracy alone'
                  : 'Shows whether you need less help over time — a key sign of progress'}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <ScoreDisplay value={cueScore} label={isClinician ? 'Independence Score' : 'Independence'} />
              <MiniTrendChart
                data={cueData.map(d => ({ date: d.date, value: d.independenceScore }))}
                dataKey="cue"
                color="hsl(var(--success))"
              />
            </CardContent>
          </Card>

          {/* Error Quality */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    {isClinician ? 'Error Quality' : 'Closer Answers'}
                  </CardTitle>
                </div>
                {isClinician ? <TrendBadge trend={errorTrend} /> : (
                  <span className="text-xs font-medium text-muted-foreground">{patientTrendText(errorTrend)}</span>
                )}
              </div>
              <CardDescription className="text-xs">
                {isClinician ? 'Errors shifting from severe (neologisms) to mild (phonemic)' : 'When you miss, you\'re getting closer to the right word'}
              </CardDescription>
              <p className="text-[11px] text-muted-foreground/70 italic mt-1">
                {isClinician
                  ? 'Why it matters: Error type evolution reveals neurological improvement before accuracy fully catches up'
                  : 'Even wrong answers can show progress — your guesses are getting closer'}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <ScoreDisplay value={errorScore} label={isClinician ? 'Quality Score' : 'Error Quality'} />
              <MiniTrendChart
                data={errorData.map(d => ({ date: d.date, value: d.qualityScore }))}
                dataKey="error"
                color="hsl(var(--primary))"
              />
            </CardContent>
          </Card>

          {/* Early vs Recent — only if data exists */}
          {comparison && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isClinician ? 'Early vs Recent' : 'Then vs Now'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isClinician ? 'Cue independence comparison across periods' : 'How much more independent you are'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-around gap-4">
                  <div className="text-center space-y-1">
                    <div className="text-xs text-muted-foreground">{isClinician ? 'Early' : 'Start'}</div>
                    <div className="text-lg font-semibold text-foreground">{Math.round(comparison.earlyIndependence * 100)}%</div>
                    {isClinician && <div className="text-[10px] text-muted-foreground">{comparison.earlyPeriod}</div>}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <Badge
                      variant={comparison.delta > 0 ? 'default' : comparison.delta < 0 ? 'destructive' : 'secondary'}
                      className={comparison.delta > 0 ? 'bg-success/10 text-success' : ''}
                    >
                      {comparison.delta > 0 ? '+' : ''}{Math.round(comparison.delta * 100)}%
                    </Badge>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xs text-muted-foreground">{isClinician ? 'Recent' : 'Now'}</div>
                    <div className="text-lg font-semibold text-foreground">{Math.round(comparison.recentIndependence * 100)}%</div>
                    {isClinician && <div className="text-[10px] text-muted-foreground">{comparison.recentPeriod}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Word Evidence ── */}
      {(recentMastered.length > 0 || recentEmerging.length > 0) && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">
            {isClinician ? 'Word Progress Evidence' : 'Words Making Progress'}
          </h2>
          <Card>
            <CardContent className="pt-4 space-y-4">
              {recentMastered.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-success mb-2">
                    {isClinician ? 'Mastered' : '✅ You got these!'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentMastered.map(w => (
                      <Badge key={w.word} variant="outline" className="bg-success/10 text-success border-success/20">
                        {w.word}
                        {isClinician && <span className="ml-1 text-[10px] opacity-70">{Math.round(w.accuracy * 100)}%</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {recentEmerging.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-warning mb-2">
                    {isClinician ? 'Emerging' : '📈 Getting closer'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentEmerging.map(w => (
                      <Badge key={w.word} variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        {w.word}
                        {isClinician && <span className="ml-1 text-[10px] opacity-70">{Math.round(w.accuracy * 100)}%</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          {isClinician
            ? 'Outcome metrics are directional and intended for clinical review. These measures have not been independently validated and should be interpreted alongside formal assessments. Thresholds may be adjusted as more data becomes available.'
            : 'These scores show your practice trends over time. They are not medical test results — talk to your therapist about your full progress.'}
        </p>
      </div>
    </div>
  );
}
