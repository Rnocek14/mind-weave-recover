import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, Lightbulb, Target, TrendingUp, Zap } from "lucide-react";
import { useCueTelemetry } from "@/hooks/useCueTelemetry";

interface CueTelemetryDashboardProps {
  userId: string;
  daysBack?: number;
}

export function CueTelemetryDashboard({ userId, daysBack = 7 }: CueTelemetryDashboardProps) {
  const { stats, loading, error } = useCueTelemetry(userId, daysBack);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load cue telemetry: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalUtterances === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center">
          <Lightbulb className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium mb-1">No Data Yet</h4>
          <p className="text-sm text-muted-foreground">
            Complete some exercises to see cue telemetry.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { 
    totalUtterances, 
    cuesDelivered, 
    cueDeliveryRate, 
    triggerBreakdown, 
    effectivenessBreakdown,
    medianTimeToSuccess,
    avgTimeToSuccess,
    topCuedTargets,
    topCuedCategories
  } = stats;

  const totalTriggers = triggerBreakdown.stall + triggerBreakdown.consecutive_errors + triggerBreakdown.user_request + triggerBreakdown.unknown;
  const totalEffectiveness = effectivenessBreakdown.effective + effectivenessBreakdown.ineffective + effectivenessBreakdown.ambiguous;

  return (
    <div className="space-y-4">
      {/* Headline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="w-4 h-4" />
              Total Utterances
            </div>
            <div className="text-2xl font-bold">{totalUtterances}</div>
            <p className="text-xs text-muted-foreground">Last {daysBack} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Zap className="w-4 h-4" />
              Cues Delivered
            </div>
            <div className="text-2xl font-bold">{cuesDelivered}</div>
            <p className="text-xs text-muted-foreground">
              {cueDeliveryRate.toFixed(1)}% delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              Effectiveness
            </div>
            <div className="text-2xl font-bold">
              {totalEffectiveness > 0 
                ? `${((effectivenessBreakdown.effective / totalEffectiveness) * 100).toFixed(0)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {effectivenessBreakdown.effective} effective cues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="w-4 h-4" />
              Median Response
            </div>
            <div className="text-2xl font-bold">
              {medianTimeToSuccess 
                ? `${(medianTimeToSuccess / 1000).toFixed(1)}s`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              After cue shown
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Breakdown & Effectiveness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trigger Mix */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trigger Mix</CardTitle>
            <CardDescription>What caused cues to fire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cuesDelivered === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No cues delivered yet
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      Stall (3s+ hesitation)
                    </span>
                    <span className="font-medium">{triggerBreakdown.stall}</span>
                  </div>
                  <Progress value={totalTriggers > 0 ? (triggerBreakdown.stall / totalTriggers) * 100 : 0} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      Consecutive Errors (2+)
                    </span>
                    <span className="font-medium">{triggerBreakdown.consecutive_errors}</span>
                  </div>
                  <Progress value={totalTriggers > 0 ? (triggerBreakdown.consecutive_errors / totalTriggers) * 100 : 0} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      User Requested
                    </span>
                    <span className="font-medium">{triggerBreakdown.user_request}</span>
                  </div>
                  <Progress value={totalTriggers > 0 ? (triggerBreakdown.user_request / totalTriggers) * 100 : 0} className="h-2" />
                </div>

                {triggerBreakdown.unknown > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-400" />
                        Unknown (legacy data)
                      </span>
                      <span className="font-medium">{triggerBreakdown.unknown}</span>
                    </div>
                    <Progress value={totalTriggers > 0 ? (triggerBreakdown.unknown / totalTriggers) * 100 : 0} className="h-2" />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Effectiveness Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Outcome Mix</CardTitle>
            <CardDescription>Did cues lead to success?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cuesDelivered === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No cues delivered yet
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500 hover:bg-green-500">✓</Badge>
                      Effective (correct ≤6s)
                    </span>
                    <span className="font-medium">{effectivenessBreakdown.effective}</span>
                  </div>
                  <Progress 
                    value={totalEffectiveness > 0 ? (effectivenessBreakdown.effective / totalEffectiveness) * 100 : 0} 
                    className="h-2 bg-muted [&>div]:bg-green-500" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="destructive">✗</Badge>
                      Ineffective (incorrect)
                    </span>
                    <span className="font-medium">{effectivenessBreakdown.ineffective}</span>
                  </div>
                  <Progress 
                    value={totalEffectiveness > 0 ? (effectivenessBreakdown.ineffective / totalEffectiveness) * 100 : 0} 
                    className="h-2 bg-muted [&>div]:bg-destructive" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">?</Badge>
                      Ambiguous (correct &gt;6s)
                    </span>
                    <span className="font-medium">{effectivenessBreakdown.ambiguous}</span>
                  </div>
                  <Progress 
                    value={totalEffectiveness > 0 ? (effectivenessBreakdown.ambiguous / totalEffectiveness) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Targets & Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Cued Targets</CardTitle>
            <CardDescription>Words that trigger most cues</CardDescription>
          </CardHeader>
          <CardContent>
            {topCuedTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No data yet
              </p>
            ) : (
              <div className="space-y-2">
                {topCuedTargets.map(({ target, count }) => (
                  <div key={target} className="flex items-center justify-between text-sm">
                    <span className="font-mono">{target}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Cued Categories</CardTitle>
            <CardDescription>Categories that need most support</CardDescription>
          </CardHeader>
          <CardContent>
            {topCuedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No data yet
              </p>
            ) : (
              <div className="space-y-2">
                {topCuedCategories.map(({ category, count }) => (
                  <div key={category} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{category}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timing Details */}
      {avgTimeToSuccess && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Response Timing</CardTitle>
            <CardDescription>Time from cue to correct answer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {medianTimeToSuccess ? `${(medianTimeToSuccess / 1000).toFixed(1)}s` : 'N/A'}
                </div>
                <p className="text-sm text-muted-foreground">Median</p>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {avgTimeToSuccess ? `${(avgTimeToSuccess / 1000).toFixed(1)}s` : 'N/A'}
                </div>
                <p className="text-sm text-muted-foreground">Average</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
