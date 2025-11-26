import { useLocation, Navigate } from "react-router-dom";
import { LessonFlow } from "@/components/LessonFlow";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import type { ClinicalProfile } from "@/lib/clinicalProfileMapper";

const Lesson = () => {
  const location = useLocation();
  const lesson = location.state?.lesson as DailyLesson | undefined;
  const clinicalProfile = location.state?.clinicalProfile as ClinicalProfile | null;

  if (!lesson) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LessonFlow lesson={lesson} clinicalProfile={clinicalProfile} />;
};

export default Lesson;
