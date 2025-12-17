import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingDown, TrendingUp, AlertCircle, Radio, Zap, Brain, Clock } from 'lucide-react';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { AudioPlayback } from './AudioPlayback';

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

const ERROR_LABELS: Record<string, string> = {
  semantic_paraphasia: 'Semantic',
  phonemic_paraphasia: 'Phonemic',
  circumlocution: 'Circumlocution',
  neologism: 'Neologism',
  no_response: 'No Response',
  timeout: 'Timeout',
  attempted: 'Attempted',
};

export const ErrorPatternDashboard = ({ userId, weeksBack = 12 }: ErrorPatternDashboardProps) => {
  const { analytics, isLoading, error } = useErrorPatternAnalytics(userId, weeksBack);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showUpdateBadge, setShowUpdateBadge] = useState(false);

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
    { name: 'Correct', value: analytics.errorBreakdown.correct, color: ERROR_COLORS.correct },
    { name: 'Attempted', value: analytics.errorBreakdown.attempted, color: ERROR_COLORS.attempted },
    { name: 'Semantic', value: analytics.errorBreakdown.semantic_paraphasia, color: ERROR_COLORS.semantic_paraphasia },
    { name: 'Phonemic', value: analytics.errorBreakdown.phonemic_paraphasia, color: ERROR_COLORS.phonemic_paraphasia },
    { name: 'Circumlocution', value: analytics.errorBreakdown.circumlocution, color: ERROR_COLORS.circumlocution },
    { name: 'Neologism', value: analytics.errorBreakdown.neologism, color: ERROR_COLORS.neologism },
    { name: 'No Response', value: analytics.errorBreakdown.no_response, color: ERROR_COLORS.no_response },
    { name: 'Timeout', value: analytics.errorBreakdown.timeout, color: ERROR_COLORS.timeout },
  ].filter(d => d.value > 0);

  const totalErrors = errorData.filter(d => d.name !== 'Correct').reduce((sum, d) => sum + d.value, 0);

  // Calculate cue reduction trend
  const cueTrend = analytics.cueTrends.length >= 2
    ? analytics.cueTrends[analytics.cueTrends.length - 1].avgCues - analytics.cueTrends[0].avgCues
    : 0;

  // Cue efficacy data for bar chart
  const cueEfficacyData = analytics.cueEfficacy.map(ce => ({
    name: ce.cueType.charAt(0).toUpperCase() + ce.cueType.slice(1),
    efficacy: Math.round(ce.efficacyRate * 100),
    count: ce.totalGiven,
  }));

  // Category performance for bar chart
  const categoryData = analytics.categoryPerformance.slice(0, 8).map(cp => ({
    name: cp.category.charAt(0).toUpperCase() + cp.category.slice(1),
    accuracy: Math.round(cp.accuracy * 100),
    attempts: cp.attempts,
  }));

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

      {/* Summary Cards */}
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
            {analytics.cueEfficacy.length > 0 ? (
              <>
                <div className="text-2xl font-bold capitalize">
                  {analytics.cueEfficacy.sort((a, b) => b.efficacyRate - a.efficacyRate)[0].cueType}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(analytics.cueEfficacy[0].efficacyRate * 100)}% effective
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">No cue data</div>
            )}
          </CardContent>
        </Card>
      </div>

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

      {/* Challenging Targets */}
      {analytics.challengingTargets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Challenging Words</CardTitle>
            <CardDescription>Words with highest error rates (min 3 attempts)</CardDescription>
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
                    <AudioPlayback storagePath={target.exampleAudioPath} className="h-6 w-6 p-0" />
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
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      style={{ backgroundColor: ERROR_COLORS[errorType] || 'hsl(var(--muted))' }}
                      className="text-white"
                    >
                      {ERROR_LABELS[errorType] || errorType}
                    </Badge>
                    <span className="text-sm text-muted-foreground">({examples.length} examples)</span>
                  </div>
                  <div className="grid gap-2 ml-2">
                    {examples.map((example, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded-md">
                        <AudioPlayback storagePath={example.audioPath} className="h-8 w-8 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Target: {example.target}</span>
                            {example.transcript && (
                              <span className="text-xs text-muted-foreground truncate">
                                → "{example.transcript}"
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(example.createdAt).toLocaleDateString()}
                          </span>
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
    </div>
  );
};
