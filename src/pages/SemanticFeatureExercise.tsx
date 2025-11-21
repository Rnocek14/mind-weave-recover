import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SemanticFeatureGame } from '@/components/SemanticFeatureGame';
import { useAuth } from '@/hooks/useAuth';
import { startSession, endSession } from '@/lib/sessionTracking';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DifficultyInfoBadge } from '@/components/DifficultyInfoBadge';
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useExerciseGating } from '@/hooks/useExerciseGating';
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { supabase } from '@/integrations/supabase/client';

export default function SemanticFeatureExercise() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
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
    'semantic-features',
    user?.id,
    clinicalProfile,
    null
  );
  
  const { getAdaptations } = useExerciseGating(user?.id);

  const handleGameStart = async () => {
    if (!user?.id) return;
    
    const session = await startSession(user.id, {
      blocks: [{ exercise: 'semantic-features', duration: 10 }],
    });
    
    setSessionId(session.id);
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
    
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  // Start session on mount
  if (!sessionId && user?.id) {
    handleGameStart();
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Semantic Feature Analysis</h1>
              <p className="text-muted-foreground">
                Strengthen word retrieval by identifying semantic features
              </p>
            </div>
          </div>
          <DifficultyInfoBadge level={config.startDifficulty || 1} floor={bounds.floor} ceiling={bounds.ceiling} />
        </div>

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
