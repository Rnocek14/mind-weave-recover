import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock, TrendingUp, AlertTriangle, Timer } from "lucide-react";
import { CaregiverSummary as CaregiverSummaryType } from "@/hooks/useCaregiverAnalytics";

interface CaregiverSummaryProps {
  summary: CaregiverSummaryType;
}

export const CaregiverSummary = ({ summary }: CaregiverSummaryProps) => {
  const completionRate = summary.totalSessions > 0 
    ? Math.round((summary.completedSessions / summary.totalSessions) * 100) 
    : 0;

  const totalFlags = summary.redFlags + summary.orangeFlags + summary.yellowFlags;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {summary.completedSessions} completed ({completionRate}%)
            </p>
          </CardContent>
        </Card>

        {/* Total Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalMinutes}m</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        {/* Average Accuracy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(summary.avgAccuracy * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all sessions
            </p>
          </CardContent>
        </Card>

        {/* Engagement Flags */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Flags</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFlags}</div>
            <div className="flex gap-2 text-xs mt-1">
              {summary.redFlags > 0 && (
                <span className="text-destructive">🔴 {summary.redFlags}</span>
              )}
              {summary.orangeFlags > 0 && (
                <span className="text-orange-500">🟠 {summary.orangeFlags}</span>
              )}
              {summary.yellowFlags > 0 && (
                <span className="text-yellow-500">🟡 {summary.yellowFlags}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Engagement Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Insights</CardTitle>
          <CardDescription>
            How the user responded to adaptive interventions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Interventions Shown</span>
            </div>
            <span className="text-2xl font-bold">{summary.interventionsCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Acceptance Rate</span>
            </div>
            <span className="text-2xl font-bold">
              {Math.round(summary.acceptanceRate * 100)}%
            </span>
          </div>

          {/* Alert if low acceptance */}
          {summary.acceptanceRate < 0.3 && summary.interventionsCount > 5 && (
            <div className="flex gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-orange-500">Low intervention acceptance</p>
                <p className="text-muted-foreground mt-1">
                  User is frequently dismissing prompts for breaks or confidence boosts. 
                  Consider adjusting intervention timing or thresholds.
                </p>
              </div>
            </div>
          )}

          {/* Success message if good engagement */}
          {totalFlags === 0 && summary.totalSessions >= 5 && (
            <div className="flex gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-primary">Excellent engagement</p>
                <p className="text-muted-foreground mt-1">
                  No significant frustration or fatigue detected. User is maintaining consistent practice.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
