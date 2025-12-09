import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings, SkipForward } from "lucide-react";
import { SentenceConstructionGame } from "@/components/SentenceConstructionGame";
import { useAuth } from "@/hooks/useAuth";
import { useExerciseConfig } from "@/hooks/useExerciseConfig";
import { useExerciseGating } from "@/hooks/useExerciseGating";
import { useExerciseTelemetry } from "@/hooks/useExerciseTelemetry";
import { startSession, endSession, trackRound } from "@/lib/sessionTracking";
import { toast } from "sonner";
import { ExerciseAdaptationBanner } from "@/components/ExerciseAdaptationBanner";
import { supabase } from "@/integrations/supabase/client";
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
  const location = useLocation();
  const { user } = useAuth();
  
  // Extract lesson flow state
  const fromLesson = location.state?.fromLesson === true;
  const lessonSessionId = location.state?.sessionId as string | undefined;
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);

  // Fetch clinical profile
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('clinical_profile')
        .eq('user_id', user.id)
        .single();
      
      setClinicalProfile(data?.clinical_profile);
    };
    
    fetchProfile();
  }, [user?.id]);

  // Get merged exercise config with capability adaptations
  const { config, hasCapabilityAdaptations, bounds } = useExerciseConfig(
    'sentence-construction',
    user?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id, undefined);
  const level = config.startDifficulty || 1;
  
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
      // If coming from lesson, use the passed sessionId
      if (fromLesson && lessonSessionId) {
        setSessionId(lessonSessionId);
      } else {
        // Create new session
        const session = await startSession(user.id, {
          blocks: [{ exercise: "sentence-construction", duration: 600 }]
        });
        setSessionId(session.id);
      }
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
    
    if (fromLesson) {
      // Return to lesson flow
      window.dispatchEvent(new CustomEvent('exercise-complete'));
      navigate('/lesson', { state: { resuming: true } });
    } else {
      // Standalone mode - go to dashboard
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  const handleSkipExercise = async () => {
    // Log skip analytics with clinical profile snapshot
    if (user?.id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, clinical_profile')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        await supabase.from('exercise_skips').insert({
          user_id: user.id,
          profile_id: profile?.id,
          session_id: sessionId,
          exercise_slug: 'sentence-construction',
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }
    
    toast.info("Exercise skipped - moving to next activity");
    
    // Dispatch event and navigate back to lesson
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate('/lesson', { state: { resuming: true } });
  };

  const handleDifficultyChange = async (newLevel: number) => {
    setShowSettings(false);
    toast.success(`Difficulty set to Level ${newLevel}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              onClick={() => fromLesson ? navigate('/lesson', { state: { resuming: false } }) : navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {fromLesson ? 'Back to Lesson' : 'Back to Dashboard'}
            </Button>
            
            {fromLesson && (
              <Button
                variant="outline"
                onClick={handleSkipExercise}
                className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip - Too Difficult
              </Button>
            )}
          </div>

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

        {/* Capability Adaptation Banner */}
        {hasCapabilityAdaptations && (
          <div className="mb-4">
            <ExerciseAdaptationBanner 
              adaptation={getAdaptations('sentence-construction')} 
              showDetails={true}
            />
          </div>
        )}

        {/* Game */}
        <SentenceConstructionGame
          config={config}
          bounds={bounds}
          adaptations={getAdaptations('sentence-construction')}
          onTrialComplete={handleTrialComplete}
          onGameComplete={handleGameComplete}
        />
      </div>
    </div>
  );
};

export default SentenceConstructionExercise;
