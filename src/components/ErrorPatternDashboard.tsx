import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingDown, TrendingUp, AlertCircle, Radio, Zap, Brain, Clock, ChevronDown, BarChart3, Headphones, Play } from 'lucide-react';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { useUiMode } from '@/hooks/useUiMode';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { AudioPlayback } from './AudioPlayback';
import { AudioPlaybackWithWaveform } from './AudioPlaybackWithWaveform';
import { ClinicalTerm } from './ClinicalTerm';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getErrorLabel, getCueLabel, getErrorTermInfo, getListenForHint } from '@/lib/insightLanguageMap';
import { getExerciseForErrorType } from '@/lib/recommendationRouter';

interface ErrorPatternDashboardProps {
  userId: string;
  weeksBack?: number;
}

const ERROR_COLORS: Record<string, string> = {
  correct: 'hsl(var(--success))',
  attempted: 'hsl(142.1 76.2% 36.3%)',
  semantic_paraphasia: 'hsl(var(--destructive))',
  phonemic_paraphasia: 'hsl(var(--warning))',
  circumlocution: 'hsl(221.2 83.2% 53.3%)',
  neologism: 'hsl(var(--muted))',
  no_response: 'hsl(var(--muted-foreground))',
  timeout: 'hsl(0 0% 45.1%)',
};

export const ErrorPatternDashboard = ({ userId, weeksBack = 12 }: ErrorPatternDashboardProps) => {
  const navigate = useNavigate();
  const { analytics, isLoading, error } = useErrorPatternAnalytics(userId, weeksBack);
  const { uiMode } = useUiMode();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showUpdateBadge, setShowUpdateBadge] = useState(false);
  
  // Default: admin shows charts, clinician hides; all hide evidence
  const [showCharts, setShowCharts] = useState(uiMode === 'admin');
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    if (analytics && !isLoading) {
      setLastUpdate(new Date());
      setShowUpdateBadge(true);
      const timer = setTimeout(() => setShowUpdateBadge(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [analytics, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) return null;

  // Insufficient data check: need at least 5 trials for reliable patterns
  if (analytics.totalTrials < 5) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Not enough data yet</p>
          <p className="text-sm mt-1">Need at least 5 trials for reliable error pattern analysis ({analytics.totalTrials} so far)</p>
        </div>
      </Card>
    );
  }

  const errorData = [
    { name: getErrorLabel('correct'), value: analytics.errorBreakdown.correct, color: ERROR_COLORS.correct },
    { name: getErrorLabel('attempted'), value: analytics.errorBreakdown.attempted, color: ERROR_COLORS.attempted },
    { name: getErrorLabel('semantic_paraphasia'), value: analytics.errorBreakdown.semantic_paraphasia, color: ERROR_COLORS.semantic_paraphasia },
    { name: getErrorLabel('phonemic_paraphasia'), value: analytics.errorBreakdown.phonemic_paraphasia, color: ERROR_COLORS.phonemic_paraphasia },
    { name: getErrorLabel('circumlocution'), value: analytics.errorBreakdown.circumlocution, color: ERROR_COLORS.circumlocution },
    { name: getErrorLabel('neologism'), value: analytics.errorBreakdown.neologism, color: ERROR_COLORS.neologism },
    { name: getErrorLabel('no_response'), value: analytics.errorBreakdown.no_response, color: ERROR_COLORS.no_response },
    { name: getErrorLabel('timeout'), value: analytics.errorBreakdown.timeout, color: ERROR_COLORS.timeout },
  ].filter(d => d.value > 0);

  const totalErrors = errorData.filter(d => d.name !== getErrorLabel('correct')).reduce((sum, d) => sum + d.value, 0);

  // Calculate cue reduction trend
  const cueTrend = analytics.cueTrends.length >= 2
    ? analytics.cueTrends[analytics.cueTrends.length - 1].avgCues - analytics.cueTrends[0].avgCues
    : 0;

  // Cue efficacy data for bar chart
  const cueEfficacyData = analytics.cueEfficacy.map(ce => ({
    name: getCueLabel(ce.cueType),
    efficacy: Math.round(ce.efficacyRate * 100),
    count: ce.totalGiven,
  }));

  // Category performance for bar chart
  const categoryData = analytics.categoryPerformance.slice(0, 8).map(cp => ({
    name: cp.category.charAt(0).toUpperCase() + cp.category.slice(1),
    accuracy: Math.round(cp.accuracy * 100),
    attempts: cp.attempts,
  }));

  // ==== PHASE 1: Derive Key Finding headline ====
  // Find top error type (excluding 'correct')
  const errorBreakdownEntries = Object.entries(analytics.errorBreakdown)
    .filter(([key]) => key !== 'correct')
    .map(([key, val]) => ({ type: key, count: val as number }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);
  
  const topError = errorBreakdownEntries[0];
  const topErrorPct = topError ? Math.round((topError.count / analytics.totalTrials) * 100) : 0;
  
  // Best cue
  const bestCue = analytics.cueEfficacy.length > 0
    ? [...analytics.cueEfficacy].sort((a, b) => b.efficacyRate - a.efficacyRate)[0]
    : null;

  // Build the key finding sentence
  let keyFinding = '';
  if (topError && topErrorPct >= 10) {
    const errorLabel = getErrorLabel(topError.type);
    keyFinding = `Main challenge: ${errorLabel.toLowerCase()} (${topErrorPct}% of trials).`;
    if (bestCue && bestCue.efficacyRate > 0.5) {
      keyFinding += ` ${getCueLabel(bestCue.cueType)} hints work best (${Math.round(bestCue.efficacyRate * 100)}% effective, n=${bestCue.totalGiven}).`;
    }
  } else if (analytics.overallAccuracy >= 80) {
    keyFinding = `Strong performance: ${analytics.overallAccuracy.toFixed(0)}% accuracy across ${analytics.totalTrials} trials.`;
    if (cueTrend < 0) {
      keyFinding += ' Cue dependency is decreasing — great progress!';
    }
  } else {
    keyFinding = `${analytics.totalTrials} trials analyzed. Building your speech profile...`;
  }

  // ==== CONFIDENCE CALCULATION ====
  // A) Sample size
  const sampleConfidence = analytics.totalTrials < 10 ? 'low' : analytics.totalTrials < 25 ? 'medium' : 'high';
  
  // B) Dominance: top error share among non-correct trials
  const totalNonCorrect = analytics.totalTrials - (analytics.errorBreakdown.correct || 0);
  const topErrorShare = topError && totalNonCorrect > 0 ? topError.count / totalNonCorrect : 0;
  const dominanceConfidence = topErrorShare < 0.25 ? 'low' : topErrorShare < 0.40 ? 'medium' : 'high';
  
  // C) Cue evidence: best cue has enough data
  const cueConfidence = bestCue && bestCue.totalGiven >= 5 && bestCue.effectiveCount >= 3 ? 'high' : 
                        bestCue && bestCue.totalGiven >= 3 ? 'medium' : 'low';
  
  // Combine: take minimum of sample + max(dominance, cue)
  const confidenceLevels = { low: 0, medium: 1, high: 2 };
  const signalConfidence = Math.max(confidenceLevels[dominanceConfidence], confidenceLevels[cueConfidence]);
  const overallConfidenceNum = Math.min(confidenceLevels[sampleConfidence], signalConfidence);
  const overallConfidence: 'low' | 'medium' | 'high' = 
    overallConfidenceNum === 0 ? 'low' : overallConfidenceNum === 1 ? 'medium' : 'high';
  
  const confidenceConfig = {
    low: { label: 'Building baseline', color: 'text-muted-foreground', bg: 'bg-muted' },
    medium: { label: 'Medium confidence', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    high: { label: 'High confidence', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  };

  return (
    <div className="space-y-6">
      {/* Real-time Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-success animate-pulse" />
          <span className="text-sm text-muted-foreground">Live updates enabled</span>
        </div>
        {showUpdateBadge && (
          <Badge variant="secondary" className="animate-slide-up">
            <Radio className="h-3 w-3 mr-1" />
            Updated {lastUpdate.toLocaleTimeString()}
          </Badge>
        )}
      </div>

      {/* Summary Cards (always visible) */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overallAccuracy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">From {analytics.totalTrials} trials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cue Dependency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {analytics.cueTrends.length > 0
                  ? analytics.cueTrends[analytics.cueTrends.length - 1].avgCues.toFixed(2)
                  : '0.00'}
              </div>
              {cueTrend < 0 ? (
                <TrendingDown className="h-4 w-4 text-success" />
              ) : cueTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-destructive" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {cueTrend < 0 ? 'Decreasing' : cueTrend > 0 ? 'Increasing' : 'Stable'} ({Math.abs(cueTrend).toFixed(2)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" /> Speech Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.fluencyMetrics.avgSpeechRateWpm?.toFixed(0) || '—'} <span className="text-sm font-normal">WPM</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.fluencyMetrics.effortfulSpeechRate > 0.3 
                ? 'Effortful speech detected' 
                : 'Fluent speech pattern'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Zap className="h-4 w-4" /> Best Cue Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestCue ? (
              <>
                <div className="text-2xl font-bold">
                  {getCueLabel(bestCue.cueType)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(bestCue.efficacyRate * 100)}% effective
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">No cue data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PHASE 1: Key Finding Headline (always visible) */}
      {keyFinding && (
        <Card className="p-4 bg-primary/5 border-primary/30">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{keyFinding}</p>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className={`${confidenceConfig[overallConfidence].bg} ${confidenceConfig[overallConfidence].color} border-0`}>
                  {confidenceConfig[overallConfidence].label}
                </Badge>
                <span className="text-muted-foreground">
                  N={analytics.totalTrials} trials
                  {topError && totalNonCorrect > 0 && ` • ${Math.round(topErrorShare * 100)}% dominant pattern`}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* PHASE 2: Toggle Buttons */}
      <div className="flex gap-2">
        <Button
          variant={showCharts ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowCharts(!showCharts)}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          {showCharts ? 'Hide charts' : 'Show charts'}
          <ChevronDown className={`h-4 w-4 transition-transform ${showCharts ? 'rotate-180' : ''}`} />
        </Button>
        <Button
          variant={showEvidence ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowEvidence(!showEvidence)}
          className="gap-2"
        >
          <Headphones className="h-4 w-4" />
          {showEvidence ? 'Hide evidence' : 'Show evidence'}
          <ChevronDown className={`h-4 w-4 transition-transform ${showEvidence ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* PHASE 2: Charts Section (collapsible) */}
      <Collapsible open={showCharts}>
        <CollapsibleContent className="space-y-6">
          {/* Error Breakdown Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Response Distribution</CardTitle>
              <CardDescription>
                Breakdown of {analytics.totalTrials} responses including {totalErrors} errors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={errorData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {errorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two-column layout for cue efficacy and category performance */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cue Efficacy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" /> Cue Efficacy
                </CardTitle>
                <CardDescription>How well each cue type helps</CardDescription>
              </CardHeader>
              <CardContent>
                {cueEfficacyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={cueEfficacyData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => [`${value}%`, 'Efficacy']}
                      />
                      <Bar dataKey="efficacy" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No cue data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" /> Category Performance
                </CardTitle>
                <CardDescription>Accuracy by word category</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => [`${value}%`, 'Accuracy']}
                      />
                      <Bar dataKey="accuracy" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cue Dependency Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Cue Dependency Over Time</CardTitle>
              <CardDescription>
                Percentage of trials needing cues (lower is better)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.cueTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.cueTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgCues" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No cue dependency data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fluency Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Fluency Metrics</CardTitle>
              <CardDescription>Speech rate and pause patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {analytics.fluencyMetrics.avgSpeechRateWpm?.toFixed(0) || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg WPM</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {analytics.fluencyMetrics.avgPauseCount?.toFixed(1) || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Pauses</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {analytics.fluencyMetrics.avgPauseDurationMs 
                      ? (analytics.fluencyMetrics.avgPauseDurationMs / 1000).toFixed(1) + 's'
                      : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Pause Duration</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {Math.round(analytics.fluencyMetrics.effortfulSpeechRate * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Effortful Speech</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* PHASE 2: Evidence Section (collapsible) */}
      <Collapsible open={showEvidence}>
        <CollapsibleContent className="space-y-6">
          {/* Challenging Targets */}
          {analytics.challengingTargets.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Most Challenging Words</CardTitle>
                  <CardDescription>Words with highest error rates (min 3 attempts)</CardDescription>
                </div>
                {(() => {
                  // Build targets list from top 5 challenging words (filter for ASR quality)
                  const practiceTargets = analytics.challengingTargets
                    .slice(0, 5)
                    .map(t => t.target.toLowerCase());
                  
                  if (practiceTargets.length >= 2) {
                    const targetsParam = encodeURIComponent(practiceTargets.join(','));
                    return (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1.5"
                        onClick={() => navigate(`/exercise/photo-naming?targets=${targetsParam}&source=error_pattern_dashboard`)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Practice these words (5 min)
                      </Button>
                    );
                  }
                  return null;
                })()}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analytics.challengingTargets.slice(0, 10).map((target, i) => (
                    <div key={target.target} className="flex items-center gap-1">
                      <Badge 
                        variant={target.errorRate > 0.5 ? "destructive" : "secondary"}
                        className="text-sm"
                      >
                        {target.target} ({Math.round(target.errorRate * 100)}% errors, {target.attempts} tries)
                      </Badge>
                      {target.exampleAudioPath && (
                        <AudioPlayback 
                          storagePath={target.exampleAudioPath} 
                          className="h-6 w-6 p-0"
                          listenForHint="Clarity on this word"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audio Examples by Error Type */}
          {Object.keys(analytics.errorTypeExamples).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" /> Audio Examples by Error Type
                </CardTitle>
                <CardDescription>Listen to example recordings for each error pattern</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.errorTypeExamples).map(([errorType, examples]) => (
                    <div key={errorType} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: ERROR_COLORS[errorType] || 'hsl(var(--muted))' }}
                            className="text-white"
                          >
                            <ClinicalTerm type="error" value={errorType} />
                          </Badge>
                          <span className="text-sm text-muted-foreground">({examples.length} examples)</span>
                        </div>
                        {(() => {
                          const exerciseRoute = getExerciseForErrorType(errorType);
                          return exerciseRoute && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={() => navigate(exerciseRoute.route)}
                            >
                              <Play className="h-3 w-3" />
                              {exerciseRoute.label}
                            </Button>
                          );
                        })()}
                      </div>
                      <div className="grid gap-2 ml-2">
                        {examples.map((example, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">Target: {example.target}</span>
                                {example.transcript && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    → "{example.transcript}"
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <AudioPlaybackWithWaveform 
                                  storagePath={example.audioPath} 
                                  showWaveform={true}
                                  listenForHint={getListenForHint(errorType)}
                                />
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {new Date(example.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
