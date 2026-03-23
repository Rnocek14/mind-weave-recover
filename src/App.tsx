import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import About from "./pages/About";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Exercise from "./pages/Exercise";
import SemanticFeatureExercise from "./pages/SemanticFeatureExercise";
import PhonologicalExercise from "./pages/PhonologicalExercise";
import SentenceConstructionExercise from "./pages/SentenceConstructionExercise";
import SessionHistory from "./pages/SessionHistory";
import CaregiverPortal from "./pages/CaregiverPortal";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import AdminPipeline from "./pages/AdminPipeline";
import ParserAnalytics from "./pages/ParserAnalytics";
import PrivacySettings from "./pages/PrivacySettings";
import History from "./pages/History";
import ResearchExport from "./pages/ResearchExport";
import ClusterAnalytics from "./pages/ClusterAnalytics";
import PhotoLibrary from "./pages/PhotoLibrary";
import PhotoNamingExercise from "./pages/PhotoNamingExercise";
import ClinicalDocuments from "./pages/ClinicalDocuments";
import ProfileVersionHistory from "./pages/ProfileVersionHistory";
import Lesson from "./pages/Lesson";
import PatternMatchExercise from "./pages/PatternMatchExercise";
import Insights from "./pages/Insights";
import ClinicianReport from "./pages/ClinicianReport";
import MinimalPairsExercise from "./pages/MinimalPairsExercise";
import ClinicianPanel from "./pages/ClinicianPanel";
import WeeklyPatientReview from "./pages/WeeklyPatientReview";

import ConversationPartnerExercise from "./pages/ConversationPartnerExercise";
import ConversationCoachExercise from "./pages/ConversationCoachExercise";
import TwoCluesExercise from "./pages/TwoCluesExercise";
import ThoughtContinuationExercise from "./pages/ThoughtContinuationExercise";
import FixSentenceExercise from "./pages/FixSentenceExercise";
import DescribeGuessExercise from "./pages/DescribeGuessExercise";
import DetectiveMindExercise from "./pages/DetectiveMindExercise";
import MeaningMatchExercise from "./pages/MeaningMatchExercise";
import NarrativeRetellExercise from "./pages/NarrativeRetellExercise";
import AbstractCompareExercise from "./pages/AbstractCompareExercise";
import MultiStepPlanExercise from "./pages/MultiStepPlanExercise";
import DualLoadNamingExercise from "./pages/DualLoadNamingExercise";
import SpeechProfile from "./pages/SpeechProfile";
import NotFound from "./pages/NotFound";
import { UiModeProvider } from "@/contexts/UiModeContext";
import { HelpModeProvider } from "@/contexts/HelpModeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AssessmentProvider } from "@/contexts/AssessmentContext";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

const queryClient = new QueryClient();

// Wrapper component to access auth and profile context
function AssessmentProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  
  return (
    <AssessmentProvider userId={user?.id} profileId={activeProfile?.id}>
      {children}
    </AssessmentProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <UiModeProvider>
        <HelpModeProvider>
          <ProfileProvider>
            <AssessmentProviderWrapper>
              <BrowserRouter>
                <Toaster />
                <Sonner />
                <Routes>
                  {/* Public routes - no header */}
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/about" element={<About />} />
                  
                  {/* Exercise routes - no header for immersive experience */}
                  <Route path="/exercise/:exerciseId" element={<Exercise />} />
                  <Route path="/exercise/semantic-features" element={<SemanticFeatureExercise />} />
                  <Route path="/exercise/phonological-awareness" element={<PhonologicalExercise />} />
                  <Route path="/exercise/sentence-construction" element={<SentenceConstructionExercise />} />
                  <Route path="/exercise/photo-naming" element={<PhotoNamingExercise />} />
                  <Route path="/exercise/pattern-match" element={<PatternMatchExercise />} />
                  <Route path="/exercise/minimal-pairs" element={<MinimalPairsExercise />} />
                  <Route path="/exercise/conversation-partner" element={<ConversationPartnerExercise />} />
                  <Route path="/exercise/conversation-coach" element={<ConversationCoachExercise />} />
                  <Route path="/exercise/two-clues" element={<TwoCluesExercise />} />
                  <Route path="/exercise/thought-continuation" element={<ThoughtContinuationExercise />} />
                  <Route path="/exercise/fix-sentence" element={<FixSentenceExercise />} />
                  <Route path="/exercise/describe-guess" element={<DescribeGuessExercise />} />
                  <Route path="/exercise/detective-mind" element={<DetectiveMindExercise />} />
                  <Route path="/exercise/meaning-match" element={<MeaningMatchExercise />} />
                  <Route path="/exercise/narrative-retell" element={<NarrativeRetellExercise />} />
                  <Route path="/exercise/abstract-compare" element={<AbstractCompareExercise />} />
                  <Route path="/exercise/multi-step-plan" element={<MultiStepPlanExercise />} />
                  <Route path="/exercise/dual-load-naming" element={<DualLoadNamingExercise />} />
                  <Route path="/lesson" element={<Lesson />} />
                  
                  {/* Main app routes - with persistent header */}
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                  <Route path="/history" element={<AppLayout><History /></AppLayout>} />
                  <Route path="/caregiver" element={<AppLayout><CaregiverPortal /></AppLayout>} />
                  
                  {/* Settings routes - with header */}
                  <Route path="/photo-library" element={<AppLayout><PhotoLibrary /></AppLayout>} />
                  <Route path="/clinical-documents" element={<AppLayout><ClinicalDocuments /></AppLayout>} />
                  <Route path="/settings/privacy" element={<AppLayout><PrivacySettings /></AppLayout>} />
                  <Route path="/profile-history" element={<AppLayout><ProfileVersionHistory /></AppLayout>} />
                  <Route path="/speech-profile" element={<AppLayout><SpeechProfile /></AppLayout>} />
                  
                  {/* Clinician routes - with header */}
                  <Route path="/clinician/caseload" element={<AppLayout><ClinicianPanel /></AppLayout>} />
                  <Route path="/clinician/report" element={<AppLayout><ClinicianReport /></AppLayout>} />
                  
                  {/* Admin routes - with header */}
                  <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
                  <Route path="/admin/pipeline" element={<AppLayout><AdminPipeline /></AppLayout>} />
                  <Route path="/admin/analytics" element={<AppLayout><ParserAnalytics /></AppLayout>} />
                  <Route path="/admin/research-export" element={<AppLayout><ResearchExport /></AppLayout>} />
                  <Route path="/analytics/cluster" element={<AppLayout><ClusterAnalytics /></AppLayout>} />
                  
                  {/* Redirect old routes to canonical routes */}
                  <Route path="/session-history" element={<Navigate to="/history" replace />} />
                  <Route path="/caregiver/photos" element={<Navigate to="/photo-library" replace />} />
                  <Route path="/caregiver/docs" element={<Navigate to="/clinical-documents" replace />} />
                  <Route path="/caregiver/insights" element={<Navigate to="/insights?tab=alerts" replace />} />
                  <Route path="/caregiver/history" element={<Navigate to="/history" replace />} />
                  <Route path="/caregiver/dashboard" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/caregiver/settings" element={<Navigate to="/settings/privacy" replace />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AssessmentProviderWrapper>
          </ProfileProvider>
        </HelpModeProvider>
        </UiModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
