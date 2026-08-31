import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Suspense, lazy, useContext } from "react";
import { Loader2 } from "lucide-react";
import { UiVariantPicker } from "@/components/dev/UiVariantPicker";
import { ViewToggle } from "@/components/ViewToggle";
import { OnboardingGate } from "@/components/OnboardingGate";
import { VoiceGateHud } from "./components/dev/VoiceGateHud";

// Eager: the screens on the critical first-paint paths (landing, auth,
// first-run, patient home). Everything else is route-split — before this,
// every admin dashboard and dev harness shipped in one ~5MB chunk to every
// patient on a tablet connection.
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import Today from "./pages/Today";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const About = lazy(() => import("./pages/About"));
const FreeAphasiaGames = lazy(() => import("./pages/FreeAphasiaGames"));
const AphasiaSentenceExercises = lazy(() => import("./pages/AphasiaSentenceExercises"));
const FreeAphasiaWorksheets = lazy(() => import("./pages/FreeAphasiaWorksheets"));
const WorksheetsPrint = lazy(() => import("./pages/WorksheetsPrint"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const RoleOnboarding = lazy(() => import("./pages/RoleOnboarding"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Exercise = lazy(() => import("./pages/Exercise"));
const SemanticFeatureExercise = lazy(() => import("./pages/SemanticFeatureExercise"));
const PhonologicalExercise = lazy(() => import("./pages/PhonologicalExercise"));
const SentenceConstructionExercise = lazy(() => import("./pages/SentenceConstructionExercise"));
const CaregiverPortal = lazy(() => import("./pages/CaregiverPortal"));
const CaregiverSetup = lazy(() => import("./pages/CaregiverSetup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminPipeline = lazy(() => import("./pages/AdminPipeline"));
const ParserAnalytics = lazy(() => import("./pages/ParserAnalytics"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const History = lazy(() => import("./pages/History"));
const ResearchExport = lazy(() => import("./pages/ResearchExport"));
const PhotoLibrary = lazy(() => import("./pages/PhotoLibrary"));
const PhotoNamingExercise = lazy(() => import("./pages/PhotoNamingExercise"));
const FeedTheMonsterExercise = lazy(() => import("./pages/FeedTheMonsterExercise"));
const ReviewChatPage = lazy(() => import("./pages/ReviewChatPage"));
const ClinicalDocuments = lazy(() => import("./pages/ClinicalDocuments"));
const ProfileVersionHistory = lazy(() => import("./pages/ProfileVersionHistory"));
const Lesson = lazy(() => import("./pages/Lesson"));
const PatternMatchExercise = lazy(() => import("./pages/PatternMatchExercise"));
const FunctionalScenesExercise = lazy(() => import("./pages/FunctionalScenesExercise"));
const Insights = lazy(() => import("./pages/Insights"));
const MinimalPairsExercise = lazy(() => import("./pages/MinimalPairsExercise"));
const ClinicianPanel = lazy(() => import("./pages/ClinicianPanel"));
const PatientHub = lazy(() => import("./pages/PatientHub"));
const OutcomesValidation = lazy(() => import("./pages/OutcomesValidation"));
const RecoveryProgress = lazy(() => import("./pages/RecoveryProgress"));
const Progress = lazy(() => import("./pages/Progress"));
const AdminEngineSimulation = lazy(() => import("./pages/AdminEngineSimulation"));
const AdminAlertRollup = lazy(() => import("./pages/AdminAlertRollup"));
const AdminOverrideAudit = lazy(() => import("./pages/AdminOverrideAudit"));
const AdminAdaptationStream = lazy(() => import("./pages/AdminAdaptationStream"));
const AdminSuccessBand = lazy(() => import("./pages/AdminSuccessBand"));
const AdminVoiceAnalytics = lazy(() => import("./pages/AdminVoiceAnalytics"));
const AdminTelemetryAnomalies = lazy(() => import("./pages/AdminTelemetryAnomalies"));
const AdminTelemetryAnomalySession = lazy(() => import("./pages/AdminTelemetryAnomalySession"));
const RecoveryScoreDetail = lazy(() => import("./pages/RecoveryScoreDetail"));
const SmartCoachLab = lazy(() => import("./pages/SmartCoachLab"));
const CohortResearchAnalytics = lazy(() => import("./pages/CohortResearchAnalytics"));
const Practice = lazy(() => import("./pages/Practice"));
const ConversationPartnerExercise = lazy(() => import("./pages/ConversationPartnerExercise"));
const ConversationCoachExercise = lazy(() => import("./pages/ConversationCoachExercise"));
const TwoCluesExercise = lazy(() => import("./pages/TwoCluesExercise"));
const ThoughtContinuationExercise = lazy(() => import("./pages/ThoughtContinuationExercise"));
const FixSentenceExercise = lazy(() => import("./pages/FixSentenceExercise"));
const DescribeGuessExercise = lazy(() => import("./pages/DescribeGuessExercise"));
const DetectiveMindExercise = lazy(() => import("./pages/DetectiveMindExercise"));
const MeaningMatchExercise = lazy(() => import("./pages/MeaningMatchExercise"));
const NarrativeRetellExercise = lazy(() => import("./pages/NarrativeRetellExercise"));
const AbstractCompareExercise = lazy(() => import("./pages/AbstractCompareExercise"));
const MultiStepPlanExercise = lazy(() => import("./pages/MultiStepPlanExercise"));
const DualLoadNamingExercise = lazy(() => import("./pages/DualLoadNamingExercise"));
const CategoryFluencyExercise = lazy(() => import("./pages/CategoryFluencyExercise"));
const SynonymGeneratorExercise = lazy(() => import("./pages/SynonymGeneratorExercise"));
const VoicePractice = lazy(() => import("./pages/VoicePractice"));
const SpeechProfile = lazy(() => import("./pages/SpeechProfile"));
const ShadowAnalytics = lazy(() => import("./pages/ShadowAnalytics"));
const ClinicianTelemetry = lazy(() => import("./pages/ClinicianTelemetry"));
const AdaptationSimDev = lazy(() => import("./pages/dev/AdaptationSimDev"));
const GameAboutPage = lazy(() => import("./pages/GameAboutPage"));
const ClinicalLibrary = lazy(() => import("./pages/ClinicalLibrary"));
const SessionReplayDev = lazy(() => import("./pages/dev/SessionReplayDev"));
const AdaptationSignalHarness = lazy(() => import("./pages/dev/AdaptationSignalHarness"));
const GateHarness = lazy(() => import("./pages/dev/GateHarness"));
const MasteryShadowDev = lazy(() => import("./pages/dev/MasteryShadowDev"));
const MasteryAuditDev = lazy(() => import("./pages/dev/MasteryAuditDev"));
const MasteryConfidenceSimDev = lazy(() => import("./pages/dev/MasteryConfidenceSimDev"));
const LevelingContractDev = lazy(() => import("./pages/dev/LevelingContractDev"));
const ProgressionStateDev = lazy(() => import("./pages/dev/ProgressionStateDev"));
const QaRunbook = lazy(() => import("./pages/dev/QaRunbook"));
const UiVariantPreview = lazy(() => import("./pages/dev/UiVariantPreview"));
const OnboardingPreviewDev = lazy(() => import("./pages/dev/OnboardingPreviewDev"));
const ClinicianTrialDashboard = lazy(() => import("./pages/clinician/ClinicianTrialDashboard"));
const ClinicianTrialEnroll = lazy(() => import("./pages/clinician/ClinicianTrialEnroll"));

/** Quiet, aphasia-friendly loading state while a route chunk downloads. */
function RouteFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
import { UiModeProvider } from "@/contexts/UiModeContext";
import { HelpModeProvider } from "@/contexts/HelpModeContext";
import { KidsModeProvider } from "@/contexts/KidsModeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ProfileContext } from "@/contexts/profile-context-value";
import { AssessmentProvider } from "@/contexts/AssessmentContext";
import { CoachingModeProvider } from "@/contexts/CoachingModeContext";
import { AppLayout } from "@/components/layout";
import { VoiceBleedGuard } from "@/components/VoiceBleedGuard";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { ClinicianProtectedRoute } from "@/components/ClinicianProtectedRoute";
import { RequireAuth } from "@/components/RequireAuth";
import { MayaSessionOverlay } from "@/components/coach/MayaSessionOverlay";
import { SessionPauseControl } from "@/components/SessionPauseControl";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

// Wrapper component to access auth and profile context
function AssessmentProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const profileContext = useContext(ProfileContext);
  const activeProfile = profileContext?.activeProfile ?? null;
  
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
        <KidsModeProvider>
        <HelpModeProvider>
          <CoachingModeProvider>
          <ProfileProvider>
            <AssessmentProviderWrapper>
              <BrowserRouter>
                <OnboardingGate />
                <VoiceBleedGuard />
                <Toaster />
                <Sonner />
                <MayaSessionOverlay />
                <SessionPauseControl />
                <VoiceGateHud />
                <UiVariantPicker />
                <ViewToggle />
                <Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* Public routes - no header */}
                  <Route path="/" element={<Index />} />
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/today" element={<Today />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/pending-approval" element={<PendingApproval />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/onboarding/role" element={<RoleOnboarding />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/about" element={<About />} />
                  {/* Public SEO landing page — playable demos, no auth */}
                  <Route path="/free-aphasia-games" element={<FreeAphasiaGames />} />
                  <Route path="/aphasia-sentence-exercises" element={<AphasiaSentenceExercises />} />
                  <Route path="/free-aphasia-worksheets" element={<FreeAphasiaWorksheets />} />
                  <Route path="/free-aphasia-worksheets/print" element={<WorksheetsPrint />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  
                  {/* Exercise routes - no header for immersive experience.
                      Guarded by RequireAuth so deep links can't reach a
                      profile-less dead state (CLEAN-2). */}
                  <Route element={<RequireAuth />}>
                    <Route path="/exercise/:exerciseId" element={<Exercise />} />
                    <Route path="/exercise/semantic-features" element={<SemanticFeatureExercise />} />
                    <Route path="/exercise/phonological-awareness" element={<PhonologicalExercise />} />
                    <Route path="/exercise/sentence-construction" element={<SentenceConstructionExercise />} />
                    <Route path="/exercise/photo-naming" element={<PhotoNamingExercise />} />
                    {/* Kids Mode only — the page redirects to /practice in adult mode */}
                    <Route path="/exercise/feed-the-monster" element={<FeedTheMonsterExercise />} />
                    {/* Post-practice transfer conversation (adult + kids) */}
                    <Route path="/review-chat" element={<ReviewChatPage />} />
                    <Route path="/exercise/pattern-match" element={<PatternMatchExercise />} />
                    <Route path="/exercise/functional-scenes" element={<FunctionalScenesExercise />} />
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
                  </Route>
                  <Route path="/lesson" element={<Lesson />} />


                  {/* "How this game supports recovery" — public, deep-linkable */}
                  <Route path="/games" element={<ClinicalLibrary />} />
                  <Route path="/games/:slug/about" element={<GameAboutPage />} />

                  {/* Dev-only validation harness — admin-gated */}
                  <Route path="/dev/adaptation-sim" element={<AdminProtectedRoute><AdaptationSimDev /></AdminProtectedRoute>} />
                  <Route path="/dev/session-replay" element={<AdminProtectedRoute><SessionReplayDev /></AdminProtectedRoute>} />
                  <Route path="/dev/session-replay/:sessionId" element={<AdminProtectedRoute><SessionReplayDev /></AdminProtectedRoute>} />
                  <Route path="/dev/signal-harness" element={<AdminProtectedRoute><AdaptationSignalHarness /></AdminProtectedRoute>} />
                  <Route path="/dev/gate-harness" element={<AdminProtectedRoute><GateHarness /></AdminProtectedRoute>} />
                  <Route path="/dev/mastery-shadow" element={<AdminProtectedRoute><MasteryShadowDev /></AdminProtectedRoute>} />
                  <Route path="/dev/mastery-audit" element={<AdminProtectedRoute><MasteryAuditDev /></AdminProtectedRoute>} />
                  <Route path="/dev/mastery-confidence-sim" element={<AdminProtectedRoute><MasteryConfidenceSimDev /></AdminProtectedRoute>} />
                  <Route path="/dev/leveling-contract" element={<AdminProtectedRoute><LevelingContractDev /></AdminProtectedRoute>} />
                  <Route path="/dev/progression-state" element={<AdminProtectedRoute><ProgressionStateDev /></AdminProtectedRoute>} />
                  <Route path="/dev/qa-runbook" element={<AdminProtectedRoute><QaRunbook /></AdminProtectedRoute>} />
                  <Route path="/dev/ui-variants" element={<AdminProtectedRoute><UiVariantPreview /></AdminProtectedRoute>} />
                  <Route path="/dev/onboarding-preview" element={<AdminProtectedRoute><OnboardingPreviewDev /></AdminProtectedRoute>} />

                  {/* Main app routes - with persistent header */}
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
                  <Route path="/history" element={<AppLayout><History /></AppLayout>} />
                  <Route path="/caregiver/setup" element={<CaregiverSetup />} />
                  <Route path="/caregiver" element={<AppLayout><CaregiverPortal /></AppLayout>} />
                  <Route path="/caregiver/status" element={<AppLayout><CaregiverPortal /></AppLayout>} />
                  
                  {/* Settings routes - with header */}
                  <Route path="/photo-library" element={<AppLayout><PhotoLibrary /></AppLayout>} />
                  <Route path="/clinical-documents" element={<AppLayout><ClinicalDocuments /></AppLayout>} />
                  <Route path="/settings/privacy" element={<AppLayout><PrivacySettings /></AppLayout>} />
                  <Route path="/profile-history" element={<AppLayout><ProfileVersionHistory /></AppLayout>} />
                  <Route path="/speech-profile" element={<AppLayout><SpeechProfile /></AppLayout>} />
                  
                  {/* Clinician routes - with header */}
                  <Route path="/clinician" element={<Navigate to="/clinician/review" replace />} />
                  <Route path="/clinician/caseload" element={<AppLayout><ClinicianProtectedRoute><ClinicianPanel /></ClinicianProtectedRoute></AppLayout>} />
                  <Route path="/clinician/dashboard" element={<AppLayout><ClinicianProtectedRoute><ClinicianPanel /></ClinicianProtectedRoute></AppLayout>} />
                  <Route path="/clinician/review" element={<AppLayout><ClinicianProtectedRoute><PatientHub /></ClinicianProtectedRoute></AppLayout>} />
                  <Route path="/clinician/report" element={<Navigate to="/clinician/review" replace />} />
                  <Route path="/clinician/telemetry" element={<AppLayout><AdminProtectedRoute><ClinicianTelemetry /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/clinician/trial" element={<AppLayout><ClinicianProtectedRoute><ClinicianTrialDashboard /></ClinicianProtectedRoute></AppLayout>} />
                  <Route path="/clinician/trial/enroll/:profileId" element={<AppLayout><ClinicianProtectedRoute><ClinicianTrialEnroll /></ClinicianProtectedRoute></AppLayout>} />
                  
                  {/* Admin routes - with header */}
                  <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
                  <Route path="/admin/pipeline" element={<AppLayout><AdminProtectedRoute><AdminPipeline /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/analytics" element={<AppLayout><AdminProtectedRoute><ParserAnalytics /></AdminProtectedRoute></AppLayout>} />
                  <Route path="/admin/research-export" element={<AppLayout><AdminProtectedRoute><ResearchExport /></AdminProtectedRoute></AppLayout>} />
                  {/* /analytics/cluster removed from routing: useClusterComparison still
                      returns placeholder cohort stats (hardcoded percentile/norms). Restore
                      the route only once real cluster aggregates ship. */}
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
                  <Route path="/caregiver/dashboard" element={<Navigate to="/caregiver" replace />} />
                  <Route path="/caregiver/settings" element={<Navigate to="/settings/privacy" replace />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </BrowserRouter>
            </AssessmentProviderWrapper>
          </ProfileProvider>
          </CoachingModeProvider>
        </HelpModeProvider>
        </KidsModeProvider>
        </UiModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
