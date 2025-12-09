import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhonologicalGame } from '@/components/PhonologicalGame';
import { useAuth } from '@/hooks/useAuth';
import { startSession, endSession } from '@/lib/sessionTracking';
import { Button } from '@/components/ui/button';
import { ArrowLeft, SkipForward } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DifficultyInfoBadge } from '@/components/DifficultyInfoBadge';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useExerciseGating } from '@/hooks/useExerciseGating';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgressBubble } from '@/components/SessionProgressBubble';

export default function PhonologicalExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Extract lesson flow state
  const fromLesson = location.state?.fromLesson === true;
  const lessonSessionId = location.state?.sessionId as string | undefined;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState(Date.now());
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
    'phonological-awareness',
    user?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id, undefined);

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
          exercise_slug: 'phonological-awareness',
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
    
    // Dispatch event and navigate back to lesson
    window.dispatchEvent(new CustomEvent('exercise-complete'));
    navigate('/lesson', { state: { resuming: true } });
  };

  const handleGameStart = async () => {
    if (!user?.id) return;
    
    // If coming from lesson, use the passed sessionId
    if (fromLesson && lessonSessionId) {
      setSessionId(lessonSessionId);
    } else {
      // Create new session
      const session = await startSession(user.id, {
        blocks: [{ exercise: 'phonological-awareness', duration: 10 }],
      });
      setSessionId(session.id);
    }
  };

  const handleGameComplete = async (finalScore: number, totalTrials: number) => {
    if (!sessionId || !user?.id) return;
    
    const durationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
    const accuracy = (finalScore / totalTrials) * 100;
    
    await endSession(sessionId, {
      durationSec,
      scores: { 'phonological-awareness': accuracy },
      reps: totalTrials,
    });
    
    toast({
      title: 'Session saved!',
      description: `You completed ${totalTrials} trials with ${accuracy.toFixed(0)}% accuracy.`,
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

  // Start session on mount
  if (!sessionId && user?.id) {
    handleGameStart();
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {fromLesson && <SessionProgressBubble />}
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fromLesson ? navigate('/lesson', { state: { resuming: false } }) : navigate('/dashboard')}
              aria-label={fromLesson ? 'Back to Lesson' : 'Back to Dashboard'}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Phonological Awareness</h1>
              <p className="text-muted-foreground">
                Train phoneme discrimination with minimal pairs and sound matching
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
          <DifficultyInfoBadge level={config.startDifficulty || 1} floor={bounds.floor} ceiling={bounds.ceiling} />
        </div>

        {/* Capability Adaptation Banner */}
        {hasCapabilityAdaptations && (
          <ExerciseAdaptationBanner 
            adaptation={getAdaptations('phonological-awareness')} 
            showDetails={true}
          />
        )}

        {/* Game */}
        <PhonologicalGame
          totalTrials={10}
          config={config}
          bounds={bounds}
          adaptations={getAdaptations('phonological-awareness')}
          userId={user?.id}
          sessionId={sessionId || undefined}
          onGameComplete={handleGameComplete}
          onTrialComplete={(data) => {
            console.log('Trial complete:', data);
          }}
        />
      </div>
    </div>
  );
}
