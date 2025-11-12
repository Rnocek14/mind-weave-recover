import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Play, Pause, RotateCcw, CheckCircle2, 
  Volume2, ChevronLeft, Trophy, TrendingUp, HelpCircle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RestPrompt } from "@/components/RestPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useExerciseDifficulty } from "@/hooks/useExerciseDifficulty";
import { useExerciseTelemetry } from "@/hooks/useExerciseTelemetry";
import { startSession } from "@/lib/sessionTracking";
import { PhotoNamingGame } from "@/components/PhotoNamingGame";

const Exercise = () => {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showRestPrompt, setShowRestPrompt] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const totalRounds = 10;
  
  const { level, stepDown } = useExerciseDifficulty(user?.id, exerciseId || "photo-naming");
  const { startTrial, logTrial, calculateReactionTime, reset: resetTelemetry } = useExerciseTelemetry(
    sessionId,
    exerciseId || "photo-naming"
  );

  // Mock exercise data
  const exercises: Record<string, any> = {
    "photo-naming": {
      title: "Name That Photo",
      instruction: "Say the name of the object you see",
      type: "speech"
    },
    "reach-tap": {
      title: "Reach & Tap",
      instruction: "Tap the highlighted targets as quickly as you can",
      type: "motor"
    }
  };

  const exercise = exercises[exerciseId || ""] || exercises["photo-naming"];

  useEffect(() => {
    if (isPlaying) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            handleRoundComplete();
            return 0;
          }
          return prev + 2;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [isPlaying, currentRound]);

  const handleRoundComplete = async (wasCorrect: boolean = true) => {
    // Calculate reaction time from when trial started
    const reactionTime = calculateReactionTime();
    
    // Log telemetry with rich data
    await logTrial({
      correct: wasCorrect,
      reactionTimeMs: reactionTime,
      cueLevel: 0, // TODO: Track actual cue usage
      errorType: wasCorrect ? undefined : 'mock_error',
      taskParameters: {
        difficulty_level: level,
        round: currentRound,
        exercise_type: exercise.type,
      },
    });

    const roundScore = Math.floor(Math.random() * 20) + 80; // 80-100
    setScore(prev => prev + roundScore);
    
    if (currentRound >= totalRounds) {
      setIsPlaying(false);
      setShowResult(true);
      
      toast({
        title: "Exercise Complete! 🎉",
        description: `Great job! You scored ${score + roundScore} points`
      });
    } else {
      setCurrentRound(prev => prev + 1);
      setProgress(0);
      // Start timing the next trial
      startTrial();
    }
  };

  const startExercise = async () => {
    setIsPlaying(true);
    setShowResult(false);
    
    // Initialize session tracking
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
      
      // Create session in database
      if (user?.id) {
        try {
          const session = await startSession(user.id, {
            blocks: [
              {
                exercise: exerciseId || "photo-naming",
                duration: totalRounds,
              },
            ],
          });
          setSessionId(session.id);
        } catch (error) {
          console.error('Error starting session:', error);
        }
      }
    }
    
    // Start timing the first trial
    startTrial();
  };

  // Check for rest prompt every minute
  useEffect(() => {
    if (!isPlaying || !sessionStartTime) return;

    const checkInterval = setInterval(() => {
      const elapsed = (Date.now() - sessionStartTime) / 1000 / 60; // minutes
      if (elapsed >= 10 && !showRestPrompt) {
        setIsPlaying(false);
        setShowRestPrompt(true);
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [isPlaying, sessionStartTime, showRestPrompt]);

  const resetExercise = () => {
    setIsPlaying(false);
    setCurrentRound(1);
    setScore(0);
    setProgress(0);
    setShowResult(false);
    setSessionStartTime(null);
    setSessionId(null);
    resetTelemetry();
  };

  if (showRestPrompt) {
    return (
      <RestPrompt
        onContinue={() => {
          setShowRestPrompt(false);
          setIsPlaying(true);
        }}
        onEnd={() => {
          setShowRestPrompt(false);
          setShowResult(true);
        }}
      />
    );
  }

  if (showResult) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 shadow-glow text-center animate-slide-up">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-celebrate flex items-center justify-center mb-6 animate-celebrate">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          
          <h2 className="text-3xl font-bold mb-2">Excellent Work!</h2>
          <p className="text-muted-foreground mb-8">
            You've completed today's {exercise.title} session
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-muted rounded-lg p-4">
              <div className="text-3xl font-bold text-primary">{score}</div>
              <div className="text-sm text-muted-foreground">Total Score</div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-3xl font-bold text-success">{totalRounds}</div>
              <div className="text-sm text-muted-foreground">Rounds</div>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              className="w-full bg-gradient-healing" 
              size="lg"
              onClick={resetExercise}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <Button 
          variant="ghost" 
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <Card className="p-6 mb-6 shadow-card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {exercise.title}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Volume2 className="w-4 h-4" />
                <p>{exercise.instruction}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{score}</div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Round {currentRound} of {totalRounds}
              </span>
              <span className="font-medium text-primary">
                {Math.round((currentRound / totalRounds) * 100)}%
              </span>
            </div>
            <Progress value={(currentRound / totalRounds) * 100} className="h-2" />
          </div>
        </Card>

        {/* Exercise Area */}
        <Card className="p-8 md:p-12 mb-6 shadow-card min-h-[400px] flex flex-col items-center justify-center">
          {!isPlaying ? (
            <div className="text-center space-y-6">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-healing flex items-center justify-center animate-pulse-glow">
                <Play className="w-16 h-16 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Ready to Begin?</h3>
                <p className="text-muted-foreground">
                  Take your time and do your best. You've got this!
                </p>
              </div>
              <Button 
                size="lg" 
                className="bg-gradient-healing text-lg px-12 py-6"
                onClick={startExercise}
              >
                <Play className="w-6 h-6 mr-2" />
                Start Exercise
              </Button>
            </div>
          ) : exerciseId === 'photo-naming' ? (
            <PhotoNamingGame
              totalTrials={totalRounds}
              difficultyLevel={level}
              onTrialComplete={async (result) => {
                await logTrial({
                  correct: result.correct,
                  reactionTimeMs: result.reactionTimeMs,
                  cueLevel: 0,
                  errorType: result.errorType,
                  taskParameters: {
                    difficulty_level: level,
                    round: currentRound,
                    exercise_type: 'photo-naming',
                  },
                });
                
                // Move to next round
                if (currentRound < totalRounds) {
                  setCurrentRound((prev) => prev + 1);
                  if (result.correct) {
                    setScore((prev) => prev + 100);
                  }
                  startTrial();
                }
              }}
              onGameComplete={(finalScore) => {
                setScore(finalScore);
                setIsPlaying(false);
                setShowResult(true);
              }}
            />
          ) : (
            <div className="w-full space-y-8">
              {/* Fallback for other exercise types */}
              <div className="text-center space-y-6">
                <div className="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center border-4 border-primary shadow-glow">
                  <span className="text-6xl">🏠</span>
                </div>
                <p className="text-xl font-medium">
                  What is this object?
                </p>
                <Progress value={progress} className="h-4" />
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Round {currentRound} in progress...
              </div>
            </div>
          )}
        </Card>

        {/* Tips */}
        <Card className="p-6 shadow-card border-l-4 border-success">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Tips for Success
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Take your time - accuracy is more important than speed</li>
            <li>• Say the words out loud, even if quietly</li>
            <li>• Don't worry about mistakes - every attempt helps you improve</li>
            <li>• Take breaks if you feel tired</li>
          </ul>
        </Card>

        {/* Fixed Safety Controls - Always visible during exercise */}
        {isPlaying && (
          <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t shadow-glow p-4 z-50">
            <div className="container mx-auto max-w-4xl flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="min-w-[120px] min-h-[60px] text-lg"
                onClick={() => setIsPlaying(false)}
              >
                <Pause className="w-6 h-6 mr-2" />
                Pause
              </Button>
              <Button
                className="bg-success min-w-[160px] min-h-[60px] text-lg"
                size="lg"
                onClick={() => handleRoundComplete(true)}
              >
                <CheckCircle2 className="w-6 h-6 mr-2" />
                I Said It!
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="min-w-[140px] min-h-[60px] text-lg"
                onClick={async () => {
                  const newLevel = await stepDown(sessionId ?? undefined);
                  // Optionally adjust current round difficulty based on newLevel
                  toast({
                    title: "Adjusted!",
                    description: `Difficulty lowered to level ${newLevel}`,
                  });
                }}
                title="We'll make the next step easier"
              >
                <HelpCircle className="w-6 h-6 mr-2" />
                Too Hard
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="min-w-[120px] min-h-[60px] text-lg"
                onClick={() => {
                  setIsPlaying(false);
                  navigate("/dashboard");
                }}
              >
                End Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Exercise;
