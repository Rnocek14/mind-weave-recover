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
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';

export default function PatternMatchExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { toast } = useToast();
  
  // Extract lesson flow state
  const restored = useRestoredLessonContext('pattern-match');
  const { fromLesson, returnTo } = restored;
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

  // Per-trial clinical telemetry (exercise_events). pattern-match was previously
  // "dark" — its onTrialComplete only console.logged, so no per-trial rows were
  // ever written. Wire the shared telemetry hook so each trial is persisted.
  const { logTrial: logPatternTrial } = useExerciseTelemetry(sessionId, 'pattern-match');

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
    navigate(returnTo, { state: { resuming: true } });
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
      navigate(returnTo, { state: { resuming: true } });
    } else {
      setTimeout(() => navigate('/today'), 2000);
    }
  };

  // Start session on mount
  if (!sessionId && user?.id) {
    handleGameStart();
  }

  return (
    <div className="h-dvh overflow-hidden bg-background flex flex-col">
      {fromLesson && <SessionSidePanel />}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">Pattern Match</h1>
          <div className="flex items-center gap-1">
            {fromLesson && (
              <Button variant="ghost" size="sm" onClick={handleSkipExercise} className="text-orange-600 text-xs">
                <SkipForward className="w-3.5 h-3.5 mr-1" />Skip
              </Button>
            )}
            <DifficultyInfoBadge level={config.startDifficulty || 3} floor={bounds.floor} ceiling={bounds.ceiling} />
          </div>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center space-y-4">

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
          userId={user?.id}
          sessionId={sessionId}
        />
        </div>
      </main>
    </div>
  );
}
