import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Exercise from "./pages/Exercise";
import SemanticFeatureExercise from "./pages/SemanticFeatureExercise";
import PhonologicalExercise from "./pages/PhonologicalExercise";
import SentenceConstructionExercise from "./pages/SentenceConstructionExercise";
import PhonemeAnalytics from "./pages/PhonemeAnalytics";
import SessionHistory from "./pages/SessionHistory";
import SemanticAnalytics from "./pages/SemanticAnalytics";
import GrammarAnalytics from "./pages/GrammarAnalytics";
import PronunciationAnalytics from "./pages/PronunciationAnalytics";
import SpeechTrendsAnalytics from "./pages/SpeechTrendsAnalytics";
import Caregiver from "./pages/Caregiver";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
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
import NotFound from "./pages/NotFound";
import { UiModeProvider } from "@/contexts/UiModeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AssessmentProvider } from "@/contexts/AssessmentContext";
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
          <ProfileProvider>
            <AssessmentProviderWrapper>
              <BrowserRouter>
          <Toaster />
          <Sonner />
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/exercise/:exerciseId" element={<Exercise />} />
          <Route path="/exercise/semantic-features" element={<SemanticFeatureExercise />} />
          <Route path="/exercise/phonological-awareness" element={<PhonologicalExercise />} />
          <Route path="/exercise/sentence-construction" element={<SentenceConstructionExercise />} />
          <Route path="/analytics/phoneme" element={<PhonemeAnalytics />} />
          <Route path="/history" element={<SessionHistory />} />
          <Route path="/analytics/semantic" element={<SemanticAnalytics />} />
          <Route path="/analytics/grammar" element={<GrammarAnalytics />} />
          <Route path="/analytics/pronunciation" element={<PronunciationAnalytics />} />
          <Route path="/analytics/speech-trends" element={<SpeechTrendsAnalytics />} />
          <Route path="/caregiver" element={<Caregiver />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/analytics" element={<ParserAnalytics />} />
          <Route path="/admin/research-export" element={<ResearchExport />} />
          <Route path="/analytics/cluster" element={<ClusterAnalytics />} />
          <Route path="/settings/privacy" element={<PrivacySettings />} />
          <Route path="/history" element={<History />} />
          <Route path="/photo-library" element={<PhotoLibrary />} />
          <Route path="/exercise/photo-naming" element={<PhotoNamingExercise />} />
          <Route path="/clinical-documents" element={<ClinicalDocuments />} />
          <Route path="/profile-history" element={<ProfileVersionHistory />} />
          <Route path="/lesson" element={<Lesson />} />
          <Route path="/exercise/pattern-match" element={<PatternMatchExercise />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
              </BrowserRouter>
            </AssessmentProviderWrapper>
          </ProfileProvider>
        </UiModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
