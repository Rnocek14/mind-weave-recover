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
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';
import { getTrialsByTargetWords } from '@/data/semanticFeatureBank';

export default function SemanticFeatureExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Extract lesson flow state
  const restored = useRestoredLessonContext('semantic-features');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId;
  const lessonAdaptations = restored.adaptations;
  
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
    navigate(returnTo, { state: { resuming: true } });
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
          <h1 className="text-lg font-semibold">Semantic Features</h1>
          <div className="flex items-center gap-1">
            {fromLesson && (
              <Button variant="ghost" size="sm" onClick={handleSkipExercise} className="text-orange-600 text-xs">
                <SkipForward className="w-3.5 h-3.5 mr-1" />Skip
              </Button>
            )}
            <DifficultyInfoBadge level={adaptation.difficultyTier} floor={bounds.floor} ceiling={bounds.ceiling} />
          </div>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className="container px-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="max-w-6xl mx-auto space-y-4">

        {/* Adaptation badges — desktop only */}
        {adaptation.adaptationReasons.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1.5 mb-2">
            {adaptation.adaptationReasons.slice(0, 3).map((reason, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{reason}</Badge>
            ))}
          </div>
        )}

        {/* Targeted practice banner — desktop only */}
        {targetedWords.length > 0 && (
          <Card className="hidden sm:block p-3 bg-primary/10 border-primary/20">
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
      </main>
    </div>
  );
}
