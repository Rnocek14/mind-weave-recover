/**
 * AdaptationProfileCard — clinician-facing "Why it adapted" panel.
 *
 * Reads from `user_adaptation_profiles` (already-computed by edge function)
 * and renders dominant error type, cue dependency trend, latency trend,
 * plateau alerts, and a deterministic strategy recommendation.
 *
 * No business logic here — all rules live in `strategyRecommender.ts`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Brain, Target, AlertTriangle } from "lucide-react";
import { useUserAdaptationProfile } from "@/hooks/useUserAdaptationProfile";
import { recommendStrategy } from "@/lib/strategyRecommender";

interface Props {
  profileId: string;
}

function trendIcon(trend: string | null | undefined) {
  if (trend === 'fading') return <TrendingDown className="h-3.5 w-3.5 text-success" aria-label="Improving" />;
  if (trend === 'increasing') return <TrendingUp className="h-3.5 w-3.5 text-destructive" aria-label="Worsening" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-label="Stable" />;
}

function latencyIcon(pct: number | null | undefined) {
  if (pct == null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (pct < -10) return <TrendingDown className="h-3.5 w-3.5 text-success" aria-label="Faster" />;
  if (pct > 10) return <TrendingUp className="h-3.5 w-3.5 text-destructive" aria-label="Slower" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-label="Stable" />;
}

export function AdaptationProfileCard({ profileId }: Props) {
  const { profile, loading } = useUserAdaptationProfile({ profileId });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" /> Adaptation Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const recommendation = recommendStrategy(profile);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" /> Adaptation Profile
          </div>
          <Badge variant="outline" className="text-xs">
            Confidence: {profile?.data_confidence ?? 'low'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!profile && (
          <p className="text-sm text-muted-foreground">
            No adaptation data yet. Once the patient has completed a few sessions, this panel will explain why the system is adapting.
          </p>
        )}

        {profile && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Dominant error
                </div>
                <div className="mt-1 font-medium capitalize">
                  {profile.dominant_error_type ?? '—'}
                </div>
                {profile.error_type_distribution && Object.keys(profile.error_type_distribution).length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Object.entries(profile.error_type_distribution)
                      .filter(([k]) => k !== 'other')
                      .map(([k, v]) => `${k}: ${Math.round((v as number) * 100)}%`)
                      .join(' · ')}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cue dependency
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-medium">
                  {profile.cue_dependency_score != null
                    ? `${Math.round(profile.cue_dependency_score * 100)}%`
                    : '—'}
                  {trendIcon(profile.cue_dependency_trend)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground capitalize">
                  Trend: {profile.cue_dependency_trend ?? 'unknown'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Response latency
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-medium">
                  {profile.avg_response_latency_ms != null
                    ? `${profile.avg_response_latency_ms} ms`
                    : '—'}
                  {latencyIcon(profile.latency_trend_pct)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {profile.latency_trend_pct != null
                    ? `${profile.latency_trend_pct > 0 ? '+' : ''}${profile.latency_trend_pct}% vs prior week`
                    : 'Insufficient data'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Plateau
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-medium">
                  {profile.plateau_flag ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      Detected
                    </>
                  ) : (
                    'None'
                  )}
                </div>
                {profile.plateau_domains.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {profile.plateau_domains.join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Target className="h-4 w-4" />
                Recommended next focus: {recommendation.label}
              </div>
              <p className="mt-1.5 text-sm text-foreground/90">
                {recommendation.rationale}
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              Based on {profile.trial_count_window} trials in the last 14 days · last computed{' '}
              {new Date(profile.last_computed_at).toLocaleString()}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
