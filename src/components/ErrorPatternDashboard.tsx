import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ErrorPatternDashboardProps {
  userId: string;
  weeksBack?: number;
}

const ERROR_COLORS = {
  semantic: 'hsl(var(--destructive))',
  phonemic: 'hsl(var(--warning))',
  unrelated: 'hsl(var(--muted))',
  timeout: 'hsl(var(--muted-foreground))',
};

export const ErrorPatternDashboard = ({ userId, weeksBack = 12 }: ErrorPatternDashboardProps) => {
  const { analytics, isLoading, error } = useErrorPatternAnalytics(userId, weeksBack);

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

  const errorData = [
    { name: 'Semantic', value: analytics.errorBreakdown.semantic, color: ERROR_COLORS.semantic },
    { name: 'Phonemic', value: analytics.errorBreakdown.phonemic, color: ERROR_COLORS.phonemic },
    { name: 'Unrelated', value: analytics.errorBreakdown.unrelated, color: ERROR_COLORS.unrelated },
    { name: 'Timeout', value: analytics.errorBreakdown.timeout, color: ERROR_COLORS.timeout },
  ].filter(d => d.value > 0);

  const totalErrors = errorData.reduce((sum, d) => sum + d.value, 0);

  // Calculate cue reduction trend
  const cueTrend = analytics.cueTrends.length >= 2
    ? analytics.cueTrends[analytics.cueTrends.length - 1].avgCues - analytics.cueTrends[0].avgCues
    : 0;

  // Calculate probe accuracy trend
  const probeTrend = analytics.probeProgress.length >= 2
    ? analytics.probeProgress[analytics.probeProgress.length - 1].accuracy - analytics.probeProgress[0].accuracy
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
              ) : (
                <TrendingUp className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {cueTrend < 0 ? 'Decreasing' : 'Increasing'} ({Math.abs(cueTrend).toFixed(2)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Probe Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {analytics.probeProgress.length > 0
                  ? analytics.probeProgress[analytics.probeProgress.length - 1].accuracy.toFixed(1)
                  : '0.0'}%
              </div>
              {probeTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {probeTrend > 0 ? 'Improving' : 'Declining'} ({Math.abs(probeTrend).toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Breakdown Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Error Type Distribution</CardTitle>
          <CardDescription>
            Breakdown of {totalErrors} errors across semantic, phonemic, and other categories
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
              No error data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cue Dependency Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Cue Dependency Over Time</CardTitle>
          <CardDescription>
            Average number of cues needed per trial (lower is better)
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

      {/* Generalization Probe Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Generalization Probe Performance</CardTitle>
          <CardDescription>
            Accuracy on untrained probe items measuring true learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.probeProgress.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.probeProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={[0, 100]}
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
                  dataKey="accuracy" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No probe data available yet. Complete probe assessments to see progress.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
