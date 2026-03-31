import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PatternMatchGame } from '@/components/PatternMatchGame';
import { useAuth } from '@/hooks/useAuth';
import { startSession, endSession } from '@/lib/sessionTracking';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, SkipForward } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DifficultyInfoBadge } from '@/components/DifficultyInfoBadge';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useExerciseGating } from '@/hooks/useExerciseGating';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { useProfile } from '@/hooks/useProfile';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';

export default function PatternMatchExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { toast } = useToast();
  
  // Extract lesson flow state
  const restored = useRestoredLessonContext('pattern-match');
  const fromLesson = restored.fromLesson;
  const lessonSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState(Date.now());
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);

  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: 'pattern-match', domainSlug: 'executive_function', fromLesson });
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
    'pattern-match',
    user?.id,
    activeProfile?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id, activeProfile?.id);

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
          exercise_slug: CANONICAL_SLUGS.PATTERN_MATCH,
          skip_reason: 'too_difficult',
          from_lesson: fromLesson,
          clinical_snapshot: profile?.clinical_profile
        });
      } catch (error) {
        console.error('Error logging skip:', error);
      }
    }

    toast({
      title: "Exercise skipped",
      description: "Moving to next activity",
    });
    
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate('/lesson', { state: { resuming: true } });
  };

  const handleGameStart = async () => {
    if (!user?.id) return;
    
    if (fromLesson && lessonSessionId) {
      setSessionId(lessonSessionId);
    } else {
      const session = await startSession(user.id, {
        blocks: [{ exercise: 'pattern-match', duration: 8 }],
      });
      setSessionId(session.id);
    }
  };

  const handleGameComplete = async (finalScore: number) => {
    if (!sessionId || !user?.id) return;
    
    const durationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
    const totalTrials = 10;
    const accuracy = (finalScore / totalTrials) * 100;
    
    await endSession(sessionId, {
      durationSec,
      scores: { 'pattern-match': accuracy },
      reps: totalTrials,
    });
    
    toast({
      title: 'Session saved!',
      description: `You matched ${finalScore}/${totalTrials} patterns (${accuracy.toFixed(0)}% accuracy).`,
    });
    
    if (fromLesson) {
      window.dispatchEvent(new CustomEvent('exercise-complete'));
      navigate('/lesson', { state: { resuming: true } });
    } else {
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  // Start session on mount
  if (!sessionId && user?.id) {
    handleGameStart();
  }

  return (
    <div className={`${fromLesson ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background p-4 flex flex-col`}>
      {fromLesson && <SessionSidePanel />}
      {fromLesson && <InlineSessionProgress />}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              aria-label={fromLesson ? 'Back to Lesson' : 'Back to Dashboard'}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Pattern Match</h1>
              <p className="text-muted-foreground">
                Remember and match visual patterns to train attention and memory
              </p>
            </div>
            
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
          <DifficultyInfoBadge level={config.startDifficulty || 3} floor={bounds.floor} ceiling={bounds.ceiling} />
        </div>

        {/* Capability Adaptation Banner */}
        {hasCapabilityAdaptations && (
          <ExerciseAdaptationBanner 
            adaptation={getAdaptations('pattern-match')} 
            showDetails={true}
          />
        )}

        {/* Game */}
        <PatternMatchGame
          totalTrials={10}
          initialDifficulty={config.startDifficulty || 3}
          bounds={bounds}
          slowMode={true}
          onGameComplete={handleGameComplete}
          onTrialComplete={(data) => {
            console.log('Trial complete:', { ...data, adaptation: adaptationTelemetry });
          }}
        />
      </div>
    </div>
  );
}
