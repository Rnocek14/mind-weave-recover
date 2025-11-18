import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings } from "lucide-react";
import { SentenceConstructionGame } from "@/components/SentenceConstructionGame";
import { useAuth } from "@/hooks/useAuth";
import { useExerciseDifficulty } from "@/hooks/useExerciseDifficulty";
import { useExerciseTelemetry } from "@/hooks/useExerciseTelemetry";
import { startSession, endSession, trackRound } from "@/lib/sessionTracking";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DifficultyInfoBadge } from "@/components/DifficultyInfoBadge";

const SentenceConstructionExercise = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { level, loading: levelLoading, saveLevel, stepDown, bounds } = useExerciseDifficulty(
    user?.id,
    "sentence-construction"
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  
  const { trialNumber, startTrial, logTrial } = useExerciseTelemetry(
    sessionId || "temp",
    "sentence-construction"
  );

  useEffect(() => {
    if (user) {
      initSession();
    }
  }, [user]);

  const initSession = async () => {
    if (!user) return;

    try {
      const session = await startSession(user.id, {
        blocks: [{ exercise: "sentence-construction", duration: 600 }]
      });
      setSessionId(session.id);
    } catch (error) {
      console.error("Failed to start session:", error);
      toast.error("Failed to start session");
    }
  };

  const handleTrialComplete = async (data: {
    correct: boolean;
    reactionTime: number;
    errorType: string | null;
    grammarFocus: string;
  }) => {
    startTrial();

    if (sessionId) {
      await trackRound(
        sessionId,
        "sentence-construction",
        trialNumber,
        data.correct ? 1 : 0,
        {
          difficulty: level,
          grammarFocus: data.grammarFocus
        },
        {
          errorType: data.errorType,
          reactionTime: data.reactionTime
        }
      );
    }

    await logTrial({
      correct: data.correct,
      reactionTimeMs: data.reactionTime,
      cueLevel: 0,
      errorType: data.errorType,
      taskParameters: {
        difficulty: level,
        grammarFocus: data.grammarFocus
      }
    });
  };

  const handleGameComplete = async (finalScore: number, totalTrials: number) => {
    if (sessionId) {
      const durationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
      const accuracy = Math.round((finalScore / totalTrials) * 100);

      await endSession(sessionId, {
        durationSec,
        scores: { "sentence-construction": accuracy },
        reps: totalTrials
      });
    }

    toast.success("Session completed!", {
      description: `Score: ${finalScore}/${totalTrials}`
    });
  };

  const handleDifficultyChange = async (newLevel: number) => {
    await saveLevel(newLevel);
    setShowSettings(false);
    toast.success(`Difficulty set to Level ${newLevel}`);
  };

  if (levelLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Sentence Construction
              </h1>
              <p className="text-muted-foreground">
                Build grammatically correct sentences
              </p>
            </div>

            <div className="flex items-center gap-2">
              <DifficultyInfoBadge level={level} floor={bounds.floor} ceiling={bounds.ceiling} />
              
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Difficulty Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Difficulty Level: {level}</Label>
                      <Slider
                        value={[level]}
                        onValueChange={([val]) => handleDifficultyChange(val)}
                        min={1}
                        max={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Level 1: Basic SVO</span>
                        <span>Level 5: Complex Tenses</span>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Badge variant="secondary">Grammar Focus</Badge>
            <Badge variant="outline">Level {level}</Badge>
          </div>
        </div>

        {/* Game */}
        <SentenceConstructionGame
          difficultyLevel={level}
          onTrialComplete={handleTrialComplete}
          onGameComplete={handleGameComplete}
        />
      </div>
    </div>
  );
};

export default SentenceConstructionExercise;
