import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Volume2, List, Trophy, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { LearningRateCard } from "@/components/LearningRateCard";
import { FunctionalGoalsWidget } from "@/components/FunctionalGoalsWidget";
import { GoalLearningCorrelationCard } from "@/components/GoalLearningCorrelationCard";
import { AssessmentTrendsCard } from "@/components/AssessmentTrendsCard";
import { CapabilityProfileCard } from "@/components/CapabilityProfileCard";
import { ClinicianCapabilityCard } from "@/components/ClinicianCapabilityCard";
import { ExerciseProgressCard } from "@/components/ExerciseProgressCard";
import { ExerciseStatsTile } from "@/components/ExerciseStatsTile";
import type { AssessmentResult } from "@/lib/capabilityAssessor";

interface AnalyticsTabProps {
  userId: string;
  streak: number;
  clinicalProfile: ClinicalProfile | null;
  learningRates: any[];
  clusterComparisons: any[];
  learningRatesLoading: boolean;
  currentAssessment: AssessmentResult | null;
  previousAssessment: AssessmentResult | null;
  onStartAssessment: () => void;
  recentAchievements: any[];
}

export function AnalyticsTab({
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
}: AnalyticsTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Session Adherence Tracker */}
      <SessionAdherenceTracker userId={userId} currentStreak={streak} />

      {/* Learning Rate Intelligence */}
      {!learningRatesLoading && learningRates.length > 0 && (
        <div>
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
      )}

      {/* Capability Profile Assessment */}
      <div className="grid gap-4 md:grid-cols-2">
        <CapabilityProfileCard
          userId={userId}
          currentAssessment={currentAssessment}
          previousAssessment={previousAssessment}
          onStartAssessment={onStartAssessment}
        />
        
        <ClinicianCapabilityCard
          userId={userId}
          clinicalProfile={clinicalProfile}
        />
      </div>

      {/* Functional Goals */}
      <div className="grid md:grid-cols-2 gap-4">
        <FunctionalGoalsWidget userId={userId} />
        <GoalLearningCorrelationCard userId={userId} />
      </div>

      {/* Standardized Assessments */}
      <AssessmentTrendsCard userId={userId} />

      {/* Language Recovery Progress */}
      <div>
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

      {/* Motor Performance */}
      <div>
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

      {/* Recent Achievements */}
      <Card className="p-6 shadow-card">
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
    </div>
  );
}
