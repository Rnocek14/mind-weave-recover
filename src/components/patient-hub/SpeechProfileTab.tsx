/**
 * Speech Profile Tab — Longitudinal patient intelligence.
 * Consolidates SpeechProfile + RecoveryProgress into one clean tab.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, Volume2, Target, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Shield, Zap, Activity
} from "lucide-react";
import { useUserSpeechProfile } from "@/hooks/useUserSpeechProfile";
import { useAdaptationProof } from "@/hooks/useAdaptationProof";
import { useLearningRate } from "@/hooks/useLearningRate";
import { useRecoveryScore } from "@/hooks/useRecoveryScore";
import { useCueIndependence } from "@/hooks/useCueIndependence";
import { useWordMastery } from "@/hooks/useWordMastery";
import { useErrorQualityScore } from "@/hooks/useErrorQualityScore";
import { cn } from "@/lib/utils";

interface SpeechProfileTabProps {
  userId: string;
  profileId: string | undefined;
  windowSize: number;
}

type Trend = "improving" | "stable" | "declining" | "insufficient";

function TrendBadge({ trend }: { trend: Trend }) {
  const config: Record<Trend, { label: string; color: string; Icon: any }> = {
    improving: { label: "Improving", color: "text-success", Icon: TrendingUp },
    stable: { label: "Stable", color: "text-muted-foreground", Icon: Minus },
    declining: { label: "Declining", color: "text-destructive", Icon: TrendingDown },
    insufficient: { label: "Building data", color: "text-muted-foreground", Icon: AlertTriangle },
  };
  const c = config[trend];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", c.color)}>
      <c.Icon className="w-3 h-3" /> {c.label}
    </span>
  );
}

export function SpeechProfileTab({ userId, profileId, windowSize }: SpeechProfileTabProps) {
  const { profile: speechProfile, loading: profileLoading } = useUserSpeechProfile(
    userId, { profileId, enabled: !!userId }
  );
  const { summary: adaptationSummary, isLoading: adaptLoading } = useAdaptationProof(userId, windowSize);
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId);
  const { score: recoveryScore, breakdown, confidence, loading: rsLoading } = useRecoveryScore(userId, profileId);
  const { currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId);
  const { mastered, emerging, struggling, loading: wmLoading } = useWordMastery(userId);
  const { currentScore: errorScore, trend: errorTrend, loading: eqLoading } = useErrorQualityScore(userId);

  const isLoading = profileLoading || adaptLoading || lrLoading || rsLoading;

  // Focus phonemes
  const focusPhonemes = useMemo(() => {
    if (!speechProfile?.phoneme_difficulty_map) return [];
    return Object.entries(speechProfile.phoneme_difficulty_map)
      .filter(([, v]) => v.accuracy < 0.7 && v.trials >= 3)
      .sort(([, a], [, b]) => a.accuracy - b.accuracy)
      .slice(0, 8);
  }, [speechProfile]);

  // Cue efficacy
  const cueEfficacy = speechProfile?.cue_efficacy_by_type;

  // Error distribution
  const errorDist = speechProfile?.error_type_distribution;
  const totalErrors = errorDist ? Object.values(errorDist).reduce((a, b) => a + b, 0) : 0;

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Recovery Score */}
      {recoveryScore != null && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Recovery Score
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-primary">{Math.round(recoveryScore)}</div>
              <div className="flex-1 space-y-1.5">
                {breakdown && Object.entries(breakdown).slice(0, 4).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground capitalize w-24 truncate">{key.replace(/_/g, " ")}</span>
                    <Progress value={typeof val === "number" ? val : 0} className="h-1.5 flex-1" />
                    <span className="text-muted-foreground w-8 text-right">{typeof val === "number" ? Math.round(val) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Focus Sounds */}
      {focusPhonemes.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              Focus Sounds
              <Badge variant="secondary" className="text-[10px]">{focusPhonemes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap gap-2">
              {focusPhonemes.map(([phoneme, data]) => (
                <div key={phoneme} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-xs">
                  <span className="font-bold text-destructive">/{phoneme}/</span>
                  <span className="text-muted-foreground">{Math.round(data.accuracy * 100)}% ({data.trials}t)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cue Response */}
      {cueEfficacy && Object.keys(cueEfficacy).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Cue Response
              {cueTrend && <TrendBadge trend={cueTrend as Trend} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-2">
              {Object.entries(cueEfficacy).map(([type, data]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-20 capitalize">{type.replace(/_/g, " ")}</span>
                  <Progress value={data.successRate * 100} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {Math.round(data.successRate * 100)}% ({data.total}t)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Patterns */}
      {errorDist && totalErrors > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              Error Patterns
              {errorTrend && <TrendBadge trend={errorTrend as Trend} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-2">
              {Object.entries(errorDist)
                .filter(([type]) => type !== "correct")
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs w-28 truncate capitalize">{type.replace(/_/g, " ")}</span>
                    <Progress value={(count / totalErrors) * 100} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-12 text-right">{Math.round((count / totalErrors) * 100)}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Word Mastery */}
      {(mastered > 0 || emerging > 0 || struggling > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Word Mastery
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-success">{mastered}</div>
                <div className="text-[10px] text-muted-foreground">Mastered</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary">{emerging}</div>
                <div className="text-[10px] text-muted-foreground">Emerging</div>
              </div>
              <div>
                <div className="text-xl font-bold text-destructive">{struggling}</div>
                <div className="text-[10px] text-muted-foreground">Struggling</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learning Rates */}
      {learningRates && learningRates.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Learning Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-2">
              {learningRates.slice(0, 4).map((r) => {
                const slope = r.accuracy_slope;
                const trend: Trend = slope != null && slope > 0.02 ? "improving" : slope != null && slope < -0.01 ? "declining" : slope != null ? "stable" : "insufficient";
                return (
                  <div key={r.domain} className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium">{r.domain?.replace(/_/g, " ")}</span>
                    <TrendBadge trend={trend} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adaptation Impact */}
      {adaptationSummary && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Adaptation Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-lg font-bold">{adaptationSummary.totalAdapted ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Adapted Trials</div>
              </div>
              <div>
                <div className="text-lg font-bold text-success">
                  {adaptationSummary.overallAdaptationRate != null ? `${Math.round(adaptationSummary.overallAdaptationRate * 100)}%` : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">Adaptation Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Freshness indicator */}
      {speechProfile?.updated_at && (
        <p className="text-[10px] text-muted-foreground text-center">
          Speech profile last updated: {new Date(speechProfile.updated_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
