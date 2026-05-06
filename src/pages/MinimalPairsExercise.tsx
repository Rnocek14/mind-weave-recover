/**
 * MinimalPairsExercise Page
 * 
 * Dedicated exercise for phoneme discrimination using minimal pairs.
 * Now consumes shared adaptation contract for phoneme targeting + telemetry.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MinimalPairsGame } from '@/components/MinimalPairsGame';
import { getMinimalPairStats } from '@/data/minimalPairsBank';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSessionAdaptation } from '@/hooks/useSessionAdaptation';
import { buildAdaptationTelemetry } from '@/lib/adaptationTelemetry';
import { useExerciseMidSessionPivot } from '@/hooks/useExerciseMidSessionPivot';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { startSession } from '@/lib/sessionTracking';
import { ArrowLeft, Ear, Home, Info } from 'lucide-react';
import { InlineSessionProgress } from '@/components/InlineSessionProgress';
import { SessionSidePanel } from '@/components/SessionSidePanel';

export default function MinimalPairsExercise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  
  const restored = useRestoredLessonContext('minimal-pairs');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId;
  const exerciseCompleteSentRef = useRef(false);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  
  // Shared adaptation contract
  const adaptation = useSessionAdaptation({
    exerciseSlug: 'minimal-pairs',
    lessonAdaptations: location.state?.adaptations,
    lessonFocusPhonemes: location.state?.focusPhonemes,
    defaultErrorType: 'phonemic_paraphasia',
  });
  
  
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation, {
    phonemeSensitive: true,
    cueSensitive: false,
  });

  const difficulty = adaptation.difficultyTier;
  
  // Get stats about available pairs
  const stats = getMinimalPairStats();
  
  const { startTrial, logTrial } = useExerciseTelemetry(sessionId, 'minimal_pairs');
  
  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (!user?.id) return;
      
      // Use lesson session if provided
      if (fromLesson && lessonSessionId) {
        setSessionId(lessonSessionId);
        return;
      }
      
      const session = await startSession(
        user.id, 
        { blocks: [{ exercise: 'minimal_pairs', duration: 10 }] },
        { modality: 'listening' }
      );
      
      if (session) {
        setSessionId(session.id);
      }
    };
    
    if (isStarted) {
      initSession();
    }
  }, [user?.id, isStarted, fromLesson, lessonSessionId]);

  const handleBack = useCallback(() => {
    navigate(fromLesson ? returnTo : '/dashboard');
  }, [navigate, fromLesson]);
  
  const handleComplete = useCallback((results: {
    score: number;
    correctCount: number;
    incorrectCount: number;
    accuracy: number;
  }) => {
    console.log('Minimal pairs exercise complete:', results);
    
    // Return to lesson flow
    if (fromLesson && !exerciseCompleteSentRef.current) {
      exerciseCompleteSentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: { exerciseSlug: 'minimal-pairs', results },
        }));
        navigate(returnTo, { state: { resuming: true }, replace: true });
      }, 400);
    }
  }, [fromLesson, navigate]);
  
  const handleTrialComplete = useCallback((trialData: {
    targetWord: string;
    selectedWord: string;
    isCorrect: boolean;
    pair: { word1: string; word2: string };
    echoAttempted?: boolean;
    echoTranscript?: string;
  }) => {
    // NOTE: startTrial() is fired on trial appearance (see handleTrialStart),
    // not here — calling it on completion was double-counting and contributed
    // to a runaway logging loop.
    logTrial({
      correct: trialData.isCorrect,
      reactionTimeMs: 0,
      errorType: trialData.isCorrect ? undefined : 'phoneme_discrimination',
      taskParameters: {
        target_word: trialData.targetWord,
        selected_word: trialData.selectedWord,
        pair: trialData.pair,
        echo_attempted: !!trialData.echoAttempted,
        echo_transcript: trialData.echoTranscript ?? null,
        ...adaptationTelemetry,
      },
    });
  }, [logTrial, adaptationTelemetry]);

  const handleTrialStart = useCallback(() => {
    startTrial();
  }, [startTrial]);
  
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {fromLesson ? 'Back to Lesson' : 'Back'}
          </Button>
          
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Ear className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Minimal Pairs Practice</CardTitle>
              <p className="text-muted-foreground mt-2">
                Train your ear to distinguish between similar sounds
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Adaptation info */}
              {adaptation.focusPhonemes.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-3 text-sm">
                  <span className="font-medium">Targeting sounds: </span>
                  {adaptation.focusPhonemes.join(', ')}
                </div>
              )}
              
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4" />
                  How It Works
                </h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>You'll hear a word spoken aloud</li>
                  <li>Two similar pictures will appear side by side</li>
                  <li>Tap the picture that matches the word you heard</li>
                  <li>Learn the difference between similar sounds!</li>
                </ol>
              </div>
              
              <div className="flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Available Pairs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{Object.keys(stats.byCategory).length}</div>
                  <div className="text-xs text-muted-foreground">Contrast Types</div>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Example pairs you'll practice:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">cat / hat</Badge>
                  <Badge variant="secondary">fan / van</Badge>
                  <Badge variant="secondary">ship / chip</Badge>
                  <Badge variant="secondary">goat / coat</Badge>
                </div>
              </div>
              
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => setIsStarted(true)}
                disabled={stats.total === 0}
              >
                Start Practice
              </Button>
              
              {stats.total === 0 && (
                <p className="text-sm text-destructive text-center">
                  No minimal pairs available. Add more photos to the photo bank.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${fromLesson ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background flex flex-col`}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-lg font-semibold">👂 Minimal Pairs</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/today')}>
            <Home className="h-4 w-4" />
          </Button>
        </div>
        {fromLesson && <InlineSessionProgress />}
      </header>

      <main className={`container px-4 ${fromLesson ? 'py-2 flex-1 min-h-0 overflow-auto' : 'py-4 md:py-8'}`}>
        <div className="max-w-2xl mx-auto">
          <MinimalPairsGame
            difficulty={difficulty}
            sessionId={sessionId}
            totalTrials={Math.min(stats.total, 10)}
            focusPhonemes={adaptation.focusPhonemes.length > 0 ? adaptation.focusPhonemes : undefined}
            onComplete={handleComplete}
            onTrialComplete={handleTrialComplete}
          />
        </div>
      </main>
      {fromLesson && <SessionSidePanel />}
    </div>
  );
}
