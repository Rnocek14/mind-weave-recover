import { useLocation, Navigate } from "react-router-dom";
import { LessonFlow } from "@/components/LessonFlow";
import { useStrugglingWords } from "@/hooks/useStrugglingWords";
import { useAuth } from "@/hooks/useAuth";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import type { TodayFocus } from "@/lib/adaptiveDecisionEngine";

const Lesson = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  // Try to get lesson from location.state first
  let lesson = location.state?.lesson as DailyLesson | undefined;
  let clinicalProfile = location.state?.clinicalProfile as ClinicalProfile | null;
  let todayFocus = location.state?.todayFocus as TodayFocus | null;

  // If not in location.state, try sessionStorage (returning from exercise)
  if (!lesson) {
    const savedState = sessionStorage.getItem('lessonFlowState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        lesson = parsed.lesson;
        clinicalProfile = parsed.clinicalProfile || null;
        todayFocus = parsed.todayFocus || null;
      } catch (e) {
        console.error('[Lesson] Failed to parse saved state:', e);
      }
    }
  }

  // Get struggling words for injection
  const { focusWords } = useStrugglingWords({ userId: user?.id });

  // Only redirect if both sources have no lesson
  if (!lesson) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <LessonFlow 
      lesson={lesson} 
      clinicalProfile={clinicalProfile}
      todayFocus={todayFocus}
      focusWords={focusWords}
    />
  );
};

export default Lesson;
