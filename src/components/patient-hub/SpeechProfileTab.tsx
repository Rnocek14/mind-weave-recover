/**
 * Speech Profile Tab — Restructured into narrative hierarchy:
 * Core Performance (always visible) → Detailed Patterns (collapsible) → Data Quality (collapsible)
 */
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Brain, Volume2, Target, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Shield, Zap, Activity, RefreshCw, Database,
  Award, BarChart3, Repeat, CheckCircle2, ChevronDown
} from "lucide-react";
import { useUserSpeechProfile } from "@/hooks/useUserSpeechProfile";
import { useAdaptationProof } from "@/hooks/useAdaptationProof";
import { useLearningRate } from "@/hooks/useLearningRate";
import { useRecoveryScore } from "@/hooks/useRecoveryScore";
import { useCueIndependence } from "@/hooks/useCueIndependence";
import { useWordMastery } from "@/hooks/useWordMastery";
import { useErrorQualityScore } from "@/hooks/useErrorQualityScore";
import { evaluateProfileFreshness } from "@/lib/profileFreshness";
import { recomputeSpeechProfileNow } from "@/lib/recomputeSpeechProfile";
import { loadWordHistory, getRetainedWords, getRetentionDifficultyHint } from "@/lib/smartCoach/crossSessionRetention";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ResponsiveContainer, AreaChart, Area, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

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

function MiniTrendChart({ data, color = "hsl(var(--primary))" }: { data: { value: number }[]; color?: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis domain={[0, 100]} hide />
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children, badge }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{title}</span>
            {badge}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SpeechProfileTab({ userId, profileId, windowSize }: SpeechProfileTabProps) {
  const { profile: speechProfile, loading: profileLoading } = useUserSpeechProfile(
    userId, { profileId, enabled: !!userId }
  );
  const { summary: adaptationSummary, isLoading: adaptLoading } = useAdaptationProof(userId, windowSize);
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId, { profileId });
  const { score: recoveryScore, breakdown, confidence, loading: rsLoading } = useRecoveryScore(userId, profileId);
  const { currentScore: cueScore, trend: cueTrend, loading: cueLoading } = useCueIndependence(userId, { profileId });
  const { mastered, emerging, struggling, loading: wmLoading } = useWordMastery(userId);
  const { currentScore: errorScore, trend: errorTrend, loading: eqLoading } = useErrorQualityScore(userId);

  const [recomputing, setRecomputing] = useState(false);
  const [recoverySnapshots, setRecoverySnapshots] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<{ retained: { word: string; sessions: number; level: string }[]; weak: string[]; retainedCount: number; totalTracked: number } | null>(null);

  const isLoading = profileLoading || adaptLoading || lrLoading || rsLoading;

  useEffect(() => {
    if (!profileId) return;
    supabase
      .from("recovery_score_snapshots")
      .select("snapshot_date, recovery_score, accuracy_score, cue_independence_score, error_quality_score")
      .eq("profile_id", profileId)
      .order("snapshot_date", { ascending: true })
      .limit(14)
      .then(({ data }) => setRecoverySnapshots(data ?? []));
  }, [profileId]);

  useEffect(() => {
    if (!userId) return;
    loadWordHistory(userId, 100).then((history) => {
      const retained = getRetainedWords(history);
      const hint = getRetentionDifficultyHint(history);
      const totalTracked = history.filter(w => w.sessionCount >= 2).length;
      setRetentionData({
        retained,
        weak: hint.weakWords,
        retainedCount: hint.retainedWords.length,
        totalTracked,
      });
    });
  }, [userId]);

  const freshness = useMemo(
    () => evaluateProfileFreshness(speechProfile?.updated_at),
    [speechProfile?.updated_at]
  );

  const focusPhonemes = useMemo(() => {
    if (!speechProfile?.phoneme_difficulty_map) return [];
    return Object.entries(speechProfile.phoneme_difficulty_map)
      .filter(([, v]) => v.accuracy < 0.7 && v.trials >= 3)
      .sort(([, a], [, b]) => a.accuracy - b.accuracy)
      .slice(0, 8);
  }, [speechProfile]);

  const cueEfficacy = speechProfile?.cue_efficacy_by_type;
  const bestCue = useMemo(() => {
    if (!cueEfficacy) return null;
    const entries = Object.entries(cueEfficacy).filter(([, d]) => d.total >= 3);
    if (entries.length === 0) return null;
    entries.sort(([, a], [, b]) => b.successRate - a.successRate);
    return { type: entries[0][0], rate: entries[0][1].successRate, total: entries[0][1].total };
  }, [cueEfficacy]);

  const errorDist = speechProfile?.error_type_distribution;
  const totalErrors = errorDist ? Object.values(errorDist).reduce((a, b) => a + b, 0) : 0;
  const challengingCategories = (speechProfile as any)?.most_challenging_categories;
  const trialCount = (speechProfile as any)?.trial_count ?? (speechProfile as any)?.total_trials;
  const gopDataCount = speechProfile?.trials_with_gop_data;
  const phonemeTokenCount = speechProfile?.phoneme_token_count;
  const profileConfidence = (speechProfile as any)?.confidence_level || confidence;

  const recoveryTrendData = useMemo(() =>
    recoverySnapshots.map((s) => ({ value: Math.round(s.recovery_score) })),
    [recoverySnapshots]
  );
  const cueTrendData = useMemo(() =>
    recoverySnapshots.filter((s) => s.cue_independence_score != null).map((s) => ({ value: Math.round(s.cue_independence_score) })),
    [recoverySnapshots]
  );

  // Primary weakness — top focus sound or top struggling category
  const primaryWeakness = useMemo(() => {
    if (focusPhonemes.length > 0) {
      const [phoneme, data] = focusPhonemes[0];
      return `/${phoneme}/ at ${Math.round(data.accuracy * 100)}% accuracy`;
    }
    if (challengingCategories && challengingCategories.length > 0) {
      const cat = challengingCategories[0];
      const name = typeof cat === "string" ? cat : cat.category || "Unknown";
      return name.replace(/_/g, " ");
    }
    return null;
  }, [focusPhonemes, challengingCategories]);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await recomputeSpeechProfileNow(userId, { force: true, profileId });
      toast.success("Speech profile recomputed successfully");
    } catch (err) {
      toast.error("Failed to recompute speech profile");
    } finally {
      setRecomputing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* ═══════ CORE PERFORMANCE (always visible) ═══════ */}

      {/* Recovery Score */}
      {recoveryScore != null && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Recovery Score
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 space-y-3">
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
            {recoveryTrendData.length >= 2 && (
              <MiniTrendChart data={recoveryTrendData} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Best Cue + Retention + Primary Weakness — compact row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Best Cue */}
        {bestCue && (
          <Card className="border-success/20 bg-success/5">
            <CardContent className="py-3 flex items-center gap-3">
              <Award className="w-5 h-5 text-success shrink-0" />
              <div>
                <p className="text-sm font-semibold">Best Cue</p>
                <p className="text-xs text-muted-foreground capitalize">{bestCue.type.replace(/_/g, " ")} · {Math.round(bestCue.rate * 100)}%</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Retention */}
        {retentionData && retentionData.totalTracked > 0 && (
          <Card>
            <CardContent className="py-3 flex items-center gap-3">
              <Repeat className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold">Retention</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round((retentionData.retainedCount / retentionData.totalTracked) * 100)}% · {retentionData.retainedCount}/{retentionData.totalTracked} words
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Primary Weakness */}
        {primaryWeakness && (
          <Card className="border-destructive/20">
            <CardContent className="py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-semibold">Primary Weakness</p>
                <p className="text-xs text-muted-foreground">{primaryWeakness}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════ DETAILED PATTERNS (collapsible) ═══════ */}
      <Card className="border-border/50">
        <CollapsibleSection title="Detailed Patterns" icon={BarChart3} defaultOpen={false}>
          <div className="space-y-3 pb-3">
            {/* Focus Sounds */}
            {focusPhonemes.length > 0 && (
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-primary" />
                    Focus Sounds
                    <Badge variant="secondary" className="text-xs">{focusPhonemes.length}</Badge>
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
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Cue Response
                    {cueTrend && <TrendBadge trend={cueTrend as Trend} />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 space-y-3">
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
                  {cueTrendData.length >= 2 && (
                    <MiniTrendChart data={cueTrendData} color="hsl(var(--success, 142 76% 36%))" />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error Patterns */}
            {errorDist && totalErrors > 0 && (
              <Card className="mx-1">
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

            {/* Challenging Categories */}
            {challengingCategories && challengingCategories.length > 0 && (
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Challenging Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex flex-wrap gap-2">
                    {challengingCategories.slice(0, 6).map((cat: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {typeof cat === "string" ? cat.replace(/_/g, " ") : cat.category?.replace(/_/g, " ") || "Unknown"}
                        {typeof cat !== "string" && cat.accuracy != null && (
                          <span className="ml-1 text-muted-foreground">{Math.round(cat.accuracy * 100)}%</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Word Mastery */}
            {(mastered > 0 || emerging > 0 || struggling > 0) && (
              <Card className="mx-1">
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
                      <div className="text-xs text-muted-foreground">Mastered</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-primary">{emerging}</div>
                      <div className="text-xs text-muted-foreground">Emerging</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-destructive">{struggling}</div>
                      <div className="text-xs text-muted-foreground">Struggling</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Retention detail */}
            {retentionData && retentionData.totalTracked > 0 && (
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-primary" />
                    Retention & Carryover
                    <Badge variant="secondary" className="text-xs">
                      {retentionData.retainedCount}/{retentionData.totalTracked} retained
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cross-session retention</span>
                      <span className="font-semibold">
                        {Math.round((retentionData.retainedCount / retentionData.totalTracked) * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={(retentionData.retainedCount / retentionData.totalTracked) * 100}
                      className="h-2"
                    />
                  </div>
                  {retentionData.retained.length > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-semibold text-success flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Retained Words
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {retentionData.retained.map((r) => (
                          <Badge key={r.word} variant="outline" className="text-xs py-0 gap-1">
                            "{r.word}" <span className="text-muted-foreground">({r.sessions}s, {r.level})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {retentionData.weak.length > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-semibold text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Needs Re-exposure
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {retentionData.weak.map((w) => (
                          <Badge key={w} variant="destructive" className="text-xs py-0">
                            "{w}"
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CollapsibleSection>
      </Card>

      {/* ═══════ DATA QUALITY (collapsible) ═══════ */}
      <Card className="border-border/30">
        <CollapsibleSection title="Data Quality & Profile" icon={Database} defaultOpen={false}>
          <div className="space-y-3 pb-3">
            {/* Profile Freshness */}
            <Card className="mx-1 border-border/50">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Profile status:</span>
                  <Badge
                    variant={freshness.status === "fresh" ? "default" : freshness.status === "stale" || freshness.status === "missing" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {freshness.status}
                  </Badge>
                  {freshness.hoursSinceCompute != null && (
                    <span className="text-xs text-muted-foreground">{freshness.hoursSinceCompute}h ago</span>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleRecompute} disabled={recomputing}>
                  <RefreshCw className={cn("w-3 h-3", recomputing && "animate-spin")} />
                  {recomputing ? "Computing…" : "Recompute"}
                </Button>
              </CardContent>
            </Card>

            {/* Learning Rates */}
            {learningRates && learningRates.length > 0 && (
              <Card className="mx-1">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Learning Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2">
                    {learningRates.slice(0, 4).map((r) => {
                      const slope = r.accuracySlope;
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
              <Card className="mx-1">
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
                      <div className="text-xs text-muted-foreground">Adapted Trials</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-success">
                        {adaptationSummary.overallAdaptationRate != null ? `${Math.round(adaptationSummary.overallAdaptationRate * 100)}%` : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">Adaptation Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evidence / Confidence */}
            <Card className="border-border/30 mx-1">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  Evidence & Confidence
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  {trialCount != null && (
                    <div>
                      <div className="text-lg font-bold">{trialCount}</div>
                      <div className="text-muted-foreground">Trials</div>
                    </div>
                  )}
                  {gopDataCount != null && (
                    <div>
                      <div className="text-lg font-bold">{gopDataCount}</div>
                      <div className="text-muted-foreground">Pronunciation Samples</div>
                    </div>
                  )}
                  {phonemeTokenCount != null && (
                    <div>
                      <div className="text-lg font-bold">{phonemeTokenCount}</div>
                      <div className="text-muted-foreground">Sound Tokens</div>
                    </div>
                  )}
                  {profileConfidence && (
                    <div>
                      <Badge variant={profileConfidence === "high" ? "default" : profileConfidence === "medium" ? "secondary" : "outline"} className="text-xs">
                        {profileConfidence}
                      </Badge>
                      <div className="text-muted-foreground mt-1">Confidence</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>
      </Card>
    </div>
  );
}
