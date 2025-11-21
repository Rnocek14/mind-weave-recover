import { createContext, ReactNode } from "react";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import type { AssessmentResult } from "@/lib/capabilityAssessor";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { Exercise } from "@/data/exercises";

export interface DashboardContextValue {
  // User
  userId: string;
  
  // Stats
  streak: number;
  totalReps: number;
  achievementCount: number;
  todayProgress: number;
  
  // Clinical
  clinicalProfile: ClinicalProfile | null;
  
  // Exercises
  exercises: Exercise[];
  recommendations: any[];
  recommendedExercises: Exercise[];
  
  // Gating & Access
  checkExerciseAccess: (id: string) => any;
  getAdaptations: (id: string) => any;
  hasAssessment: boolean;
  hasSoftOverride: boolean;
  
  // Lesson
  lesson: DailyLesson | null;
  
  // Flags & Caps
  redFlags: any[];
  doseCap: any;
  
  // Learning Rates
  learningRates: any[];
  clusterComparisons: any[];
  learningRatesLoading: boolean;
  
  // Assessments
  currentAssessment: AssessmentResult | null;
  previousAssessment: AssessmentResult | null;
  
  // Actions
  onStartAssessment: () => void;
  
  // Recent Achievements
  recentAchievements: any[];
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

interface DashboardProviderProps {
  children: ReactNode;
  value: DashboardContextValue;
}

export function DashboardProvider({ children, value }: DashboardProviderProps) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
