import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import Today from "./pages/Today";
import About from "./pages/About";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Exercise from "./pages/Exercise";
import SemanticFeatureExercise from "./pages/SemanticFeatureExercise";
import PhonologicalExercise from "./pages/PhonologicalExercise";
import SentenceConstructionExercise from "./pages/SentenceConstructionExercise";
import SessionHistory from "./pages/SessionHistory";
import CaregiverPortal from "./pages/CaregiverPortal";
import CaregiverStatus from "./pages/CaregiverStatus";
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
import PatientHub from "./pages/PatientHub";
import OutcomesValidation from "./pages/OutcomesValidation";
import RecoveryProgress from "./pages/RecoveryProgress";
import Progress from "./pages/Progress";
import AdminEngineSimulation from "./pages/AdminEngineSimulation";
import AdminAlertRollup from "./pages/AdminAlertRollup";
import AdminOverrideAudit from "./pages/AdminOverrideAudit";
import AdminAdaptationStream from "./pages/AdminAdaptationStream";
import AdminSuccessBand from "./pages/AdminSuccessBand";
import AdminVoiceAnalytics from "./pages/AdminVoiceAnalytics";
import AdminTelemetryAnomalies from "./pages/AdminTelemetryAnomalies";
import AdminTelemetryAnomalySession from "./pages/AdminTelemetryAnomalySession";
import RecoveryScoreDetail from "./pages/RecoveryScoreDetail";
import SmartCoachLab from "./pages/SmartCoachLab";
import CohortResearchAnalytics from "./pages/CohortResearchAnalytics";
import SmartCoach from "./pages/SmartCoach";
import Practice from "./pages/Practice";
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
import CategoryFluencyExercise from "./pages/CategoryFluencyExercise";
import SynonymGeneratorExercise from "./pages/SynonymGeneratorExercise";
import VoicePractice from "./pages/VoicePractice";
import SpeechProfile from "./pages/SpeechProfile";
import ShadowAnalytics from "./pages/ShadowAnalytics";
import ClinicianTelemetry from "./pages/ClinicianTelemetry";
import NotFound from "./pages/NotFound";
import AdaptationSimDev from "./pages/dev/AdaptationSimDev";
import SessionReplayDev from "./pages/dev/SessionReplayDev";
import AdaptationSignalHarness from "./pages/dev/AdaptationSignalHarness";
import GateHarness from "./pages/dev/GateHarness";
import MasteryShadowDev from "./pages/dev/MasteryShadowDev";
import MasteryAuditDev from "./pages/dev/MasteryAuditDev";
import LevelingContractDev from "./pages/dev/LevelingContractDev";
import { VoiceGateHud } from "./components/dev/VoiceGateHud";
import ClinicianTrialDashboard from "./pages/clinician/ClinicianTrialDashboard";
import ClinicianTrialEnroll from "./pages/clinician/ClinicianTrialEnroll";
import { UiModeProvider } from "@/contexts/UiModeContext";
import { HelpModeProvider } from "@/contexts/HelpModeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AssessmentProvider } from "@/contexts/AssessmentContext";
import { CoachingModeProvider } from "@/contexts/CoachingModeContext";
import { AppLayout } from "@/components/layout";
import { VoiceBleedGuard } from "@/components/VoiceBleedGuard";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { ClinicianProtectedRoute } from "@/components/ClinicianProtectedRoute";
import { MayaSessionOverlay } from "@/components/coach/MayaSessionOverlay";
import { SessionPauseControl } from "@/components/SessionPauseControl";
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
          <CoachingModeProvider>
          <ProfileProvider>
            <AssessmentProviderWrapper>
              <BrowserRouter>
                <VoiceBleedGuard />
                <Toaster />
                <Sonner />
                <MayaSessionOverlay />
                <SessionPauseControl />
                <VoiceGateHud />
                <Routes>
                  {/* Public routes - no header */}
                  <Route path="/" element={<Index />} />
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/today" element={<Today />} />
                  <Route path="/practice" element={<Practice />} />
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
                  <Route path="/exercise/category-fluency" element={<CategoryFluencyExercise />} />
                  <Route path="/exercise/synonym-generator" element={<SynonymGeneratorExercise />} />
                  <Route path="/exercise/voice-practice" element={<VoicePractice />} />
                  <Route path="/lesson" element={<Lesson />} />

                  {/* Dev-only validation harness — admin-gated */}
                  <Route path="/dev/adaptation-sim" element={<AdminProtectedRoute><AdaptationSimDev /></AdminProtectedRoute>} />
                  <Route path="/dev/session-replay" element={<AdminProtectedRoute><SessionReplayDev /></AdminProtectedRoute>} />
                  <Route path="/dev/session-replay/:sessionId" element={<AdminProtectedRoute><SessionReplayDev /></AdminProtectedRoute>} />
                  <Route path="/dev/signal-harness" element={<AdminProtectedRoute><AdaptationSignalHarness /></AdminProtectedRoute>} />
                  <Route path="/dev/gate-harness" element={<AdminProtectedRoute><GateHarness /></AdminProtectedRoute>} />
                  <Route path="/dev/mastery-shadow" element={<AdminProtectedRoute><MasteryShadowDev /></AdminProtectedRoute>} />
                  <Route path="/dev/mastery-audit" element={<AdminProtectedRoute><MasteryAuditDev /></AdminProtectedRoute>} />
                  <Route path="/dev/leveling-contract" element={<AdminProtectedRoute><LevelingContractDev /></AdminProtectedRoute>} />

                  {/* Main app routes - with persistent header */}
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                  <Route path="/history" element={<AppLayout><History /></AppLayout>} />
                  <Route path="/caregiver" element={<AppLayout><CaregiverPortal /></AppLayout>} />
                  <Route path="/caregiver/status" element={<AppLayout><CaregiverPortal /></AppLayout>} />
                  
                  {/* Settings routes - with header */}
                  <Route path="/photo-library" element={<AppLayout><PhotoLibrary /></AppLayout>} />
                  <Route path="/clinical-documents" element={<AppLayout><ClinicalDocuments /></AppLayout>} />
                  <Route path="/settings/privacy" element={<AppLayout><PrivacySettings /></AppLayout>} />
                  <Route path="/profile-history" element={<AppLayout><ProfileVersionHistory /></AppLayout>} />
                  <Route path="/speech-profile" element={<AppLayout><SpeechProfile /></AppLayout>} />
                  
                  {/* Clinician routes - with header */}
                  <Route path="/clinician/caseload" element={<AppLayout><ClinicianPanel /></AppLayout>} />
                  <Route path="/clinician/dashboard" element={<AppLayout><ClinicianPanel /></AppLayout>} />
                  <Route path="/clinician/review" element={<AppLayout><PatientHub /></AppLayout>} />
                  <Route path="/clinician/report" element={<Navigate to="/clinician/review" replace />} />
                  <Route path="/clinician/telemetry" element={<AppLayout><AdminProtectedRoute><ClinicianTelemetry /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/clinician/trial" element={<AppLayout><ClinicianProtectedRoute><ClinicianTrialDashboard /></ClinicianProtectedRoute></AppLayout>} />
                  <Route path="/clinician/trial/enroll/:profileId" element={<AppLayout><ClinicianProtectedRoute><ClinicianTrialEnroll /></ClinicianProtectedRoute></AppLayout>} />
                  
                  {/* Admin routes - with header */}
                  <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
                  <Route path="/admin/pipeline" element={<AppLayout><AdminProtectedRoute><AdminPipeline /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/analytics" element={<AppLayout><AdminProtectedRoute><ParserAnalytics /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/research-export" element={<AppLayout><AdminProtectedRoute><ResearchExport /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/analytics/cluster" element={<AppLayout><AdminProtectedRoute><ClusterAnalytics /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/outcomes-validation" element={<AppLayout><AdminProtectedRoute><OutcomesValidation /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/engine-simulation" element={<AppLayout><AdminProtectedRoute><AdminEngineSimulation /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/alerts" element={<AppLayout><AdminProtectedRoute><AdminAlertRollup /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/overrides" element={<AppLayout><AdminProtectedRoute><AdminOverrideAudit /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/adaptations" element={<AppLayout><AdminProtectedRoute><AdminAdaptationStream /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/success-band" element={<AppLayout><AdminProtectedRoute><AdminSuccessBand /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/voice-analytics" element={<AppLayout><AdminProtectedRoute><AdminVoiceAnalytics /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/telemetry-anomalies" element={<AppLayout><AdminProtectedRoute><AdminTelemetryAnomalies /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/telemetry-anomalies/session/:sessionId" element={<AppLayout><AdminProtectedRoute><AdminTelemetryAnomalySession /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/cohort-research" element={<AppLayout><AdminProtectedRoute><CohortResearchAnalytics /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/shadow-analytics" element={<AppLayout><AdminProtectedRoute><ShadowAnalytics /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/recovery-progress" element={<AppLayout><RecoveryProgress /></AppLayout>} />
                  <Route path="/recovery-score" element={<AppLayout><RecoveryScoreDetail /></AppLayout>} />
                  <Route path="/smart-coach-lab" element={<AdminProtectedRoute><SmartCoachLab /></AdminProtectedRoute>} />
                  <Route path="/smart-coach" element={<Navigate to="/today" replace />} />
                  
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
          </CoachingModeProvider>
        </HelpModeProvider>
        </UiModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
