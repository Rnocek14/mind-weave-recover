import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, LogOut, Loader2, AlertCircle, Gamepad2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { useAssessmentContext } from "@/contexts/AssessmentContext";
import { useUiMode } from "@/hooks/useUiMode";
import { UiModeToggle } from "@/components/UiModeToggle";
import { toast } from "sonner";

interface PatientModeViewProps {
  userId: string;
  profileId: string;
  clinicalProfile: ClinicalProfile | null;
  onStartAssessment?: () => void;
}

// Explicit state machine for patient view
type PatientViewState = 'loading' | 'needs-assessment' | 'generating-lesson' | 'ready';

// Patient-friendly game info with emojis and simple descriptions
const PATIENT_GAME_INFO: Record<string, { emoji: string; name: string; desc: string }> = {
  'photo-naming': { emoji: '🖼️', name: 'Picture Naming', desc: 'Say the word for each picture' },
  'reach-tap': { emoji: '🎯', name: 'Tap Targets', desc: 'Tap the circles as they appear' },
  'left-side-hunt': { emoji: '⭐', name: 'Star Hunt', desc: 'Find stars on the left side' },
  'pattern-match': { emoji: '🧩', name: 'Match Patterns', desc: 'Remember and match shapes' },
  'phonological': { emoji: '🔤', name: 'Sound Games', desc: 'Practice word sounds' },
  'semantic-features': { emoji: '🏷️', name: 'Word Features', desc: 'Describe what things are' },
  'sentence-construction': { emoji: '📝', name: 'Build Sentences', desc: 'Put words in order' },
  'phrase-practice': { emoji: '🗣️', name: 'Say Phrases', desc: 'Practice saying phrases' },
};

// Route map for exercises
const EXERCISE_ROUTES: Record<string, string> = {
  'photo-naming': '/exercise/photo-naming',
  'reach-tap': '/exercise/reach-tap',
  'left-side-hunt': '/exercise/left-side-hunt',
  'pattern-match': '/exercise/pattern-match',
  'phonological': '/exercise/phonological-awareness',
  'semantic-features': '/exercise/semantic-features',
  'sentence-construction': '/exercise/sentence-construction',
  'phrase-practice': '/exercise/word-practice',
};

function getPatientViewState(
  assessmentLoading: boolean,
  lessonLoading: boolean,
  currentAssessment: any,
  lesson: DailyLesson | null
): PatientViewState {
  if (assessmentLoading) return 'loading';
  if (!currentAssessment) return 'needs-assessment';
  if (lessonLoading || !lesson) return 'generating-lesson';
  return 'ready';
}

export function PatientModeView({ userId, profileId, clinicalProfile, onStartAssessment }: PatientModeViewProps) {
  const navigate = useNavigate();
  const { setUiMode } = useUiMode();
  const { lesson, loading: lessonLoading, error: lessonError } = useDailyLesson(userId, profileId, clinicalProfile);
  const { currentAssessment, loading: assessmentLoading } = useAssessmentContext();
  const [showGamePicker, setShowGamePicker] = useState(false);

  const viewState = getPatientViewState(assessmentLoading, lessonLoading, currentAssessment, lesson);

  const handleStartSession = () => {
    if (!lesson) return;
    
    navigate('/lesson', { 
      state: { 
        lesson, 
        clinicalProfile,
        skipDailyCheck: true,
        autoStart: true,
      }
    });
  };

  const handleRest = () => {
    toast("Take all the time you need. Come back when you're ready! 💛", {
      duration: 4000,
    });
  };

  const handleStartAssessment = () => {
    console.log('[PatientMode] Starting assessment - switching to caregiver mode');
    setUiMode('caregiver');
    
    setTimeout(() => {
      console.log('[PatientMode] Triggering assessment modal');
      if (onStartAssessment) {
        onStartAssessment();
      }
    }, 100);
  };

  const handleSelectGame = (exerciseId: string) => {
    const route = EXERCISE_ROUTES[exerciseId];
    if (route) {
      navigate(route, { 
        state: { 
          fromLesson: false,
          userId,
          profileId,
        }
      });
    }
  };

  // Show ALL games in free play mode - gating is for guided lessons only
  const availableGames = Object.entries(PATIENT_GAME_INFO).map(([id, info]) => ({
    id,
    ...info,
  }));

  // Loading state (initial load)
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2">
          <Loader2 className="w-16 h-16 md:w-20 md:h-20 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Getting ready...
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
            Loading your personalized session
          </p>
        </Card>
      </div>
    );
  }

  if (viewState === 'needs-assessment') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2">
          <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-amber-500 mx-auto" />
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Let's get started!
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground font-medium">
              Do a quick check to personalize your exercises, or just try a game!
            </p>
          </div>
          <div className="space-y-4">
            <Button
              onClick={handleStartAssessment}
              size="lg"
              className="w-full min-h-[120px] md:min-h-[140px] text-2xl md:text-3xl font-bold shadow-xl hover:shadow-2xl px-8 py-6 rounded-2xl"
            >
              <Play className="w-10 h-10 md:w-12 md:h-12 mr-4 shrink-0" />
              <span>Start Setup</span>
            </Button>
            <Button
              onClick={() => setShowGamePicker(true)}
              variant="outline"
              size="lg"
              className="w-full min-h-[72px] text-xl md:text-2xl font-semibold px-6 py-4 rounded-xl border-2"
            >
              <Gamepad2 className="w-7 h-7 mr-3 shrink-0" />
              Just try a game
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Generating lesson state - assessment done, building lesson
  if (viewState === 'generating-lesson') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2">
          <Loader2 className="w-16 h-16 md:w-20 md:h-20 animate-spin text-primary mx-auto" />
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Preparing your session...
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Creating a personalized lesson plan
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (lessonError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <Card className="max-w-3xl w-full p-8 md:p-16 space-y-8 text-center shadow-2xl border-2 border-destructive/20">
          <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-destructive mx-auto" />
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Something went wrong
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              {lessonError}
            </p>
          </div>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            size="lg"
            className="min-h-[80px] text-xl md:text-2xl font-semibold px-8 py-4 rounded-xl"
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Game Picker View
  if (showGamePicker) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4 z-10">
          <UiModeToggle />
        </div>
        <div className="max-w-2xl mx-auto">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => setShowGamePicker(false)}
            className="mb-4 min-h-[48px] text-lg"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>

          <Card className="p-6 md:p-8 shadow-xl border-2">
            <div className="text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Choose a Game
              </h1>
              <p className="text-muted-foreground">
                Pick any exercise you'd like to practice
              </p>
            </div>

            {/* Game grid - 1 column on mobile, 2 on larger */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleSelectGame(game.id)}
                  className="rounded-xl border-2 border-border p-4 flex items-start gap-3 text-left
                    hover:border-primary hover:bg-accent/50 active:scale-[0.98] transition-all
                    min-h-[80px] touch-manipulation"
                >
                  <span className="text-3xl">{game.emoji}</span>
                  <div className="flex-1">
                    <span className="font-semibold text-foreground block">{game.name}</span>
                    <span className="text-sm text-muted-foreground">{game.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            {availableGames.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Complete the initial assessment to unlock games.
              </p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Main Patient Mode view - ready state
  return (
    <div className="min-h-screen flex items-center justify-center p-6 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute top-4 right-4 z-10">
        <UiModeToggle />
      </div>
      <Card className="max-w-3xl w-full p-8 md:p-16 space-y-10 text-center shadow-2xl border-2">
        {/* Friendly greeting */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            Ready to practice?
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium">
            No wrong answers. You can stop anytime. 💛
          </p>
        </div>

        {/* Big primary button - Extra large touch target */}
        <div className="space-y-4">
          <Button
            onClick={handleStartSession}
            size="lg"
            aria-label="Start today's therapy session"
            aria-describedby="session-help-text"
            className="w-full min-h-[140px] md:min-h-[180px] text-3xl md:text-4xl font-bold shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] px-8 py-6 rounded-2xl"
          >
            <Play className="w-12 h-12 md:w-16 md:h-16 mr-4 shrink-0" />
            <span>Start Today's Session</span>
          </Button>
          <p id="session-help-text" className="sr-only">
            This button will start your personalized therapy exercises for today
          </p>

          {/* Secondary: Choose a game */}
          <Button
            onClick={() => setShowGamePicker(true)}
            variant="outline"
            size="lg"
            className="w-full min-h-[72px] text-xl md:text-2xl font-semibold px-6 py-4 rounded-xl border-2"
          >
            <Gamepad2 className="w-7 h-7 mr-3 shrink-0" />
            Choose a game I like
          </Button>
        </div>

        {/* Small rest option */}
        <div>
          <Button
            onClick={handleRest}
            variant="ghost"
            size="lg"
            aria-label="Take a rest break"
            className="min-h-[64px] text-xl md:text-2xl text-muted-foreground hover:text-foreground px-8 py-4 rounded-xl hover:bg-accent/50 active:scale-[0.98] transition-all"
          >
            <LogOut className="w-6 h-6 md:w-7 md:h-7 mr-3" />
            I need to rest
          </Button>
        </div>
      </Card>
    </div>
  );
}