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
import { BackButton } from '@/components/layout/BackButton';
import { RecoveryFocusSummary } from '@/components/RecoveryFocusSummary';
import { useLearningRate, findSpeechLearningRate } from '@/hooks/useLearningRate';
import { useCueIndependence } from '@/hooks/useCueIndependence';
import { useWordMastery } from '@/hooks/useWordMastery';
import { useErrorQualityScore } from '@/hooks/useErrorQualityScore';
import { useRecoveryScore } from '@/hooks/useRecoveryScore';
import { useProfile } from '@/hooks/useProfile';
import { useUiMode } from '@/hooks/useUiMode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Brain, BookOpen, Shield, ArrowRight, Info, Sparkles, HelpCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, Area, AreaChart, Tooltip as RechartsTooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { PATIENT_RECOVERY_SCORE_ENABLED } from '@/lib/flags/patientRecoveryScore';

// ── Tunable thresholds (centralized for easy adjustment) ──
const THRESHOLDS = {
  mastery: { minAttempts: 3, masteredAccuracy: 0.8, emergingAccuracy: 0.4, maxCueForMastered: 1 },
  cueIndependence: { improvingDelta: 0.03, decliningDelta: -0.03 },
  errorQuality: { improvingDelta: 0.05, decliningDelta: -0.05 },
  accuracy: { strongSlope: 0.02, weakSlope: -0.01 },
};

type Trend = 'improving' | 'stable' | 'declining' | 'insufficient';

const TREND_CONFIG: Record<Trend, { label: string; patientLabel: string; icon: typeof TrendingUp; color: string; bg: string }> = {
  improving: { label: 'Improving', patientLabel: 'Getting stronger 🎉', icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
  stable: { label: 'Stable', patientLabel: 'Holding steady', icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted' },
  declining: { label: 'Needs attention', patientLabel: 'Let\'s keep practicing', icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' },
  insufficient: { label: 'Building data', patientLabel: 'Keep going — building data', icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

function TrendIndicator({ trend, isClinician }: { trend: Trend; isClinician: boolean }) {
  const c = TREND_CONFIG[trend];
  const Icon = c.icon;
  if (!isClinician) {
    return <span className={cn('text-sm font-medium', c.color)}>{c.patientLabel}</span>;
  }
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', c.bg, c.color)}>
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </div>
  );
}

function WhyTooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p>{tip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MiniTrendChart({ data, dataKey, color }: { data: { date: string; value: number }[]; dataKey: string; color: string }) {
  if (data.length < 2) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Not enough data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={80}>
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
): { text: string; patientText: string; caregiverText: string; subtext: string; positive: boolean } {
  const improving = [accuracyTrend, cueTrend, errorTrend].filter(t => t === 'improving').length;
  const declining = [accuracyTrend, cueTrend, errorTrend].filter(t => t === 'declining').length;

  if (improving >= 2 && mastered > 0) {
    return { text: 'Recovery is progressing', patientText: 'You\'re making real progress', caregiverText: 'Recovery is progressing well', subtext: `${mastered} words mastered, multiple metrics improving`, positive: true };
  }
  if (improving >= 1) {
    return { text: 'Signs of improvement', patientText: 'Things are moving forward', caregiverText: 'Signs of improvement showing', subtext: 'Some metrics trending positively', positive: true };
  }
  if (declining >= 2) {
    return { text: 'Progress has slowed', patientText: 'Let\'s keep at it', caregiverText: 'Progress has slowed recently', subtext: 'Some areas need attention — continued practice helps', positive: false };
  }
  return { text: 'Building your recovery picture', patientText: 'Building your progress story', caregiverText: 'Building a recovery picture', subtext: 'More sessions will strengthen these trends', positive: true };
}

export default function RecoveryProgress() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { uiMode, isAtLeast } = useUiMode();
  const isClinician = isAtLeast('clinician');
  const isCaregiver = uiMode === 'caregiver';

  /** Role-aware copy helper: patient sees "you", caregiver sees neutral/3rd-person, clinician sees technical */
  const copy = <T extends string>(patient: T, caregiver: T, clinician: T): T =>
    isClinician ? clinician : isCaregiver ? caregiver : patient;
  const userId = user?.id;
  const profileId = activeProfile?.id;

  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { dataPoints: cueData, currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId);
  const { words, mastered, emerging, struggling, loading: wordLoading } = useWordMastery(userId);
  const { dataPoints: errorData, currentScore: errorScore, trend: errorTrend, loading: errorLoading } = useErrorQualityScore(userId);
  const { score: recoveryScore, weeklyDelta, confidence: scoreConfidence, loading: scoreLoading } = useRecoveryScore(userId, profileId, { enabled: PATIENT_RECOVERY_SCORE_ENABLED });

  const loading = lrLoading || cueLoading || wordLoading || errorLoading || scoreLoading;
  const strokeDate = activeProfile?.stroke_date;
  const daysInProgram = strokeDate ? differenceInDays(new Date(), new Date(strokeDate)) : null;

  const speechRate = findSpeechLearningRate(learningRates);
  const accuracyTrend: Trend =
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

  const recentMastered = words.filter(w => w.level === 'mastered').sort((a, b) => b.lastAttempted.localeCompare(a.lastAttempted)).slice(0, 8);
  const recentEmerging = words.filter(w => w.level === 'emerging').sort((a, b) => b.accuracy - a.accuracy).slice(0, 6);

  const headline = getRecoveryHeadline(accuracyTrend, cueTrend, mastered, errorTrend);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:px-8 space-y-8">

      {/* ═══════════════════════════════════════════════════
          HERO: The 3-second answer
          ═══════════════════════════════════════════════════ */}
      <section className="space-y-4">
        {/* Page title + context — minimal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Recovery Progress
            </h1>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-medium">
              Beta
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground text-right space-y-0.5">
            {daysInProgram !== null && (
              <div className="font-medium text-foreground">{daysInProgram} days in program</div>
            )}
            <div>Updated {format(new Date(), 'MMM d')}</div>
          </div>
        </div>

        {/* Recovery Score Hero — patient exposure gated until the composite
            is validated against real patient data (see the flag module). */}
        {PATIENT_RECOVERY_SCORE_ENABLED && recoveryScore != null && scoreConfidence !== 'insufficient' && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent overflow-hidden">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div>
                    <div className="text-4xl md:text-5xl font-bold text-foreground leading-none tracking-tight">
                      {recoveryScore}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">Recovery Score</div>
                  </div>
                  {weeklyDelta != null && (
                    <div className={cn(
                      'flex items-center gap-1 text-sm font-semibold',
                      weeklyDelta > 0 ? 'text-success' : weeklyDelta < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {weeklyDelta > 0 ? <TrendingUp className="h-4 w-4" /> : weeklyDelta < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      {weeklyDelta > 0 ? '+' : ''}{weeklyDelta} this week
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                  <Link to="/recovery-score">
                    View Breakdown <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* The headline card — instant conviction */}
        <div className={cn(
          'relative rounded-2xl p-6 md:p-8 overflow-hidden',
          headline.positive
            ? 'bg-gradient-to-br from-success/8 via-success/4 to-transparent border-2 border-success/20'
            : 'bg-gradient-to-br from-warning/8 via-warning/4 to-transparent border-2 border-warning/20'
        )}>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Left: Headline */}
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className={cn('w-5 h-5', headline.positive ? 'text-success' : 'text-warning')} />
                <h2 className="text-xl md:text-2xl font-bold text-foreground">
                  {isClinician ? headline.text : isCaregiver ? headline.caregiverText : headline.patientText}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">{headline.subtext}</p>
            </div>

            {/* Right: Word mastery hero stat */}
            <div className="flex items-center gap-6 md:gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-success leading-none">{mastered}</div>
                <div className="text-xs text-muted-foreground mt-1.5 font-medium">
                  {copy('words you can say', 'words mastered', 'words mastered')}
                </div>
              </div>
              {emerging > 0 && (
                <div className="text-center border-l border-border pl-6 md:pl-8">
                  <div className="text-2xl md:text-3xl font-bold text-warning leading-none">{emerging}</div>
                  <div className="text-xs text-muted-foreground mt-1.5 font-medium">
                    {copy('almost there', 'emerging', 'emerging')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Word mastery bar — thin, clean */}
          {words.length > 0 && (
            <div className="mt-5 w-full h-2 rounded-full bg-muted/60 overflow-hidden flex">
              <div className="h-full bg-success transition-all duration-700" style={{ width: `${(mastered / words.length) * 100}%` }} />
              <div className="h-full bg-warning transition-all duration-700" style={{ width: `${(emerging / words.length) * 100}%` }} />
              <div className="h-full bg-destructive/40 transition-all duration-700" style={{ width: `${(struggling / words.length) * 100}%` }} />
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          RECOVERY FOCUS — the clinical bridge (compact)
          ═══════════════════════════════════════════════════ */}
      <RecoveryFocusSummary
        clinicalProfile={activeProfile?.clinical_profile as any}
        todayFocus={null}
        activeExerciseSlugs={[]}
        cueTrend={cueTrend}
        errorTrend={errorTrend}
        accuracyTrend={accuracyTrend}
        masteredCount={mastered}
        isClinician={isClinician}
      />

      {/* ═══════════════════════════════════════════════════
          CORE SIGNALS — 2×2 grid, each card = ONE answer
          ═══════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">
          {copy('How You\'re Doing', 'Recovery Metrics', 'Core Recovery Metrics')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ─── Accuracy ─── */}
          <MetricCard
            icon={Target}
            title={copy('Getting It Right', 'Accuracy', 'Accuracy Trajectory')}
            description={copy('How often you say the right word', 'Naming accuracy over time', 'Naming accuracy over time')}
            whyTip={copy(
              'Tracks how often you get the right word over time',
              'Core naming accuracy trend across practice sessions',
              'Core language performance trend across targeted tasks')}
            trend={accuracyTrend}
            isClinician={isClinician}
          >
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-3xl font-bold text-foreground leading-none">
                  {speechRate?.endAccuracy != null ? `${Math.round(speechRate.endAccuracy * 100)}%` : '—'}
                </div>
                {speechRate?.startAccuracy != null && (
                  <div className="text-xs text-muted-foreground">
                    from {Math.round(speechRate.startAccuracy * 100)}%
                    <span className={cn(
                      'ml-1.5 font-medium',
                      (speechRate.endAccuracy ?? 0) > (speechRate.startAccuracy ?? 0) ? 'text-success' : 'text-destructive'
                    )}>
                      {(speechRate.endAccuracy ?? 0) > (speechRate.startAccuracy ?? 0) ? '↑' : '↓'}
                      {Math.abs(Math.round(((speechRate.endAccuracy ?? 0) - (speechRate.startAccuracy ?? 0)) * 100))}pp
                    </span>
                  </div>
                )}
              </div>
              {isClinician && speechRate && (
                <div className="text-[11px] text-muted-foreground text-right">
                  {speechRate.trialCount} trials<br />{speechRate.window}d window
                </div>
              )}
            </div>
          </MetricCard>

          {/* ─── Cue Independence ─── */}
          <MetricCard
            icon={Shield}
            title={copy('Doing It On Your Own', 'Independence', 'Cue Independence')}
            description={copy('Needing less help over time', 'Performing with less support', 'Performing without cueing support')}
            whyTip={copy(
              'Shows whether you need less help — a key sign of real progress',
              'Reduced cue dependence is a stronger recovery signal than accuracy alone',
              'Reduced cue dependence is a stronger recovery signal than accuracy alone')}
            trend={cueTrend}
            isClinician={isClinician}
          >
            <div className="flex items-end justify-between gap-4 mb-2">
              <div className="text-3xl font-bold text-foreground leading-none">
                {cueScore != null ? `${Math.round(cueScore * 100)}%` : '—'}
              </div>
            </div>
            <MiniTrendChart
              data={cueData.map(d => ({ date: d.date, value: d.independenceScore }))}
              dataKey="cue"
              color="hsl(var(--success))"
            />
          </MetricCard>

          {/* ─── Error Quality ─── */}
          <MetricCard
            icon={Brain}
            title={copy('Closer Answers', 'Error Quality', 'Error Quality')}
            description={copy('When you miss, you\'re getting closer', 'Errors shifting from severe to mild', 'Errors shifting from severe to mild')}
            whyTip={copy(
              'Even wrong answers show progress — your guesses are getting closer',
              'Error type evolution can reveal improvement before accuracy catches up',
              'Error type evolution reveals neurological improvement before accuracy catches up')}
            trend={errorTrend}
            isClinician={isClinician}
          >
            <div className="flex items-end justify-between gap-4 mb-2">
              <div className="text-3xl font-bold text-foreground leading-none">
                {errorScore != null ? `${Math.round(errorScore * 100)}%` : '—'}
              </div>
            </div>
            <MiniTrendChart
              data={errorData.map(d => ({ date: d.date, value: d.qualityScore }))}
              dataKey="error"
              color="hsl(var(--primary))"
            />
          </MetricCard>

          {/* ─── Then vs Now ─── */}
          {comparison && (
            <MetricCard
              icon={ArrowRight}
              title={copy('Then vs Now', 'Early vs Recent', 'Early vs Recent')}
              description={copy('How much more independent you are', 'Independence comparison over time', 'Cue independence comparison')}
              whyTip="Compares your early sessions to recent ones to show real change over time"
              trend={comparison.delta > 0.03 ? 'improving' : comparison.delta < -0.03 ? 'declining' : 'stable'}
              isClinician={isClinician}
            >
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-center flex-1">
                  <div className="text-xs text-muted-foreground mb-1">{isClinician ? 'Early' : 'Start'}</div>
                  <div className="text-2xl font-bold text-foreground">{Math.round(comparison.earlyIndependence * 100)}%</div>
                  {isClinician && <div className="text-[10px] text-muted-foreground mt-0.5">{comparison.earlyPeriod}</div>}
                </div>
                <div className="flex flex-col items-center gap-1 px-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className={cn(
                    'text-sm font-bold',
                    comparison.delta > 0 ? 'text-success' : comparison.delta < 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {comparison.delta > 0 ? '+' : ''}{Math.round(comparison.delta * 100)}%
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-xs text-muted-foreground mb-1">{isClinician ? 'Recent' : 'Now'}</div>
                  <div className="text-2xl font-bold text-foreground">{Math.round(comparison.recentIndependence * 100)}%</div>
                  {isClinician && <div className="text-[10px] text-muted-foreground mt-0.5">{comparison.recentPeriod}</div>}
                </div>
              </div>
            </MetricCard>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          EVIDENCE — Words making progress
          ═══════════════════════════════════════════════════ */}
      {(recentMastered.length > 0 || recentEmerging.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 tracking-tight">
            {copy('Words Making Progress', 'Word Progress', 'Word Progress Evidence')}
          </h2>
          <Card className="overflow-hidden">
            <CardContent className="p-5 space-y-5">
              {recentMastered.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-sm font-medium text-foreground">
                      {copy('You got these!', 'Mastered', 'Mastered')}
                    </span>
                    <span className="text-xs text-muted-foreground">({recentMastered.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentMastered.map(w => (
                      <Badge key={w.word} variant="outline" className="bg-success/8 text-success border-success/20 font-medium">
                        {w.word}
                        {isClinician && <span className="ml-1 text-[10px] opacity-60">{Math.round(w.accuracy * 100)}%</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {recentEmerging.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-sm font-medium text-foreground">
                      {copy('Getting closer', 'Emerging', 'Emerging')}
                    </span>
                    <span className="text-xs text-muted-foreground">({recentEmerging.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentEmerging.map(w => (
                      <Badge key={w.word} variant="outline" className="bg-warning/8 text-warning border-warning/20 font-medium">
                        {w.word}
                        {isClinician && <span className="ml-1 text-[10px] opacity-60">{Math.round(w.accuracy * 100)}%</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════
          DISCLAIMER — quiet, trustworthy
          ═══════════════════════════════════════════════════ */}
      <footer className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {copy(
            'These scores show your practice trends over time. They are not medical test results — talk to your therapist about your full progress.',
            'These scores show practice trends over time. They are not medical test results — discuss with the therapist for a complete picture.',
            'Outcome metrics are directional and intended for clinical review. These measures have not been independently validated and should be interpreted alongside formal assessments.'
          )}
        </p>
      </footer>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MetricCard — Reusable card with consistent hierarchy:
   Icon + Title + Trend  →  Content  →  "Why" in tooltip
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function MetricCard({
  icon: Icon,
  title,
  description,
  whyTip,
  trend,
  isClinician,
  children,
}: {
  icon: typeof Target;
  title: string;
  description: string;
  whyTip: string;
  trend: Trend;
  isClinician: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('p-1.5 rounded-lg shrink-0', TREND_CONFIG[trend].bg)}>
              <Icon className={cn('h-4 w-4', TREND_CONFIG[trend].color)} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pl-9 sm:pl-0">
            <TrendIndicator trend={trend} isClinician={isClinician} />
            <WhyTooltip tip={whyTip}>
              <button className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </WhyTooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}
