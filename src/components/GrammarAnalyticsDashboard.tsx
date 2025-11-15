import { useGrammarAnalytics } from "@/hooks/useGrammarAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, TrendingUp, Target, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface GrammarAnalyticsDashboardProps {
  userId?: string;
}

export function GrammarAnalyticsDashboard({ userId }: GrammarAnalyticsDashboardProps) {
  const { data: analytics, isLoading, error } = useGrammarAnalytics(userId);

  const exportToCSV = () => {
    if (!analytics) return;

    const rows = [
      ["Grammar Analytics Report"],
      [""],
      ["Overall Statistics"],
      ["Total Trials", analytics.overallStats.totalTrials],
      ["Overall Accuracy", `${analytics.overallStats.overallAccuracy.toFixed(1)}%`],
      ["Avg Reaction Time", `${analytics.overallStats.avgReactionTime.toFixed(0)}ms`],
      ["Total Errors", analytics.overallStats.totalErrors],
      [""],
      ["Error Pattern Analysis"],
      ["Error Type", "Count", "Percentage"],
      ...analytics.errorPatterns.map((ep) => [
        ep.errorType,
        ep.count,
        `${ep.percentage.toFixed(1)}%`,
      ]),
      [""],
      ["Grammar Focus Areas (Weakest)"],
      ["Grammar Focus", "Error Count", "Total Trials", "Error Rate"],
      ...analytics.grammarFocusAreas.map((gf) => [
        gf.focus,
        gf.errorCount,
        gf.totalTrials,
        `${gf.errorRate.toFixed(1)}%`,
      ]),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grammar-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load grammar analytics</AlertDescription>
      </Alert>
    );
  }

  if (!analytics || analytics.overallStats.totalTrials === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No sentence construction data available yet. Complete some exercises to see analytics.
        </AlertDescription>
      </Alert>
    );
  }

  const formatErrorType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatTaskType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Prepare recommendations based on weak areas
  const recommendations = analytics.grammarFocusAreas.slice(0, 3).map((area) => {
    const recommendations: { [key: string]: string } = {
      "subject-verb-agreement": "Focus on matching subjects with correct verb forms. Practice with singular/plural distinctions.",
      "verb-tense": "Work on consistent tense usage. Try timeline exercises to reinforce past/present/future distinctions.",
      "word-order": "Practice canonical English word order (SVO). Use visual sentence mapping exercises.",
      "pronoun-case": "Review subject vs object pronoun forms. Practice with sentence transformation exercises.",
      "article-usage": "Study definite/indefinite article rules. Focus on countable vs uncountable nouns.",
      "preposition": "Learn common preposition patterns. Use context-based exercises for natural usage.",
    };

    return {
      area: area.focus,
      errorRate: area.errorRate,
      recommendation: recommendations[area.focus] || "Continue practicing this grammar pattern with varied examples.",
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grammar Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Sentence construction performance and error patterns
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trials</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overallStats.totalTrials}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overallStats.overallAccuracy.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.overallStats.avgReactionTime.toFixed(0)}ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overallStats.totalErrors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Grammar Error Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Grammar Error Patterns</CardTitle>
          <CardDescription>Distribution of grammar error types</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.errorPatterns}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="errorType" 
                tickFormatter={formatErrorType}
                className="text-xs"
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`${value} errors`, "Count"]}
                labelFormatter={formatErrorType}
              />
              <Bar dataKey="count" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Difficulty Progression */}
      <Card>
        <CardHeader>
          <CardTitle>Syntax Progression by Difficulty</CardTitle>
          <CardDescription>Performance across difficulty levels</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.difficultyProgression}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="level" label={{ value: "Difficulty Level", position: "insideBottom", offset: -5 }} />
              <YAxis yAxisId="left" label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: "Reaction Time (ms)", angle: 90, position: "insideRight" }} />
              <Tooltip />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="accuracy" 
                stroke="hsl(var(--primary))" 
                name="Accuracy (%)"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="avgReactionTime" 
                stroke="hsl(var(--secondary))" 
                name="Avg RT (ms)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Time Series Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends Over Time</CardTitle>
          <CardDescription>Weekly accuracy and error rate progression</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.timeSeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="hsl(var(--primary))" 
                name="Accuracy (%)"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="errorRate" 
                stroke="hsl(var(--destructive))" 
                name="Error Rate (%)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Task Type Performance */}
      {analytics.taskTypePerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance by Task Type</CardTitle>
            <CardDescription>Accuracy across different sentence construction tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={analytics.taskTypePerformance}>
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis 
                  dataKey="taskType" 
                  tickFormatter={formatTaskType}
                  className="text-xs"
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar 
                  name="Accuracy %" 
                  dataKey="accuracy" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.6} 
                />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Grammar Focus Weak Areas */}
      <Card>
        <CardHeader>
          <CardTitle>Grammar Focus Areas</CardTitle>
          <CardDescription>Areas with highest error rates</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.grammarFocusAreas.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="focus" 
                tickFormatter={(focus) => focus.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                angle={-45}
                textAnchor="end"
                height={80}
                className="text-xs"
              />
              <YAxis label={{ value: "Error Rate (%)", angle: -90, position: "insideLeft" }} />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Error Rate"]}
                labelFormatter={(focus) => focus.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
              />
              <Bar dataKey="errorRate" fill="hsl(var(--warning))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Clinical Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Grammar-Specific Recommendations</CardTitle>
            <CardDescription>Targeted intervention suggestions based on error patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="border-l-4 border-primary pl-4 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-foreground">
                      {rec.area.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h4>
                    <span className="text-sm text-destructive font-medium">
                      {rec.errorRate.toFixed(1)}% error rate
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
