import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Caregiver from "./pages/Caregiver";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import ParserAnalytics from "./pages/ParserAnalytics";
import PrivacySettings from "./pages/PrivacySettings";
import History from "./pages/History";
import ResearchExport from "./pages/ResearchExport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/caregiver" element={<Caregiver />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/analytics" element={<ParserAnalytics />} />
          <Route path="/admin/research-export" element={<ResearchExport />} />
          <Route path="/settings/privacy" element={<PrivacySettings />} />
          <Route path="/history" element={<History />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
