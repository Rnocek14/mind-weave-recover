import { useState, useEffect, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Volume2, List, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { LearningRateCard } from "@/components/LearningRateCard";
import { FunctionalGoalsWidget } from "@/components/FunctionalGoalsWidget";
import { GoalLearningCorrelationCard } from "@/components/GoalLearningCorrelationCard";
import { AssessmentTrendsCard } from "@/components/AssessmentTrendsCard";
import { CapabilityProfileCard } from "@/components/CapabilityProfileCard";
import { ClinicianCapabilityCard } from "@/components/ClinicianCapabilityCard";
import { ExerciseProgressCard } from "@/components/ExerciseProgressCard";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import { useDashboardContext } from "@/hooks/useDashboardContext";
import { AnalyticsCardSkeleton } from "./DashboardSkeletons";

export const AnalyticsTab = memo(function AnalyticsTab() {
  const {
    userId,
    streak,
    clinicalProfile,
    learningRates,
    clusterComparisons,
    learningRatesLoading,
    currentAssessment,
    previousAssessment,
    onStartAssessment,
    recentAchievements
  } = useDashboardContext();
  const navigate = useNavigate();
  
  // Progressive loading states
  const [showAdherence, setShowAdherence] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [showCapability, setShowCapability] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showExercises, setShowExercises] = useState(false);

  useEffect(() => {
    // Phase 1: Adherence (immediate)
    setShowAdherence(true);
    
    // Phase 2: Learning rates (300ms delay)
    const timer1 = setTimeout(() => setShowLearning(true), 300);
    
    // Phase 3: Capability (600ms delay)
    const timer2 = setTimeout(() => setShowCapability(true), 600);
    
    // Phase 4: Goals & Exercises (900ms delay)
    const timer3 = setTimeout(() => {
      setShowGoals(true);
      setShowExercises(true);
    }, 900);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Session Adherence Tracker */}
      {!showAdherence ? (
        <AnalyticsCardSkeleton delay={0} />
      ) : (
        <div className="animate-fade-in">
          <SessionAdherenceTracker userId={userId} currentStreak={streak} />
        </div>
      )}

      {/* Learning Rate Intelligence */}
      {!showLearning ? (
        <AnalyticsCardSkeleton delay={0} />
      ) : !learningRatesLoading && learningRates.length > 0 ? (
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <LearningRateCard 
            learningRates={learningRates}
            clusterComparisons={clusterComparisons}
            timeWindow={14}
          />
          
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => navigate('/analytics/cluster')}
            >
              View Detailed Cluster Analytics
            </Button>
          </div>
        </div>
      ) : null}

      {/* Capability Profile Assessment */}
      {!showCapability ? (
        <div className="grid gap-4 md:grid-cols-2">
          <AnalyticsCardSkeleton delay={0} />
          <AnalyticsCardSkeleton delay={100} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CapabilityProfileCard
              userId={userId}
              currentAssessment={currentAssessment}
              previousAssessment={previousAssessment}
              onStartAssessment={onStartAssessment}
            />
          </div>
          
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <ClinicianCapabilityCard
              userId={userId}
              clinicalProfile={clinicalProfile}
            />
          </div>
        </div>
      )}

      {/* Functional Goals */}
      {!showGoals ? (
        <div className="grid md:grid-cols-2 gap-4">
          <AnalyticsCardSkeleton delay={0} />
          <AnalyticsCardSkeleton delay={100} />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <FunctionalGoalsWidget userId={userId} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <GoalLearningCorrelationCard userId={userId} />
          </div>
        </div>
      )}

      {/* Standardized Assessments */}
      {!showGoals ? (
        <AnalyticsCardSkeleton delay={0} />
      ) : (
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <AssessmentTrendsCard userId={userId} />
        </div>
      )}

      {/* Language Recovery Progress */}
      {!showExercises ? (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Language Recovery Progress</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <AnalyticsCardSkeleton delay={0} />
            <AnalyticsCardSkeleton delay={100} />
            <AnalyticsCardSkeleton delay={200} />
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <h2 className="text-2xl font-semibold mb-4">Language Recovery Progress</h2>
          <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <ExerciseProgressCard
              userId={userId}
              exerciseSlug="semantic-features"
              exerciseTitle="Semantic Feature Analysis"
              exerciseIcon={Lightbulb}
              targets="word-finding, semantic errors"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/analytics/semantic")}
              className="w-full"
            >
              View Detailed Analytics
            </Button>
          </div>
          <div className="space-y-2">
            <ExerciseProgressCard
              userId={userId}
              exerciseSlug="phonological-awareness"
              exerciseTitle="Phonological Awareness"
              exerciseIcon={Volume2}
              targets="phonemic paraphasias, sound discrimination"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/analytics/phoneme")}
              className="w-full"
            >
              View Detailed Analytics
            </Button>
          </div>
          <div className="space-y-2">
            <ExerciseProgressCard
              userId={userId}
              exerciseSlug="sentence-construction"
              exerciseTitle="Sentence Construction"
              exerciseIcon={List}
              targets="syntax, grammar, word order"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/analytics/grammar")}
              className="w-full"
            >
              View Detailed Analytics
            </Button>
          </div>
        </div>
        </div>
      )}

      {/* Motor Performance */}
      {!showExercises ? (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Motor Performance</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <AnalyticsCardSkeleton delay={0} />
            <AnalyticsCardSkeleton delay={100} />
          </div>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-2xl font-semibold mb-4">Motor Performance</h2>
          <div className="grid md:grid-cols-2 gap-4">
          <ExerciseStatsTile
            userId={userId}
            exerciseSlug="photo-naming"
            exerciseTitle="Photo Naming"
          />
          <ExerciseStatsTile
            userId={userId}
            exerciseSlug="reach-tap"
            exerciseTitle="Reach & Tap"
          />
        </div>
        </div>
      )}

      {/* Recent Achievements */}
      {!showExercises ? (
        <AnalyticsCardSkeleton delay={0} />
      ) : (
        <Card className="p-6 shadow-card animate-fade-in" style={{ animationDelay: '200ms' }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Achievements</h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/history")}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            View History
          </Button>
        </div>
        <div className="space-y-3">
          {recentAchievements.map((achievement, i) => {
            const Icon = achievement.icon;
            return (
              <div 
                key={i} 
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-smooth"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-celebrate flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{achievement.label}</div>
                  <div className="text-sm text-muted-foreground">{achievement.date}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      )}
    </div>
  );
});
