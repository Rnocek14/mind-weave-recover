import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePronunciationAnalytics } from "@/hooks/usePronunciationAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Mic, Clock, Activity } from "lucide-react";

interface PronunciationAnalyticsDashboardProps {
  userId?: string;
}

export const PronunciationAnalyticsDashboard = ({ userId }: PronunciationAnalyticsDashboardProps) => {
  const { data: analytics, isLoading, error } = usePronunciationAnalytics(userId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load pronunciation analytics</AlertDescription>
      </Alert>
    );
  }

  if (!analytics || analytics.timeSeries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pronunciation Progress</CardTitle>
          <CardDescription>No speech recordings found yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete exercises with audio recording enabled to see your pronunciation progress over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { timeSeries, overallStats } = analytics;

  const TrendIndicator = ({ value }: { value: number }) => {
    if (Math.abs(value) < 1) return null;
    const isPositive = value > 0;
    return (
      <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Pronunciation Progress</h2>
        <p className="text-muted-foreground">Track your speech improvement over time</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Speech Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgSpeechRate.toFixed(0)} WPM</div>
            <TrendIndicator value={overallStats.improvementTrend.speechRate} />
            <p className="text-xs text-muted-foreground mt-1">Words per minute</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Score</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(overallStats.avgConfidence * 100).toFixed(0)}%</div>
            <TrendIndicator value={overallStats.improvementTrend.confidence} />
            <p className="text-xs text-muted-foreground mt-1">Speech recognition accuracy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pause Frequency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgPauseFrequency.toFixed(1)}</div>
            <TrendIndicator value={-overallStats.improvementTrend.pauseFrequency} />
            <p className="text-xs text-muted-foreground mt-1">Pauses per minute</p>
          </CardContent>
        </Card>
      </div>

      {/* Speech Rate Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Speech Rate Trend</CardTitle>
          <CardDescription>Your speaking speed over time (words per minute)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis className="text-xs" label={{ value: 'WPM', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [`${value.toFixed(1)} WPM`, 'Speech Rate']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="speechRate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Speech Rate"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Confidence Score Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Speech Clarity Trend</CardTitle>
          <CardDescription>Whisper AI confidence in recognizing your speech</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                className="text-xs" 
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                label={{ value: 'Confidence', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Confidence']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="confidence" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                name="Confidence"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pause Patterns Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Pause Frequency Trend</CardTitle>
          <CardDescription>Number of pauses per minute during speech</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis className="text-xs" label={{ value: 'Pauses/min', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [`${value.toFixed(1)} pauses/min`, 'Pause Frequency']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="pauseFrequency" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                name="Pause Frequency"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Average Pause Duration */}
      <Card>
        <CardHeader>
          <CardTitle>Pause Duration Trend</CardTitle>
          <CardDescription>Average length of pauses during speech (milliseconds)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis className="text-xs" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [`${value.toFixed(0)} ms`, 'Avg Pause Duration']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="avgPauseDuration" 
                stroke="hsl(var(--chart-4))" 
                strokeWidth={2}
                name="Avg Pause Duration"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Total Trials */}
      <Card>
        <CardHeader>
          <CardTitle>Practice Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Total speech recordings analyzed: <span className="font-bold text-foreground">{overallStats.totalTrials}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
