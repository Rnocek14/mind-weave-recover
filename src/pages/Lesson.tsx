import { useLocation, Navigate } from "react-router-dom";
import { LessonFlow } from "@/components/LessonFlow";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";

const Lesson = () => {
  const location = useLocation();
  
  // Try to get lesson from location.state first
  let lesson = location.state?.lesson as DailyLesson | undefined;
  let clinicalProfile = location.state?.clinicalProfile as ClinicalProfile | null;

  // If not in location.state, try sessionStorage (returning from exercise)
  if (!lesson) {
    const savedState = sessionStorage.getItem('lessonFlowState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        lesson = parsed.lesson;
        clinicalProfile = parsed.clinicalProfile || null;
      } catch (e) {
        console.error('[Lesson] Failed to parse saved state:', e);
      }
    }
  }

  // Only redirect if both sources have no lesson
  if (!lesson) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LessonFlow lesson={lesson} clinicalProfile={clinicalProfile} />;
};

export default Lesson;
