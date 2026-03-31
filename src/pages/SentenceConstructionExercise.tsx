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
import { useSessionAdaptation } from "@/hooks/useSessionAdaptation";
import { buildAdaptationTelemetry } from "@/lib/adaptationTelemetry";
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { startSession, endSession, trackRound } from "@/lib/sessionTracking";
import { CANONICAL_SLUGS } from "@/lib/exerciseSlugNormalizer";
import { toast } from "sonner";
import { useRestoredLessonContext } from "@/hooks/useRestoredLessonContext";
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
import { InlineSessionProgress } from "@/components/InlineSessionProgress";
import { SessionSidePanel } from "@/components/SessionSidePanel";

const SentenceConstructionExercise = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Extract lesson flow state
  const restored = useRestoredLessonContext('sentence-construction');
  const fromLesson = restored.fromLesson;
  const lessonSessionId = restored.sessionId;
  
  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'semantic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,
    cueSensitive: false,  // grammar-focused, not cue-driven
  });
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState<number>(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  const [manualDifficulty, setManualDifficulty] = useState<number | null>(null);

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
  const level = manualDifficulty ?? adaptation.difficultyTier;
  
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
      if (fromLesson && lessonSessionId) {
        setSessionId(lessonSessionId);
      } else {
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
    trialSource: 'graded_sentence_bank' | 'standard_sentence_bank';
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
        grammarFocus: data.grammarFocus,
        trial_source: data.trialSource,
        ...adaptationTelemetry,
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
      window.dispatchEvent(new CustomEvent('exercise-complete'));
      navigate('/lesson', { state: { resuming: true } });
    } else {
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  const handleSkipExercise = async () => {
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
          exercise_slug: CANONICAL_SLUGS.SENTENCE_CONSTRUCTION,
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }
    
    toast.info("Exercise skipped - moving to next activity");
    
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate('/lesson', { state: { resuming: true } });
  };

  const handleDifficultyChange = (newLevel: number) => {
    setManualDifficulty(newLevel);
    setShowSettings(false);
    toast.success(`Difficulty set to Level ${newLevel}`);
  };

  if (fromLesson) {
    return (
      <div className="h-dvh flex flex-col bg-background overflow-hidden">
        <SessionSidePanel />
        <InlineSessionProgress />
        {/* Compact header */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              window.dispatchEvent(new CustomEvent('exercise-complete'));
              navigate('/lesson', { state: { resuming: true } });
            }}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <span className="text-sm font-medium">Sentence Construction</span>
            <Badge variant="outline" className="text-xs">Lv {level}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipExercise}
            className="text-orange-600"
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Skip
          </Button>
        </div>
        {/* Game fills remaining space */}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <SentenceConstructionGame
            config={config}
            bounds={bounds}
            difficultyLevel={level}
            focusPhonemes={adaptation.focusPhonemes}
            adaptations={getAdaptations('sentence-construction')}
            onTrialComplete={handleTrialComplete}
            onGameComplete={handleGameComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
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
                        max={10}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Level 1: Basic SVO</span>
                        <span>Level 10: Advanced</span>
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
            {adaptation.adaptationReasons.length > 0 && (
              <Badge variant="secondary" className="text-xs">Adapted</Badge>
            )}
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
          difficultyLevel={level}
          focusPhonemes={adaptation.focusPhonemes}
          adaptations={getAdaptations('sentence-construction')}
          onTrialComplete={handleTrialComplete}
          onGameComplete={handleGameComplete}
        />
      </div>
    </div>
  );
};

export default SentenceConstructionExercise;
