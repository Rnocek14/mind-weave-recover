import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, LogOut, Loader2, AlertCircle, Gamepad2, ArrowLeft, Clock, Trophy, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DailyLesson } from "@/lib/dailyLessonEngine";
import { buildPresetLesson } from "@/lib/dailyLessonEngine";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { useDailyLesson } from "@/hooks/useDailyLesson";
import { useAssessmentContext } from "@/contexts/AssessmentContext";
import { useUiMode } from "@/hooks/useUiMode";
import { UiModeToggle } from "@/components/UiModeToggle";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PatientModeViewProps {
  userId: string;
  profileId: string;
  clinicalProfile: ClinicalProfile | null;
  onStartAssessment?: () => void;
}

// Explicit state machine for patient view
type PatientViewState = 'loading' | 'needs-assessment' | 'generating-lesson' | 'ready';

// Patient-friendly game info with emojis, descriptions, and difficulty labels
type GameDifficulty = 'easy' | 'medium' | 'challenge';
type GameCategory = 'motor' | 'speech' | 'thinking';

interface GameInfo {
  emoji: string;
  name: string;
  desc: string;
  difficulty: GameDifficulty;
  category: GameCategory;
}

const DIFFICULTY_LABELS: Record<GameDifficulty, { text: string; className: string }> = {
  'easy': { text: 'Good start', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  'medium': { text: 'Try me', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  'challenge': { text: 'Challenge', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const CATEGORY_LABELS: Record<GameCategory, string> = {
  'motor': '🖐️ Motor',
  'speech': '🗣️ Speech',
  'thinking': '🧠 Thinking',
};

const PATIENT_GAME_INFO: Record<string, GameInfo> = {
  'reach-tap': { emoji: '🎯', name: 'Tap Targets', desc: 'Tap the circles as they appear', difficulty: 'easy', category: 'motor' },
  'phrase-practice': { emoji: '🗣️', name: 'Say Phrases', desc: 'Practice saying phrases', difficulty: 'easy', category: 'speech' },
  'two-clues': { emoji: '🔗', name: 'Two Clues', desc: 'Say a word that connects 2 clues', difficulty: 'easy', category: 'speech' },
  'photo-naming': { emoji: '🖼️', name: 'Picture Naming', desc: 'Say the word for each picture', difficulty: 'medium', category: 'speech' },
  'left-side-hunt': { emoji: '⭐', name: 'Star Hunt', desc: 'Find stars on the left side', difficulty: 'medium', category: 'motor' },
  'phonological': { emoji: '🔤', name: 'Sound Games', desc: 'Practice word sounds', difficulty: 'medium', category: 'speech' },
  'semantic-features': { emoji: '🏷️', name: 'Word Features', desc: 'Describe what things are', difficulty: 'medium', category: 'thinking' },
  'pattern-match': { emoji: '🧩', name: 'Match Patterns', desc: 'Remember and match shapes', difficulty: 'challenge', category: 'thinking' },
  'sentence-construction': { emoji: '📝', name: 'Build Sentences', desc: 'Put words in order', difficulty: 'challenge', category: 'speech' },
  'minimal-pairs': { emoji: '👂', name: 'Minimal Pairs', desc: 'Hear and choose the right word', difficulty: 'medium', category: 'speech' },
  'detective-mind': { emoji: '🔍', name: 'Detective Mind', desc: 'Solve clues and figure things out', difficulty: 'challenge', category: 'thinking' },
  'meaning-match': { emoji: '💡', name: 'Meaning Match', desc: 'Match words with their meanings', difficulty: 'easy', category: 'thinking' },
  'narrative-retell': { emoji: '📖', name: 'Story Retell', desc: 'Listen to a story and retell it', difficulty: 'challenge', category: 'speech' },
  'abstract-compare': { emoji: '⚖️', name: 'Compare Ideas', desc: 'Find what things have in common', difficulty: 'challenge', category: 'thinking' },
  'multi-step-plan': { emoji: '📋', name: 'Plan Steps', desc: 'Put steps in the right order', difficulty: 'medium', category: 'thinking' },
  'dual-load-naming': { emoji: '🔄', name: 'Quick Name', desc: 'Name things while multitasking', difficulty: 'challenge', category: 'speech' },
  'conversation-partner': { emoji: '🎙️', name: 'Free Talk', desc: 'Have a short conversation', difficulty: 'easy', category: 'speech' },
  'conversation-coach': { emoji: '✨', name: 'Smart Coach', desc: 'Chat with helpful exercises', difficulty: 'easy', category: 'speech' },
  'fix-sentence': { emoji: '🔧', name: 'Fix the Sentence', desc: 'Find the wrong word and fix it', difficulty: 'easy', category: 'thinking' },
  'describe-guess': { emoji: '🔍', name: 'Describe & Guess', desc: 'Describe a picture so the app can guess', difficulty: 'medium', category: 'speech' },
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
  'minimal-pairs': '/exercise/minimal-pairs',
  'two-clues': '/exercise/two-clues',
  'detective-mind': '/exercise/detective-mind',
  'meaning-match': '/exercise/meaning-match',
  'narrative-retell': '/exercise/narrative-retell',
  'abstract-compare': '/exercise/abstract-compare',
  'multi-step-plan': '/exercise/multi-step-plan',
  'dual-load-naming': '/exercise/dual-load-naming',
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
  const { sessions } = useSessionHistory(userId);
  const [showGamePicker, setShowGamePicker] = useState(false);
  
  // Get last session for "Last time" card
  const lastSession = sessions[0];

  const viewState = getPatientViewState(assessmentLoading, lessonLoading, currentAssessment, lesson);

  // Show ALL games in free play mode - gating is for guided lessons only
  const availableGames = Object.entries(PATIENT_GAME_INFO).map(([id, info]) => ({
    id,
    ...info,
  }));

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
              className="w-full min-h-[100px] sm:min-h-[120px] md:min-h-[140px] text-xl sm:text-2xl md:text-3xl font-bold shadow-xl hover:shadow-2xl px-4 sm:px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4"
            >
              <Play className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 shrink-0" />
              <span>Start Setup</span>
            </Button>
            <Button
              onClick={() => setShowGamePicker(true)}
              variant="outline"
              size="lg"
              className="w-full min-h-[64px] sm:min-h-[72px] text-lg sm:text-xl md:text-2xl font-semibold px-4 sm:px-6 py-4 rounded-xl border-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3"
            >
              <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
              <span>Just try a game</span>
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
              {availableGames.map((game) => {
                const difficultyInfo = DIFFICULTY_LABELS[game.difficulty];
                return (
                  <button
                    key={game.id}
                    onClick={() => handleSelectGame(game.id)}
                    className="rounded-xl border-2 border-border p-4 flex items-start gap-3 text-left
                      hover:border-primary hover:bg-accent/50 active:scale-[0.98] transition-all
                      min-h-[90px] touch-manipulation"
                  >
                    <span className="text-3xl">{game.emoji}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{game.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyInfo.className}`}>
                          {difficultyInfo.text}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground block">{game.desc}</span>
                      <span className="text-xs text-muted-foreground/70">{CATEGORY_LABELS[game.category]}</span>
                    </div>
                  </button>
                );
              })}
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
        {/* Last Session Card - only show if there's a previous session */}
        {lastSession && (
          <button
            onClick={() => navigate('/history')}
            className="w-full bg-muted/50 rounded-xl p-4 text-left hover:bg-muted/80 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span>Last time ({formatDistanceToNow(new Date(lastSession.endedAt || lastSession.startedAt), { addSuffix: true })})</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {lastSession.durationSec && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">{Math.round(lastSession.durationSec / 60)} min</span>
                  </div>
                )}
                {(() => {
                  const accuracies = lastSession.exercises
                    .map(ex => ex.accuracy)
                    .filter((v): v is number => typeof v === 'number' && !isNaN(v));
                  const avgAccuracy = accuracies.length
                    ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
                    : null;
                  return avgAccuracy !== null && (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">{avgAccuracy}% accuracy</span>
                    </div>
                  );
                })()}
              </div>
              <span className="text-xs text-muted-foreground">
                {lastSession.exercises.reduce((sum, ex) => sum + (ex.totalTrials ?? 0), 0)} trials
              </span>
            </div>
          </button>
        )}

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
            className="w-full min-h-[120px] sm:min-h-[140px] md:min-h-[180px] text-xl sm:text-2xl md:text-4xl font-bold shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] px-4 sm:px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4"
          >
            <Play className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 shrink-0" />
            <span className="text-center leading-tight">Start Today's Session</span>
          </Button>
          <p id="session-help-text" className="sr-only">
            This button will start your personalized therapy exercises for today
          </p>

          {/* Comprehension Session */}
          <Button
            onClick={() => {
              const presetLesson = buildPresetLesson('comprehension_session');
              if (presetLesson) {
                navigate('/lesson', { 
                  state: { 
                    lesson: presetLesson, 
                    clinicalProfile,
                    skipDailyCheck: true,
                    autoStart: true,
                  }
                });
              } else {
                toast('Comprehension Session unavailable', { duration: 3000 });
              }
            }}
            variant="outline"
            size="lg"
            className="w-full min-h-[64px] sm:min-h-[72px] text-lg sm:text-xl md:text-2xl font-semibold px-4 sm:px-6 py-4 rounded-xl border-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3"
          >
            <span className="text-2xl">🧠</span>
            <span>Comprehension Session</span>
          </Button>

          {/* Secondary: Choose a game */}
          <Button
            onClick={() => setShowGamePicker(true)}
            variant="outline"
            size="lg"
            className="w-full min-h-[64px] sm:min-h-[72px] text-lg sm:text-xl md:text-2xl font-semibold px-4 sm:px-6 py-4 rounded-xl border-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3"
          >
            <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <span>Choose a game I like</span>
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