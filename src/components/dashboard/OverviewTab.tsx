import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Brain, Lightbulb, Gamepad2, MessageSquare, ChevronDown, ChevronRight, TrendingUp, Target, AlertTriangle, Crosshair, Sparkles, Battery, Plus, Activity, Stethoscope, Clock, ClipboardList } from "lucide-react";
import { CaregiverTodayCard } from "@/components/CaregiverTodayCard";
import { useUiMode } from "@/hooks/useUiMode";
import { useProfile } from "@/hooks/useProfile";
import { useDailyReadiness } from "@/hooks/useDailyReadiness";
import { useDoseLogs } from "@/hooks/useDoseLogs";
import { ReadinessStatusCard } from "@/components/ReadinessStatusCard";
import { DailyReadinessCheckin } from "@/components/DailyReadinessCheckin";
import { DoseLogEntry } from "@/components/DoseLogEntry";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GamePickerDialog } from "@/components/GamePickerDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { currentRoute, withReturnTo } from "@/lib/navigation";
import { TodaysPlanCard } from "@/components/TodaysPlanCard";
import { CapabilityGatingInfo } from "@/components/CapabilityGatingInfo";
import { ExerciseGatingBadge } from "@/components/ExerciseGatingBadge";
import { RedFlagAlerts } from "@/components/RedFlagAlerts";
import { ExerciseCarousel } from "@/components/ExerciseCarousel";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import { TodaysSessionStats } from "@/components/TodaysSessionStats";
import { WeeklyTrendsChart } from "@/components/WeeklyTrendsChart";
import { RecoverySnapshot } from "@/components/RecoverySnapshot";
import { WeeklyRecoverySnapshot } from "@/components/WeeklyRecoverySnapshot";
import { TodaysActivityCard } from "@/components/TodaysActivityCard";
import { ActivityTrendChart } from "@/components/ActivityTrendChart";
import { ClinicianPatientHeader } from "@/components/ClinicianPatientHeader";
import { FunctionalGoalsWidget } from "@/components/FunctionalGoalsWidget";
import { RecentSessionsSummary } from "@/components/RecentSessionsSummary";
import { StandardizedAssessmentsCard } from "@/components/StandardizedAssessmentsCard";
import { CaregiverContextNotes } from "@/components/CaregiverContextNotes";
import { getAdaptationSummary } from "@/lib/exerciseGating";
import { buildPresetLesson } from "@/lib/dailyLessonEngine";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ProgressCardSkeleton, 
  ExerciseCardSkeleton,
  ExerciseStatsTileSkeleton
} from "./DashboardSkeletons";

// Helper hook to check if section has new data since last visit
const useSectionNewData = (sectionKey: string, latestTimestamp?: string | null) => {
  const storageKey = `dashboard_section_seen_${sectionKey}`;
  
  const hasNewData = useMemo(() => {
    if (!latestTimestamp) return false;
    const lastSeen = localStorage.getItem(storageKey);
    if (!lastSeen) return true; // Never seen = new
    return new Date(latestTimestamp) > new Date(lastSeen);
  }, [latestTimestamp, storageKey]);
  
  const markSeen = useCallback(() => {
    localStorage.setItem(storageKey, new Date().toISOString());
  }, [storageKey]);
  
  return { hasNewData, markSeen };
};

// Collapsible section wrapper component
const CollapsibleSection = ({ 
  title, 
  icon: Icon, 
  defaultOpen = false, 
  hint,
  children,
  badge,
  alertCount,
  hasNewData = false,
  onOpen
}: { 
  title: string; 
  icon: React.ElementType; 
  defaultOpen?: boolean;
  hint?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  alertCount?: number;
  hasNewData?: boolean;
  onOpen?: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || hasNewData);
  
  // Respond to defaultOpen changes (e.g., clinician mode toggle)
  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);
  
  // Call onOpen when section is opened (to mark as seen)
  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    if (open && onOpen) {
      onOpen();
    }
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">{title}</span>
            {hasNewData && !isOpen && (
              <Sparkles className="w-4 h-4 text-amber-500" />
            )}
            {alertCount && alertCount > 0 && (
              <Badge variant="destructive" className="text-xs">{alertCount}</Badge>
            )}
            {badge}
          </div>
          <div className="flex items-center gap-2">
            {hint && !isOpen && (
              <span className="text-sm text-muted-foreground hidden sm:block">{hint}</span>
            )}
            {isOpen ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 animate-fade-in">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const OverviewTab = memo(function OverviewTab() {
  const { uiMode } = useUiMode();
  const isClinician = uiMode === "clinician" || uiMode === "admin";
  const isCaregiver = uiMode === "caregiver";
  const {
    userId,
    todayProgress,
    doseCap,
    redFlags,
    clinicalProfile,
    recommendations,
    recommendedExercises,
    lesson,
    todayFocus,
    checkExerciseAccess,
    getAdaptations,
    hasAssessment,
    hasSoftOverride,
    onStartAssessment
  } = useDashboardContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const returnPath = currentRoute(location);
  
  // Recovery Spine: readiness + dose
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const { todayCheckin, hasCheckedInToday, isLoading: readinessLoading, isSaving: readinessSaving, upsertReadiness } = useDailyReadiness(profileId);
  const { domains, todayLogs, isSaving: doseSaving, upsertDoseLog } = useDoseLogs(profileId, 7);
  const [showReadinessDialog, setShowReadinessDialog] = useState(false);
  
  // Check if user arrived from error patterns with targeted practice info
  const targetedPractice = location.state?.targetedPractice as {
    words?: string[];
    exerciseType?: string;
    source?: string;
  } | undefined;
  
  // Split red flags by severity: urgent (red/orange) vs informational (yellow)
  const urgentFlags = redFlags.filter(f => f.severity === 'red' || f.severity === 'orange');
  const informationalFlags = redFlags.filter(f => f.severity === 'yellow');
  
  // Smart section tracking - use today's date + progress as proxy for "new data"
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionTimestamp = todayProgress > 0 
    ? `${todayKey}-${todayProgress}` 
    : null;
  
  // Track new data for each section
  const statsSection = useSectionNewData('stats', sessionTimestamp);
  const insightsSection = useSectionNewData('insights', sessionTimestamp);
  const languageSection = useSectionNewData('language', sessionTimestamp);
  const safetySection = useSectionNewData('safety', 
    informationalFlags.length > 0 ? `${todayKey}-${informationalFlags.length}` : null
  );
  
  // Progressive loading states
  const [showProgress, setShowProgress] = useState(false);
  const [showRecoveryIntel, setShowRecoveryIntel] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showLanguageStats, setShowLanguageStats] = useState(false);
  const [showExercises, setShowExercises] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);

  useEffect(() => {
    // Phase 1: Critical content (immediate)
    setShowProgress(true);
    
    // Phase 2: AI summaries (300ms delay)
    const timer1 = setTimeout(() => setShowRecoveryIntel(true), 300);
    
    // Phase 3: Plan (600ms delay)
    const timer2 = setTimeout(() => setShowPlan(true), 600);
    
    // Phase 4: Language Stats (750ms delay)
    const timer3 = setTimeout(() => setShowLanguageStats(true), 750);
    
    // Phase 5: Exercises (900ms delay)
    const timer4 = setTimeout(() => setShowExercises(true), 900);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  // Helper to get targeted practice route
  const getTargetedPracticeRoute = () => {
    if (!targetedPractice?.words?.length) return null;
    const wordsParam = targetedPractice.words.join(',');
    switch (targetedPractice.exerciseType) {
      case 'photo-naming':
        return `/exercise/photo-naming?targets=${wordsParam}&source=dashboard_continue`;
      case 'semantic-features':
        return `/exercise/semantic-features?targets=${wordsParam}&source=dashboard_continue`;
      case 'phonological':
        return `/exercise/phonological-awareness?targets=${wordsParam}&source=dashboard_continue`;
      default:
        return `/exercise/photo-naming?targets=${wordsParam}&source=dashboard_continue`;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ===== CLINICIAN VIEW LABEL ===== */}
      {isClinician && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Clinician View (read-only)</span>
        </div>
      )}

      {/* ===== CLINICIAN HEADER CARD — 3-second patient summary ===== */}
      {isClinician && <ClinicianPatientHeader />}

      {/* ===== URGENT RED FLAGS (red/orange) - Always visible ===== */}
      {urgentFlags.length > 0 && (
        <RedFlagAlerts flags={urgentFlags} />
      )}

      {/* ===== PATIENT PRIMARY ACTION — Top of page for patients ===== */}
      {!isClinician && (
        <>
          {/* Caregiver Today Card — single actionable summary */}
          {isCaregiver && <CaregiverTodayCard />}

          {/* Daily Readiness Check-In */}
          <ReadinessStatusCard
            checkin={todayCheckin}
            onCheckIn={() => setShowReadinessDialog(true)}
            isLoading={readinessLoading}
          />

          <Dialog open={showReadinessDialog} onOpenChange={setShowReadinessDialog}>
            <DialogContent className="max-w-lg p-0 border-0 bg-transparent shadow-none">
              <DailyReadinessCheckin
                onSubmit={async (data) => {
                  const result = await upsertReadiness(data);
                  if (result) setShowReadinessDialog(false);
                  return result;
                }}
                onSkip={() => setShowReadinessDialog(false)}
                isSaving={readinessSaving}
              />
            </DialogContent>
          </Dialog>

          {/* Primary Action Area */}
          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Ready to Practice?</h2>
                {doseCap.warningLevel !== 'safe' && doseCap.enforceCaps && (
                  <Badge variant="secondary" className="gap-1">
                    {doseCap.minutesRemaining > 0 ? `${doseCap.minutesRemaining}min left` : 'Goal reached!'}
                  </Badge>
                )}
              </div>
              
              {targetedPractice?.words?.length && getTargetedPracticeRoute() && (
                <Button 
                  size="lg" 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-lg h-14"
                  onClick={() => navigate(getTargetedPracticeRoute()!)}
                  disabled={doseCap.warningLevel === 'limit'}
                >
                  <Crosshair className="w-6 h-6 mr-2" />
                  Continue Targeted Practice ({targetedPractice.words.length} words)
                </Button>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  size="lg" 
                  className="flex-1 bg-gradient-healing hover:opacity-90 text-lg h-14"
                  onClick={() => {
                    if (lesson) {
                      navigate("/lesson", { state: { lesson, clinicalProfile } });
                    }
                  }}
                  disabled={!lesson || doseCap.warningLevel === 'limit'}
                >
                  <Play className="w-6 h-6 mr-2" />
                  Start Today's Session
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="flex-1 h-14"
                  onClick={() => setShowGamePicker(true)}
                  disabled={doseCap.warningLevel === 'limit'}
                >
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Choose a Game
                </Button>
              </div>

              {!hasAssessment && (
                <Button 
                  variant="ghost" 
                  className="w-full text-primary"
                  onClick={onStartAssessment}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Complete quick assessment to personalize exercises
                </Button>
              )}

              {doseCap.warningLevel !== 'safe' && doseCap.warningLevel !== 'limit' && doseCap.enforceCaps && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Today's progress</span>
                    <span>{doseCap.todayMinutes} / {doseCap.dailyCapMinutes} min</span>
                  </div>
                  <Progress value={(doseCap.todayMinutes / doseCap.dailyCapMinutes) * 100} className="h-2" />
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* ===== RECOVERY & ACTIVITY — Single section for all trend data ===== */}
      {showRecoveryIntel && (
        <CollapsibleSection
          title="Recovery & Activity"
          icon={Activity}
          defaultOpen={true}
          hint="14-day trends + physical data"
        >
          <div className="space-y-6">
            <WeeklyRecoverySnapshot />
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Physical Activity
              </h4>
              <div className="space-y-4">
                <TodaysActivityCard />
                <ActivityTrendChart />
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ===== CLINICAL SUMMARY — Always visible for clinicians, collapsible for others ===== */}
      {isClinician ? (
        <div className="space-y-6 p-4 bg-card border rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">Patient Context</span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Functional Goals
            </h4>
            <FunctionalGoalsWidget userId={userId} compact={false} />
          </div>
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Sessions
            </h4>
            <RecentSessionsSummary userId={userId} />
          </div>
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Standardized Assessments
            </h4>
            <StandardizedAssessmentsCard userId={userId} />
          </div>
          <div className="border-t border-border pt-4">
            <CaregiverContextNotes profileId={profileId} />
          </div>
        </div>
      ) : (
        <CollapsibleSection
          title="Clinical Summary"
          icon={ClipboardList}
          defaultOpen={false}
          hint="Goals, sessions & assessments"
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Functional Goals
              </h4>
              <FunctionalGoalsWidget userId={userId} compact={true} />
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Sessions
              </h4>
              <RecentSessionsSummary userId={userId} />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ===== PATIENT SECONDARY WIDGETS — Hidden in clinician mode ===== */}
      {!isClinician && (
        <>
          <CollapsibleSection
            title="Log Today's Therapy"
            icon={Plus}
            defaultOpen={false}
            hint="PT, OT, activity"
          >
            <DoseLogEntry
              domains={domains}
              todayLogs={todayLogs}
              onSubmit={upsertDoseLog}
              isSaving={doseSaving}
            />
          </CollapsibleSection>
        </>
      )}


      {/* ===== PATIENT/CAREGIVER COLLAPSIBLE SECTIONS ===== */}
      {!isClinician && (
        <>
          {/* Today's Plan Section */}
          {showPlan && lesson && (
            <CollapsibleSection 
              title="Today's Plan Details" 
              icon={Target}
              defaultOpen={false}
              hint="View lesson breakdown + adaptive engine"
            >
              <TodaysPlanCard 
                userId={userId}
                clinicalProfile={clinicalProfile}
                onStartAssessment={onStartAssessment}
                onStartLesson={() => {
                  if (lesson) {
                    navigate("/lesson", { state: { lesson, clinicalProfile, todayFocus } });
                  }
                }}
                onStartComprehensionSession={() => {
                  const presetLesson = buildPresetLesson('comprehension_session');
                  if (presetLesson) {
                    navigate("/lesson", { state: { lesson: presetLesson, clinicalProfile, todayFocus } });
                  }
                }}
                doseCapReached={doseCap.warningLevel === 'limit'}
              />
            </CollapsibleSection>
          )}

          {/* Insights Section - Key takeaways */}
          {showRecoveryIntel && (
            <CollapsibleSection 
              title="Your Recovery Insights" 
              icon={Lightbulb}
              defaultOpen={false}
              hint="See your progress summary"
              hasNewData={insightsSection.hasNewData}
              onOpen={insightsSection.markSeen}
              badge={
                <Badge variant="outline" className="text-xs">AI Summary</Badge>
              }
            >
              <RecoverySnapshot userId={userId} />
            </CollapsibleSection>
          )}
        </>
      )}

      {/* ===== SHARED SECTIONS (visible in all modes) ===== */}

      {/* Performance — Stats + Language in one section */}
      <CollapsibleSection 
        title="Performance"
        icon={TrendingUp}
        defaultOpen={isClinician}
        hint="Stats, trends & language progress"
        hasNewData={statsSection.hasNewData || languageSection.hasNewData}
        onOpen={() => { statsSection.markSeen(); languageSection.markSeen(); }}
      >
        <div className="space-y-6">
          {!showProgress ? (
            <ProgressCardSkeleton />
          ) : (
            <div className="space-y-4">
              <TodaysSessionStats />
              <WeeklyTrendsChart />
            </div>
          )}

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Language Progress
            </h4>
            {!showLanguageStats ? (
              <div className="grid md:grid-cols-3 gap-4">
                <ExerciseStatsTileSkeleton delay={0} />
                <ExerciseStatsTileSkeleton delay={100} />
                <ExerciseStatsTileSkeleton delay={200} />
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                <ExerciseStatsTile
                  userId={userId}
                  exerciseSlug="semantic-features"
                  exerciseTitle="Semantic Features"
                />
                <ExerciseStatsTile
                  userId={userId}
                  exerciseSlug="phonological"
                  exerciseTitle="Phonological"
                />
                <ExerciseStatsTile
                  userId={userId}
                  exerciseSlug="sentence-construction"
                  exerciseTitle="Grammar"
                />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* All Exercises Section - Patient/Caregiver only */}
      {!isClinician && (
        <CollapsibleSection 
          title="All Exercises" 
          icon={Target}
          defaultOpen={false}
          hint={`${recommendedExercises.length} available`}
          badge={
            clinicalProfile && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Brain className="w-3 h-3" />
                Personalized
              </Badge>
            )
          }
        >
          {showExercises && (
            <div className="mb-4">
              <CapabilityGatingInfo
                hasAssessment={hasAssessment}
                lockedCount={recommendedExercises.filter(ex => !checkExerciseAccess(ex.id).accessible).length}
                adaptedCount={recommendedExercises.filter(ex => {
                  const access = checkExerciseAccess(ex.id);
                  const adaptations = getAdaptations(ex.id);
                  return access.accessible && adaptations && getAdaptationSummary(adaptations).length > 0;
                }).length}
                hasSoftOverride={hasSoftOverride}
                onStartAssessment={onStartAssessment}
              />
            </div>
          )}
          
          {!showExercises ? (
            <div className="grid md:grid-cols-3 gap-4">
              <ExerciseCardSkeleton delay={0} />
              <ExerciseCardSkeleton delay={100} />
              <ExerciseCardSkeleton delay={200} />
            </div>
          ) : isMobile ? (
            <ExerciseCarousel
              exercises={recommendedExercises}
              onStartExercise={(slug) => navigate(withReturnTo(`/exercise/${slug}`, returnPath))}
              gatingInfo={Object.fromEntries(
                recommendedExercises.map((ex) => {
                  const accessCheck = checkExerciseAccess(ex.id);
                  return [ex.id, {
                    blocked: !accessCheck.accessible,
                    reason: accessCheck.reason,
                  }];
                })
              )}
            />
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {recommendedExercises.map((exercise, index) => {
              const Icon = exercise.icon;
              const recommendation = recommendations.find(r => r.slug === exercise.id);
              const accessCheck = checkExerciseAccess(exercise.id);
              const adaptations = getAdaptations(exercise.id);
              const adaptationSummary = adaptations ? getAdaptationSummary(adaptations) : [];
              const isLocked = !accessCheck.accessible;
              const inTodaysPlan = lesson?.blocks?.some(b => b.exerciseId === exercise.id);
              
              return (
                <Card 
                  key={exercise.id}
                  className={`p-6 shadow-card transition-smooth border-2 animate-fade-in ${
                    isLocked 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:shadow-glow cursor-pointer hover:border-primary'
                  } group`}
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => !isLocked && navigate(withReturnTo(`/exercise/${exercise.id}`, returnPath))}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`w-14 h-14 rounded-full ${exercise.color} flex items-center justify-center ${!isLocked && 'group-hover:scale-110'} transition-smooth`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <ExerciseGatingBadge
                        isAccessible={accessCheck.accessible}
                        reason={accessCheck.reason}
                        alternative={accessCheck.alternative}
                        hasAdaptations={!!adaptations}
                        adaptationCount={adaptationSummary.length}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-1 bg-primary-glow text-primary rounded-full">
                          {exercise.category}
                        </span>
                        {recommendation && (
                          <Badge variant="outline" className="text-xs">
                            {recommendation.priority} priority
                          </Badge>
                        )}
                        {inTodaysPlan && (
                          <Badge className="text-xs bg-blue-500 hover:bg-blue-600">
                            In today's plan
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{exercise.title}</h3>
                      {recommendation ? (
                        <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Difficulty: {exercise.difficulty}
                        </p>
                      )}
                      
                      {!isLocked && adaptationSummary.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs font-medium text-primary mb-1">Active Adaptations:</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {adaptationSummary.slice(0, 3).map((adaptation, idx) => (
                              <li key={idx}>• {adaptation}</li>
                            ))}
                            {adaptationSummary.length > 3 && (
                              <li className="text-primary">+ {adaptationSummary.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    <Button 
                      className="w-full bg-gradient-healing hover:opacity-90"
                      size="lg"
                      disabled={isLocked}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {isLocked ? 'Locked' : 'Start Exercise'}
                    </Button>
                  </div>
                </Card>
              );
            })}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Safety Section - Yellow flags (informational, not urgent) - always visible */}
      {informationalFlags.length > 0 && (
        <CollapsibleSection 
          title="Safety Notes" 
          icon={AlertTriangle}
          defaultOpen={isClinician}
          hint="View non-urgent observations"
          alertCount={informationalFlags.length}
          hasNewData={safetySection.hasNewData}
          onOpen={safetySection.markSeen}
        >
          <RedFlagAlerts flags={informationalFlags} />
        </CollapsibleSection>
      )}

      {/* Game Picker Dialog - Patient/Caregiver only */}
      {!isClinician && (
        <GamePickerDialog 
          open={showGamePicker} 
          onOpenChange={setShowGamePicker}
          userId={userId}
        />
      )}
    </div>
  );
});
