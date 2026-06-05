/**
 * Speech Profile & Adaptation Overview
 * 
 * Trust page that connects:
 * 1. What the system thinks the user struggles with
 * 2. What signals it used (evidence)
 * 3. How fresh that profile is
 * 4. What changed in today's session because of it
 * 5. Whether adaptation is deep or light-touch
 * 
 * Dual-mode: user/family (plain language) vs clinician (detailed data)
 */

import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUiMode } from "@/hooks/useUiMode";
import { useUserSpeechProfile } from "@/hooks/useUserSpeechProfile";
import { useAdaptationProof } from "@/hooks/useAdaptationProof";
import { evaluateProfileFreshness, type ProfileFreshnessResult } from "@/lib/profileFreshness";
import { recomputeSpeechProfileNow } from "@/lib/recomputeSpeechProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Volume2, Target, Lightbulb, Shield, Clock,
  CheckCircle2, AlertTriangle, Info, RefreshCw,
  ChevronDown, ArrowLeft, Loader2, Activity,
  Zap, TrendingUp, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpLabel } from "@/components/HelpTooltip";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// === Adaptation truth map (hardcoded from verified audit) ===
interface ExerciseAdaptation {
  name: string;
  slug: string;
  level: 'strong' | 'partial' | 'telemetry';
  adapts: string[]; // what profile traits it uses
}

const ADAPTATION_MAP: ExerciseAdaptation[] = [
  { name: 'Photo Naming', slug: 'photo-naming', level: 'strong', adapts: ['focusPhonemes', 'cueType', 'difficulty'] },
  { name: 'Minimal Pairs', slug: 'minimal-pairs', level: 'strong', adapts: ['focusPhonemes', 'difficulty'] },
  { name: 'Two Clues', slug: 'two-clues', level: 'strong', adapts: ['cueType', 'difficulty'] },
  { name: 'Phonological', slug: 'phonological-awareness', level: 'strong', adapts: ['focusPhonemes', 'difficulty'] },
  { name: 'Fix Sentence', slug: 'fix-sentence', level: 'strong', adapts: ['focusPhonemes', 'cueType', 'difficulty'] },
  { name: 'Sentence Building', slug: 'sentence-construction', level: 'strong', adapts: ['focusPhonemes', 'difficulty'] },
  { name: 'Dual-Load Naming', slug: 'dual-load-naming', level: 'strong', adapts: ['focusPhonemes', 'difficulty'] },
  { name: 'Narrative Retell', slug: 'narrative-retell', level: 'strong', adapts: ['cueType', 'difficulty'] },
  { name: 'Meaning Match', slug: 'meaning-match', level: 'strong', adapts: ['cueType', 'difficulty'] },
  { name: 'Detective Mind', slug: 'detective-mind', level: 'strong', adapts: ['cueType', 'difficulty'] },
  { name: 'Abstract Compare', slug: 'abstract-compare', level: 'partial', adapts: ['difficulty'] },
  { name: 'Multi-Step Plan', slug: 'multi-step-plan', level: 'partial', adapts: ['difficulty'] },
  { name: 'Semantic Features', slug: 'semantic-features', level: 'partial', adapts: ['difficulty'] },
  { name: 'Conversation Partner', slug: 'conversation-partner', level: 'telemetry', adapts: [] },
  { name: 'Conversation Coach', slug: 'conversation-coach', level: 'telemetry', adapts: [] },
  { name: 'Thought Continuation', slug: 'thought-continuation', level: 'telemetry', adapts: [] },
  { name: 'Pattern Match', slug: 'pattern-match', level: 'telemetry', adapts: [] },
  { name: 'Left Side Hunt', slug: 'left-side-hunt', level: 'telemetry', adapts: [] },
];

export default function SpeechProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  const showClinician = isAtLeast('caregiver');

  const { profile: speechProfile, loading: profileLoading, refresh: refreshProfile } = useUserSpeechProfile(
    user?.id, { profileId: activeProfile?.id, enabled: !!user?.id }
  );
  const { summary: adaptationSummary, isLoading: adaptLoading } = useAdaptationProof(user?.id, 14);

  const [isRecomputing, setIsRecomputing] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);

  // Compute freshness
  const freshness: ProfileFreshnessResult = useMemo(() => {
    return evaluateProfileFreshness(speechProfile?.last_computed_at);
  }, [speechProfile?.last_computed_at]);

  // Extract profile traits
  const focusPhonemes = useMemo(() => {
    const map = speechProfile?.phoneme_difficulty_map;
    if (!map) return [];
    return Object.entries(map)
      .filter(([_, v]) => v.accuracy < 0.7 && v.trials >= 3)
      .sort((a, b) => a[1].accuracy - b[1].accuracy)
      .map(([p]) => p);
  }, [speechProfile?.phoneme_difficulty_map]);

  const bestCueType = useMemo(() => {
    const efficacy = speechProfile?.cue_efficacy_by_type;
    if (!efficacy) return null;
    const entries = Object.entries(efficacy).filter(([_, v]) => v.total >= 3);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1].successRate - a[1].successRate)[0];
  }, [speechProfile?.cue_efficacy_by_type]);

  const errorDistribution = useMemo(() => {
    const dist = speechProfile?.error_type_distribution;
    if (!dist) return [];
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }));
  }, [speechProfile?.error_type_distribution]);

  const challengingCategories = speechProfile?.most_challenging_categories as
    Array<{ category: string; successRate: number; trials: number }> | null;

  const handleRecompute = async () => {
    if (!user?.id || !activeProfile?.id || isRecomputing) return;
    setIsRecomputing(true);
    try {
      const result = await recomputeSpeechProfileNow(user.id, { force: true, profileId: activeProfile.id });
      if (result.success) {
        toast.success('Speech profile updated');
        await refreshProfile();
      } else {
        toast.error(result.reason || 'Recompute failed');
      }
    } catch {
      toast.error('Failed to recompute');
    } finally {
      setIsRecomputing(false);
    }
  };

  const isLoading = profileLoading || adaptLoading;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const strongCount = ADAPTATION_MAP.filter(e => e.level === 'strong').length;
  const partialCount = ADAPTATION_MAP.filter(e => e.level === 'partial').length;
  const telemetryCount = ADAPTATION_MAP.filter(e => e.level === 'telemetry').length;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Speech Profile
          </h1>
          <p className="text-sm text-muted-foreground">
            How the system understands and adapts to your speech
          </p>
        </div>
        <FreshnessBadge freshness={freshness} />
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="text-xs">
            <Volume2 className="h-3 w-3 mr-1" /> Profile
          </TabsTrigger>
          <TabsTrigger value="adaptation" className="text-xs">
            <Zap className="h-3 w-3 mr-1" /> Adaptation
          </TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs">
            <Shield className="h-3 w-3 mr-1" /> Evidence
          </TabsTrigger>
        </TabsList>

        {/* =================== TAB 1: PROFILE =================== */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          {!speechProfile ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-3">
                <Brain className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No speech profile yet. Complete a few exercises to build your profile.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Focus Sounds */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <HelpLabel term="Focus Phonemes">{showClinician ? 'Focus Phonemes' : 'Sounds We\'re Working On'}</HelpLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {focusPhonemes.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {focusPhonemes.map(p => {
                          const stats = speechProfile.phoneme_difficulty_map?.[p];
                          return (
                            <Badge key={p} variant="secondary" className="font-mono text-xs px-2 py-0.5">
                              /{p}/ {stats && showClinician && (
                                <span className="ml-1 text-muted-foreground">
                                  {Math.round(stats.accuracy * 100)}% ({stats.trials}t)
                                </span>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                      {!showClinician && (
                        <p className="text-xs text-muted-foreground">
                          These sounds appear in your exercises more often to help you practice.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No specific sound difficulties detected yet. Keep practicing!
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Best Cue Type */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <HelpLabel term="Recommended Cue Type">{showClinician ? 'Cue Preference' : 'What Helps You Most'}</HelpLabel>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bestCueType ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="capitalize">{bestCueType[0].replace('_', ' ')}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(bestCueType[1].successRate * 100)}% success rate
                        </span>
                        {showClinician && (
                          <span className="text-xs text-muted-foreground">
                            (n={bestCueType[1].total})
                          </span>
                        )}
                      </div>
                      {!showClinician && (
                        <p className="text-xs text-muted-foreground">
                          {bestCueType[0] === 'semantic' && 'Meaning-based hints work best for you — like categories or descriptions.'}
                          {bestCueType[0] === 'phonemic' && 'Sound-based hints work best — like hearing the first sound of a word.'}
                          {bestCueType[0] === 'full_word' && 'Hearing the full word helps you the most right now.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Not enough data yet to determine your best hint type.
                    </p>
                  )}

                  {/* All cue types for clinician */}
                  {showClinician && speechProfile.cue_efficacy_by_type && (
                    <div className="mt-3 space-y-1">
                      {Object.entries(speechProfile.cue_efficacy_by_type).map(([type, stats]) => (
                        <div key={type} className="flex items-center gap-2 text-xs">
                          <span className="w-20 capitalize text-muted-foreground">{type.replace('_', ' ')}</span>
                          <Progress value={stats.successRate * 100} className="h-1.5 flex-1" />
                          <span className="w-16 text-right text-muted-foreground">
                            {Math.round(stats.successRate * 100)}% (n={stats.total})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Error Patterns */}
              {errorDistribution.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                      <HelpLabel term="Error Distribution">{showClinician ? 'Error Distribution' : 'Common Mistakes'}</HelpLabel>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {errorDistribution.slice(0, showClinician ? undefined : 3).map(({ type, pct }) => (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-xs w-28 capitalize text-muted-foreground truncate">
                          {type.replace(/_/g, ' ')}
                        </span>
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs w-8 text-right text-muted-foreground">{pct}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Challenging Categories */}
              {challengingCategories && challengingCategories.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <HelpLabel term="Challenging Categories">{showClinician ? 'Challenging Categories' : 'Harder Word Groups'}</HelpLabel>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {challengingCategories.slice(0, 5).map(cat => (
                        <Badge key={cat.category} variant="outline" className="text-xs">
                          {cat.category}
                          {showClinician && (
                            <span className="ml-1 text-muted-foreground">
                              {Math.round(cat.successRate * 100)}% ({cat.trials}t)
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* =================== TAB 2: ADAPTATION =================== */}
        <TabsContent value="adaptation" className="space-y-4 mt-4">
          {/* Today's concrete impact */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {showClinician ? "Today's Adaptation Impact" : "What Changed in Today's Sessions"}
              </CardTitle>
              <CardDescription className="text-xs">
                {showClinician
                  ? 'Concrete profile-driven behavior changes active now'
                  : 'How your practice is personalized right now'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <TodayImpactStatements
                focusPhonemes={focusPhonemes}
                bestCueType={bestCueType}
                challengingCategories={challengingCategories}
                showClinician={showClinician}
              />
            </CardContent>
          </Card>

          {/* Exercise adaptation coverage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                 <Shield className="h-4 w-4 text-primary" />
                 <HelpLabel term="Adaptation Coverage">{showClinician ? 'Adaptation Coverage' : 'Which Exercises Adapt to You'}</HelpLabel>
              </CardTitle>
              <CardDescription className="text-xs">
                {showClinician
                  ? `Coverage reflects real gameplay consumption: ${strongCount} strong, ${partialCount} partial, ${telemetryCount} telemetry-only`
                  : `Some exercises change a lot based on your profile, while others are still learning about you`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {ADAPTATION_MAP
                  .filter(e => showAllExercises || e.level === 'strong')
                  .map(ex => (
                    <div key={ex.slug} className="flex items-center gap-2 py-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        ex.level === 'strong' && "bg-green-500",
                        ex.level === 'partial' && "bg-blue-500",
                        ex.level === 'telemetry' && "bg-muted-foreground/40",
                      )} />
                      <span className="text-xs flex-1">{ex.name}</span>
                      {showClinician && ex.adapts.length > 0 && (
                        <div className="flex gap-0.5">
                          {ex.adapts.map(a => (
                            <Badge key={a} variant="outline" className="text-[9px] px-1 py-0">
                              {a === 'focusPhonemes' ? 'phoneme' : a === 'cueType' ? 'cue' : 'tier'}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {!showClinician && (
                        <Badge variant={ex.level === 'strong' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                          {ex.level === 'strong' ? 'Personalized' : ex.level === 'partial' ? 'Basic' : 'Learning'}
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
              {!showAllExercises && (
                <Button
                  variant="ghost" size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => setShowAllExercises(true)}
                >
                  Show all {ADAPTATION_MAP.length} exercises
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Adaptation proof summary */}
          {adaptationSummary && showClinician && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                   Adaptation Telemetry (14d)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MiniStat label="Total trials" value={adaptationSummary.totalTrials} />
                <MiniStat label="With telemetry" value={`${Math.round(adaptationSummary.telemetryCoverage * 100)}%`} />
                <MiniStat label="Adapted trials" value={`${Math.round(adaptationSummary.overallAdaptationRate * 100)}%`} />
                <MiniStat label="Games adapted" value={`${adaptationSummary.gamesWithAdaptation}/${adaptationSummary.totalGames}`} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =================== TAB 3: EVIDENCE =================== */}
        <TabsContent value="evidence" className="space-y-4 mt-4">
          {/* Freshness */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <HelpLabel term="Profile Freshness">Profile Freshness</HelpLabel>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <FreshnessBadge freshness={freshness} large />
                  {speechProfile?.last_computed_at && (
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(speechProfile.last_computed_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={handleRecompute}
                  disabled={isRecomputing || freshness.status === 'fresh'}
                >
                  {isRecomputing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refresh
                </Button>
              </div>
              {freshness.warning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{freshness.warning}</p>
              )}
            </CardContent>
          </Card>

          {/* Data behind the profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                {showClinician ? 'Data Sources' : 'What This Is Based On'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DataRow
                label={showClinician ? 'Trial count at computation' : 'Exercises analyzed'}
                value={speechProfile?.trial_count_at_computation ?? 0}
              />
              {showClinician && (
                <>
                  <DataRow label="Trials with GOP data" value={speechProfile?.trials_with_gop_data ?? 0} />
                  <DataRow label="Trials with phoneme data" value={speechProfile?.trials_with_phonemes ?? 0} />
                  <DataRow label="Phoneme tokens" value={speechProfile?.phoneme_token_count ?? 0} />
                  <DataRow label="Avg stall duration" value={speechProfile?.avg_stall_duration_ms ? `${Math.round(speechProfile.avg_stall_duration_ms)}ms` : 'N/A'} />
                </>
              )}

              {/* Confidence assessment */}
              <Separator className="my-2" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Profile reliability:</span>
                <ConfidenceBadge trialCount={speechProfile?.trial_count_at_computation ?? 0} />
              </div>
              {!showClinician && (speechProfile?.trial_count_at_computation ?? 0) < 20 && (
                <p className="text-xs text-muted-foreground">
                  The more exercises you complete, the better we understand your speech. Try to do at least 20 exercises for reliable results.
                </p>
              )}
            </CardContent>
          </Card>

          {/* What's not yet adapted */}
          {showClinician && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Known Limitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                <p>• Discourse tasks (Conversation, Thought Continuation) log data but don't yet adapt gameplay</p>
                <p>• Discourse metrics (cohesion, complexity) not yet in speech profile computation</p>
                <p>• Within-session adaptive difficulty not active in most exercises</p>
                <p>• Phoneme targeting limited to exercises with phoneme-annotated stimulus banks</p>
                <p>• Profile recompute requires session completion trigger or manual refresh</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick link to Insights */}
      <div className="text-center">
        <Button variant="link" size="sm" asChild>
          <Link to="/insights?tab=intelligence">
            View detailed adaptation history →
          </Link>
        </Button>
      </div>
    </div>
  );
}

// =================== Sub-components ===================

function FreshnessBadge({ freshness, large }: { freshness: ProfileFreshnessResult; large?: boolean }) {
  const size = large ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0";
  return (
    <Badge
      variant="outline"
      className={cn(size, {
        "border-green-500 text-green-700 dark:text-green-400": freshness.status === 'fresh',
        "border-amber-500 text-amber-700 dark:text-amber-400": freshness.status === 'aging',
        "border-red-500 text-red-700 dark:text-red-400": freshness.status === 'stale',
        "border-muted-foreground text-muted-foreground": freshness.status === 'missing',
      })}
    >
      {freshness.status === 'fresh' && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {freshness.status === 'aging' && <Clock className="h-3 w-3 mr-1" />}
      {freshness.status === 'stale' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {freshness.status === 'missing' && <Info className="h-3 w-3 mr-1" />}
      {freshness.status.charAt(0).toUpperCase() + freshness.status.slice(1)}
    </Badge>
  );
}

function AdaptationRow({ icon, label, detail, active }: { icon: React.ReactNode; label: string; detail: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={cn("text-primary", !active && "text-muted-foreground")}>{icon}</div>
      <span className="text-xs flex-1">{label}</span>
      <span className="text-xs font-mono text-muted-foreground">{detail}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-2 bg-muted/30 rounded-lg">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ConfidenceBadge({ trialCount }: { trialCount: number }) {
  const level = trialCount >= 50 ? 'high' : trialCount >= 20 ? 'medium' : 'low';
  return (
    <Badge variant="outline" className={cn("text-[10px]", {
      "border-green-500 text-green-700 dark:text-green-400": level === 'high',
      "border-amber-500 text-amber-700 dark:text-amber-400": level === 'medium',
      "border-red-500 text-red-700 dark:text-red-400": level === 'low',
    })}>
      {level === 'high' ? '🟢' : level === 'medium' ? '🟡' : '🔴'} {level} confidence
    </Badge>
  );
}

/** Generates concrete, exercise-specific impact statements from profile state */
function TodayImpactStatements({
  focusPhonemes,
  bestCueType,
  challengingCategories,
  showClinician,
}: {
  focusPhonemes: string[];
  bestCueType: [string, { successRate: number; total: number }] | null;
  challengingCategories: Array<{ category: string; successRate: number; trials: number }> | null;
  showClinician: boolean;
}) {
  const statements: { icon: React.ReactNode; text: string; exercises: string }[] = [];

  if (focusPhonemes.length > 0) {
    const phonemeStr = focusPhonemes.slice(0, 3).map(p => `/${p}/`).join(', ');
    statements.push({
      icon: <Volume2 className="h-3.5 w-3.5 text-primary" />,
      text: showClinician
        ? `Photo Naming & MinimalPairs prioritize words containing ${phonemeStr}`
        : `Word exercises focus on your tricky sounds: ${phonemeStr}`,
      exercises: 'Photo Naming, Minimal Pairs, Dual-Load Naming, Phonological, Sentence Building',
    });
  }

  if (bestCueType) {
    const cueLabel = bestCueType[0].replace('_', ' ');
    if (bestCueType[0] === 'phonemic') {
      statements.push({
        icon: <Lightbulb className="h-3.5 w-3.5 text-primary" />,
        text: showClinician
          ? `Two Clues uses phonemic-first cue ladder; MeaningMatch/DetectiveMind show "first letter" hints`
          : 'Hint games lead with sound-based clues because those work best for you',
        exercises: 'Two Clues, Meaning Match, Detective Mind, Narrative Retell',
      });
    } else if (bestCueType[0] === 'semantic') {
      statements.push({
        icon: <Lightbulb className="h-3.5 w-3.5 text-primary" />,
        text: showClinician
          ? `Two Clues uses semantic-first cue ladder; MeaningMatch/DetectiveMind show "keyword" hints`
          : 'Hint games lead with meaning-based clues because those work best for you',
        exercises: 'Two Clues, Meaning Match, Detective Mind, Narrative Retell',
      });
    } else {
      statements.push({
        icon: <Lightbulb className="h-3.5 w-3.5 text-primary" />,
        text: showClinician
          ? `Cue preference: ${cueLabel} (${Math.round(bestCueType[1].successRate * 100)}% success)`
          : `Your exercises use ${cueLabel} hints because they help you most`,
        exercises: 'Two Clues, Meaning Match, Detective Mind',
      });
    }
  }

  if (challengingCategories && challengingCategories.length > 0) {
    const topCats = challengingCategories.slice(0, 2).map(c => c.category);
    statements.push({
      icon: <Activity className="h-3.5 w-3.5 text-primary" />,
      text: showClinician
        ? `Challenging categories (${topCats.join(', ')}) influence item selection in naming tasks`
        : `You're getting extra practice with ${topCats.join(' and ')} words`,
      exercises: 'Photo Naming, Fix Sentence',
    });
  }

  if (statements.length === 0) {
    return (
      <div className="text-center py-3 space-y-1">
        <Info className="h-5 w-5 mx-auto text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          {showClinician
            ? 'Insufficient profile data to drive concrete adaptations. Default parameters active.'
            : 'Complete more exercises to unlock personalized practice.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {statements.map((s, i) => (
        <div key={i} className="flex gap-2 py-1.5">
          <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
          <div className="space-y-0.5">
            <p className="text-xs leading-relaxed">{s.text}</p>
            {showClinician && (
              <p className="text-[10px] text-muted-foreground">
                Affects: {s.exercises}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
