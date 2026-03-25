import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SemanticFeatureGame } from '@/components/SemanticFeatureGame';
import { useAuth } from '@/hooks/useAuth';
import { startSession, endSession } from '@/lib/sessionTracking';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowLeft, SkipForward, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DifficultyInfoBadge } from '@/components/DifficultyInfoBadge';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useExerciseGating } from '@/hooks/useExerciseGating';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgressBubble } from '@/components/SessionProgressBubble';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { getTrialsByTargetWords } from '@/data/semanticFeatureBank';

export default function SemanticFeatureExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Extract lesson flow state
  const fromLesson = location.state?.fromLesson === true;
  const lessonSessionId = location.state?.sessionId as string | undefined;
  const lessonAdaptations = location.state?.adaptations as Record<string, any> | undefined;
  
  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    lessonAdaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'semantic_paraphasia',
  });

  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: false,  // semantic features, not phoneme-targeted
    cueSensitive: true,
  });

  const pivot = useExerciseMidSessionPivot({ exerciseSlug: 'semantic-features', domainSlug: 'semantic_depth', fromLesson });
  
  // Extract targeted practice from URL params
  const searchParams = new URLSearchParams(location.search);
  const targetedWords = searchParams.get('targets')?.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) || [];
  const practiceSource = searchParams.get('source') || null;
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime] = useState(Date.now());
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  
  // Generate custom trials if targeted practice
  const customTrials = useMemo(() => {
    if (targetedWords.length > 0) {
      console.log('🎯 Semantic targeted practice:', { targetedWords, source: practiceSource });
      return getTrialsByTargetWords(targetedWords, 10);
    }
    return undefined;
  }, [targetedWords.join(',')]);

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
    'semantic-features',
    user?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id, undefined);

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
          exercise_slug: CANONICAL_SLUGS.SEMANTIC_FEATURES,
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
        blocks: [{ exercise: 'semantic-features', duration: 10 }],
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
      scores: { 'semantic-features': accuracy },
      reps: totalTrials,
    });
    
    toast({
      title: 'Session saved!',
      description: `You completed ${totalTrials} trials with ${accuracy.toFixed(0)}% accuracy.`,
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
    <div className="min-h-screen bg-background p-4">
      {fromLesson && <SessionSidePanel />}
      {fromLesson && <SessionProgressBubble />}
      <div className="max-w-6xl mx-auto space-y-6">
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
              <h1 className="text-2xl font-bold">Semantic Feature Analysis</h1>
              <p className="text-muted-foreground">
                Strengthen word retrieval by identifying semantic features
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
          <DifficultyInfoBadge level={adaptation.difficultyTier} floor={bounds.floor} ceiling={bounds.ceiling} />
        </div>

        {/* Adaptation badges */}
        {adaptation.adaptationReasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {adaptation.adaptationReasons.slice(0, 3).map((reason, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{reason}</Badge>
            ))}
          </div>
        )}

        {/* Targeted practice banner */}
        {targetedWords.length > 0 && (
          <Card className="p-3 bg-primary/10 border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Targeted Practice:</span>
              <span className="text-muted-foreground">
                Focusing on {targetedWords.slice(0, 3).join(', ')}{targetedWords.length > 3 ? ` +${targetedWords.length - 3} more` : ''}
              </span>
            </div>
          </Card>
        )}

        {/* Capability Adaptation Banner */}
        {hasCapabilityAdaptations && (
          <ExerciseAdaptationBanner 
            adaptation={getAdaptations('semantic-features')} 
            showDetails={true}
          />
        )}

        {/* Game */}
        <SemanticFeatureGame
          totalTrials={10}
          config={config}
          bounds={bounds}
          adaptations={getAdaptations('semantic-features')}
          customTrials={customTrials}
          userId={user?.id}
          sessionId={sessionId || undefined}
          onGameComplete={handleGameComplete}
          onTrialComplete={(data) => {
            console.log('Trial complete:', { ...data, ...adaptationTelemetry });
          }}
        />
      </div>
    </div>
  );
}
