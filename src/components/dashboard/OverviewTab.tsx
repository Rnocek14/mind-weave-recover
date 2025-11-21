import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play, Camera, Hand, MessageSquare, Target,
  Lightbulb, Volume2, List, Brain
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { RecoverySummaryCard } from "@/components/RecoverySummaryCard";
import { StrokeEducationPanel } from "@/components/StrokeEducationPanel";
import { TodaysPlanCard } from "@/components/TodaysPlanCard";
import { CapabilityGatingInfo } from "@/components/CapabilityGatingInfo";
import { ExerciseGatingBadge } from "@/components/ExerciseGatingBadge";
import { RedFlagAlerts } from "@/components/RedFlagAlerts";
import { ExerciseCarousel } from "@/components/ExerciseCarousel";
import { getAdaptationSummary } from "@/lib/exerciseGating";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { 
  ProgressCardSkeleton, 
  RecoverySummarySkeleton, 
  ExerciseCardSkeleton 
} from "./DashboardSkeletons";

interface OverviewTabProps {
  userId: string;
  todayProgress: number;
  doseCap: any;
  redFlags: any[];
  clinicalProfile: ClinicalProfile | null;
  exercises: any[];
  recommendations: any[];
  recommendedExercises: any[];
  lesson: DailyLesson | null;
  checkExerciseAccess: (id: string) => any;
  getAdaptations: (id: string) => any;
  hasAssessment: boolean;
  hasSoftOverride: boolean;
  onStartAssessment: () => void;
}

export function OverviewTab({
  userId,
  todayProgress,
  doseCap,
  redFlags,
  clinicalProfile,
  recommendations,
  recommendedExercises,
  lesson,
  checkExerciseAccess,
  getAdaptations,
  hasAssessment,
  hasSoftOverride,
  onStartAssessment
}: OverviewTabProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Progressive loading states
  const [showProgress, setShowProgress] = useState(false);
  const [showRecoveryIntel, setShowRecoveryIntel] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showExercises, setShowExercises] = useState(false);

  useEffect(() => {
    // Phase 1: Critical content (immediate)
    setShowProgress(true);
    
    // Phase 2: AI summaries (300ms delay)
    const timer1 = setTimeout(() => setShowRecoveryIntel(true), 300);
    
    // Phase 3: Plan (600ms delay)
    const timer2 = setTimeout(() => setShowPlan(true), 600);
    
    // Phase 4: Exercises (900ms delay)
    const timer3 = setTimeout(() => setShowExercises(true), 900);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Red Flag Alerts */}
      {redFlags.length > 0 && (
        <RedFlagAlerts flags={redFlags} />
      )}

      {/* Dose Cap Warning */}
      {doseCap.warningLevel !== 'safe' && doseCap.warningLevel !== 'limit' && doseCap.enforceCaps && (
        <Card className="p-6 border-primary/50 bg-primary/5">
          <h3 className="font-semibold mb-2">Practice Progress Today</h3>
          <p className="text-sm text-muted-foreground mb-3">
            You've practiced for {doseCap.todayMinutes} minutes today. 
            {doseCap.minutesRemaining > 0 
              ? ` About ${doseCap.minutesRemaining} minutes remaining before your daily goal.`
              : ' Great work reaching your goal!'
            }
          </p>
          <Progress value={(doseCap.todayMinutes / doseCap.dailyCapMinutes) * 100} className="h-2" />
        </Card>
      )}

      {/* Today's Progress */}
      {!showProgress ? (
        <ProgressCardSkeleton />
      ) : (
        <Card className="p-6 shadow-card animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Today's Progress</h2>
            <span className="text-sm font-medium text-primary">{todayProgress}%</span>
          </div>
          <Progress value={todayProgress} className="h-3 mb-2" />
          <p className="text-sm text-muted-foreground">
            Goal: 20 minutes of therapy • {Math.round((todayProgress / 100) * 20)} min completed
          </p>
        </Card>
      )}

      {/* AI Recovery Intelligence */}
      {!showRecoveryIntel ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">Recovery Intelligence</h2>
            <Badge variant="secondary" className="gap-1">
              <Lightbulb className="w-3 h-3" />
              AI-Powered
            </Badge>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <RecoverySummarySkeleton delay={0} />
            <RecoverySummarySkeleton delay={100} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2 animate-fade-in">
            <h2 className="text-2xl font-semibold">Recovery Intelligence</h2>
            <Badge variant="secondary" className="gap-1">
              <Lightbulb className="w-3 h-3" />
              AI-Powered
            </Badge>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
              <RecoverySummaryCard
                userId={userId}
                summaryType="progress"
                title="Your Progress Journey"
                description="AI analysis of your recovery trajectory, what's working, and areas of focus"
                autoGenerate={true}
              />
            </div>
            
            <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
              <RecoverySummaryCard
                userId={userId}
                summaryType="education"
                title="Understanding Your Stroke"
                description="Plain-language explanation of your stroke and its effects"
                autoGenerate={true}
              />
            </div>
          </div>

          {clinicalProfile && (
            <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
              <StrokeEducationPanel
                strokeLocation={
                  Array.isArray(clinicalProfile.stroke_location)
                    ? clinicalProfile.stroke_location.join(', ')
                    : clinicalProfile.stroke_location || undefined
                }
                affectedSide={clinicalProfile.affected_side || undefined}
                impairments={clinicalProfile.impairments}
              />
            </div>
          )}
        </div>
      )}

      {/* Today's Personalized Plan */}
      {!showPlan ? (
        <ProgressCardSkeleton delay={0} />
      ) : (
        <div className="animate-fade-in">
          <TodaysPlanCard
            userId={userId}
            clinicalProfile={clinicalProfile}
            onStartAssessment={onStartAssessment}
          />
        </div>
      )}

      {/* Recommended Exercises */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl md:text-2xl font-semibold">
            {clinicalProfile ? 'Recommended Exercises' : "Today's Exercises"}
          </h2>
          {clinicalProfile && (
            <Badge variant="secondary" className="gap-1">
              <Brain className="w-3 h-3" />
              Personalized
            </Badge>
          )}
        </div>
        
        {showExercises && (
          <div className="animate-fade-in mb-4">
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
          <div className="animate-fade-in">
            <ExerciseCarousel
              exercises={recommendedExercises}
              onStartExercise={(slug) => navigate(`/exercise/${slug}`)}
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
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 animate-fade-in">
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
                onClick={() => !isLocked && navigate(`/exercise/${exercise.id}`)}
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
      </div>
    </div>
  );
}
