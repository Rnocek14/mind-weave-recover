import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Play, Pause, RotateCcw, CheckCircle2, 
  Volume2, Trophy, TrendingUp, HelpCircle, SkipForward, XCircle 
} from "lucide-react";
import { ExerciseBackButton } from "@/components/ExerciseBackButton";
import { useToast } from "@/hooks/use-toast";
import { RestPrompt } from "@/components/RestPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useExerciseDifficulty } from "@/hooks/useExerciseDifficulty";
import { useExerciseTelemetry } from "@/hooks/useExerciseTelemetry";
import { useEngagementMonitor } from "@/hooks/useEngagementMonitor";
import { startSession } from "@/lib/sessionTracking";
import { PhotoNamingGame } from "@/components/PhotoNamingGame";
import { ReachTapGame } from "@/components/ReachTapGame";
import { PhrasePracticeGame, type PhrasePracticeGameHandle } from "@/components/PhrasePracticeGame";
import { SessionSummaryCard } from "@/components/SessionSummaryCard";
import { StrokeProfileWidget } from "@/components/StrokeProfileWidget";
import { GeneralizationProbe } from "@/components/GeneralizationProbe";
import { ConfidenceBoost } from "@/components/ConfidenceBoost";
import { BreakPrompt } from "@/components/BreakPrompt";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { supabase } from "@/integrations/supabase/client";
import { shouldRunProbe } from "@/data/probeWords";
import type { ProbeResult } from "@/hooks/useGeneralizationProbe";
import { MoodCheckIn } from "@/components/MoodCheckIn";
import { DoseCapWarning } from "@/components/DoseCapWarning";
import { useDoseCap } from "@/hooks/useDoseCap";
import { useSessionAdaptation } from "@/hooks/useSessionAdaptation";
import { buildAdaptationTelemetry } from "@/lib/adaptationTelemetry";
import { useRestoredLessonContext } from "@/hooks/useRestoredLessonContext";
import { useActiveProfileId } from "@/hooks/useActiveProfileId";

const Exercise = () => {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const activeProfileId = useActiveProfileId();
  
  // Check if we're coming from lesson flow (with sessionStorage fallback)
  const restored = useRestoredLessonContext(exerciseId || 'unknown');
  const { fromLesson, returnTo } = restored;
  const lessonSessionId = restored.sessionId ?? (location.state?.sessionId as string | undefined);
  const lessonAdaptations = location.state?.adaptations as {
    timeoutMultiplier?: number;
    startDifficulty?: number;
    largeTargets?: boolean;
    slowerTTS?: boolean;
    sessionDurationCap?: number;
  } | undefined;
  const lessonFocusWords = location.state?.focusWords as string[] | undefined;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const autoStartedRef = useRef(false);
  const hasDispatchedCompleteRef = useRef(false);
  const phraseGameRef = useRef<PhrasePracticeGameHandle>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [score, setScore] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showRestPrompt, setShowRestPrompt] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [showProbe, setShowProbe] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastProbeSession, setLastProbeSession] = useState<number | null>(null);
  const [showConfidenceBoost, setShowConfidenceBoost] = useState(false);
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [isPausedOverlay, setIsPausedOverlay] = useState(false);
  const [todayStats, setTodayStats] = useState({ correct: 0, total: 0, weeklyAccuracy: 0, improvement: 0 });
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false);
  const [preMood, setPreMood] = useState<number | null>(null);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(0);

  const totalRounds = 20;
  const { doseCap, refresh: refreshDoseCap } = useDoseCap(user?.id);
  
  const { level, stepDown, saveLevel } = useExerciseDifficulty(user?.id, undefined, exerciseId || "photo-naming");
  const { startTrial, logTrial, calculateReactionTime, reset: resetTelemetry } = useExerciseTelemetry(
    sessionId,
    exerciseId || "photo-naming"
  );
  const { 
    recordTrial, 
    trackBehavior, 
    getState, 
    getEngagementFlags, 
    logIntervention, 
    reset: resetEngagement 
  } = useEngagementMonitor(sessionId);

  // Shared adaptation contract for exercises rendered in this component
  const adaptation = useSessionAdaptation({
    lessonAdaptations: lessonAdaptations as Record<string, any> | undefined,
    defaultErrorType: 'no_response',
  });
  const adaptationTelemetry = buildAdaptationTelemetry(adaptation);

  // Fetch today's stats for confidence boost
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id || !sessionId) return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        let sessionsQuery = supabase
          .from('sessions')
          .select('id')
          .eq('user_id', user.id)
          .gte('started_at', `${today}T00:00:00`)
          .lte('started_at', `${today}T23:59:59`);
        if (activeProfileId) sessionsQuery = sessionsQuery.eq('profile_id', activeProfileId);
        const { data: sessions } = await sessionsQuery;
        
        const sessionIds = sessions?.map(s => s.id) || [];
        if (sessionIds.length === 0) return;
        
        const { data: events } = await supabase
          .from('exercise_events')
          .select('score')
          .in('session_id', sessionIds);
        
        const total = events?.length || 0;
        const correct = events?.filter(e => e.score > 0).length || 0;
        
        setTodayStats(prev => ({ ...prev, correct, total }));
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    
    fetchStats();
  }, [user?.id, sessionId, currentRound, activeProfileId]);

  // Mock exercise data
  const exercises: Record<string, any> = {
    "photo-naming": {
      title: "Name That Photo",
      instruction: "Say the name of the object you see",
      type: "speech"
    },
    "reach-tap": {
      title: "Reach & Tap",
      instruction: "Tap the highlighted targets as quickly as you can",
      type: "motor"
    },
    "word-practice": {
      title: "Phrase Practice",
      instruction: "Practice saying functional phrases for daily communication",
      type: "speech"
    },
    "left-side-hunt": {
      title: "Left-Side Hunt",
      instruction: "Find and tap targets on the left side of the screen",
      type: "attention"
    }
  };

  const exercise = exercises[exerciseId || ""] || exercises["photo-naming"];

  // Fetch clinical profile and session count
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('clinical_profile')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        if (data?.clinical_profile) {
          setClinicalProfile(data.clinical_profile as unknown as ClinicalProfile);
        }
      } catch (error) {
        console.error('Error fetching clinical profile:', error);
      }
    };

    const fetchSessionCount = async () => {
      if (!user?.id || !exerciseId) return;
      
      try {
        // Count total sessions for this exercise
        const { count, error } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (error) throw error;
        setSessionCount(count || 0);
        
        // Check when last probe was run (stored in session metadata)
        const { data: lastProbeData } = await supabase
          .from('sessions')
          .select('summary')
          .eq('user_id', user.id)
          .not('summary->last_probe_session', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lastProbeData?.summary && typeof lastProbeData.summary === 'object' && 'last_probe_session' in lastProbeData.summary) {
          setLastProbeSession(lastProbeData.summary.last_probe_session as number);
        }
      } catch (error) {
        console.error('Error fetching session count:', error);
      }
    };

    fetchProfile();
    fetchSessionCount();
  }, [user?.id, exerciseId]);

  // Resume embedded game when isPlaying transitions back to true
  useEffect(() => {
    if (isPlaying && exerciseId === 'word-practice' && phraseGameRef.current) {
      phraseGameRef.current.resume();
    }
  }, [isPlaying, exerciseId]);

  useEffect(() => {
    const usesEmbeddedRoundFlow = exerciseId === 'reach-tap' || exerciseId === 'left-side-hunt' || exerciseId === 'photo-naming' || exerciseId === 'word-practice';

    if (isPlaying && !usesEmbeddedRoundFlow) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            handleRoundComplete();
            return 0;
          }
          return prev + 2;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [isPlaying, currentRound, exerciseId]);

  const handleRoundComplete = async (wasCorrect: boolean = true) => {
    // Calculate reaction time from when trial started
    const reactionTime = calculateReactionTime();
    
    // Record trial in engagement monitor
    const engagementState = recordTrial({
      correct: wasCorrect,
      reactionTimeMs: reactionTime,
      timeout: false,
      cueLevel: 0,
      timestamp: Date.now()
    });

    // Log telemetry with rich data including engagement flags
    await logTrial({
      correct: wasCorrect,
      reactionTimeMs: reactionTime,
      cueLevel: 0,
      errorType: wasCorrect ? undefined : 'mock_error',
      taskParameters: {
        difficulty_level: level,
        round: currentRound,
        exercise_type: exercise.type,
      },
      engagementFlags: getEngagementFlags()
    });

    const roundScore = Math.floor(Math.random() * 20) + 80; // 80-100
    setScore(prev => prev + roundScore);
    
    // Engagement interventions disabled - were interrupting sessions
    // Keeping engagement tracking for analytics but not triggering UI interruptions
    // Users can end session voluntarily via the End button
    
    if (currentRound >= totalRounds) {
      setIsPlaying(false);
      setShowResult(true);
      
      toast({
        title: "Exercise Complete! 🎉",
        description: `Great job! You scored ${score + roundScore} points`
      });
    } else {
      setCurrentRound(prev => prev + 1);
      setProgress(0);
      // Start timing the next trial
      startTrial();
    }
  };

  // Save engagement summary when session ends
  useEffect(() => {
    const saveEngagementSummary = async () => {
      if (!showResult || !sessionId) return;
      
      try {
        const engagementState = getState();
        const flags = getEngagementFlags();
        const engagementSummary = {
          frustration: engagementState.frustration,
          fatigue: engagementState.fatigue,
          intervention_count: flags.interventionCount || 0,
          recommended_action: engagementState.recommendedAction || 'none',
          confidence: engagementState.confidence || 0
        };

        const { error } = await supabase
          .from('sessions')
          .update({ engagement_summary: engagementSummary })
          .eq('id', sessionId);

        if (error) {
          console.error('Error saving engagement summary:', error);
        } else {
          console.log('Engagement summary saved:', engagementSummary);
        }
      } catch (error) {
        console.error('Error in saveEngagementSummary:', error);
      }
    };

    if (showResult && sessionId) {
      saveEngagementSummary();
    }
  }, [showResult, sessionId]);

  // Handle lesson-mode completion via effect (not during render)
  useEffect(() => {
    if (showResult && fromLesson && !hasDispatchedCompleteRef.current) {
      hasDispatchedCompleteRef.current = true;
      console.log('[Exercise] Dispatching exercise-complete event');
      window.dispatchEvent(new CustomEvent('exercise-complete'));
      navigate(returnTo, { state: { resuming: true }, replace: true });
    }
  }, [showResult, fromLesson, navigate]);

  // Track session duration for dose cap warnings
  useEffect(() => {
    if (!isPlaying || !sessionStartTime) return;

    const interval = setInterval(() => {
      const elapsedMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);
      setSessionDurationMinutes(elapsedMinutes);
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [isPlaying, sessionStartTime]);

  const startExercise = async (moodOverride?: number) => {
    // Check dose cap before allowing start — skip when already in a lesson session
    if (!fromLesson && doseCap.enforceCaps && !doseCap.canStartSession) {
      toast({
        title: "Daily Practice Limit Reached",
        description: `You've already practiced for ${doseCap.todayMinutes} minutes today. Great work! Rest is important for recovery.`,
        variant: "default"
      });
      navigate("/today");
      return;
    }

    // Use override or existing mood value
    const effectiveMood = moodOverride ?? preMood;

    // Skip mood check-in when in lesson mode
    if (!effectiveMood && !fromLesson) {
      setShowMoodCheckIn(true);
      return;
    }
    
    // Check if we should run a probe first (only for photo-naming, not phrase practice)
    const newSessionCount = sessionCount + 1;
    const shouldProbe = shouldRunProbe(newSessionCount, lastProbeSession);
    
    if (shouldProbe && exerciseId === 'photo-naming' && !fromLesson) {
      setShowProbe(true);
      return;
    }
    
    setIsPlaying(true);
    setShowResult(false);
    
    // Initialize session tracking
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
      
      // Use lesson session if coming from lesson flow
      if (fromLesson && lessonSessionId) {
        console.log('[Exercise] Using lesson sessionId:', lessonSessionId);
        setSessionId(lessonSessionId);
      } else if (user?.id) {
        // Create new session
        try {
          const session = await startSession(user.id, {
            blocks: [
              {
                exercise: exerciseId || "photo-naming",
                duration: totalRounds,
              },
            ],
          });
          setSessionId(session.id);
          
          // Update session with mood rating
          if (preMood) {
            await supabase
              .from('sessions')
              .update({ mood_rating: preMood })
              .eq('id', session.id);
          }
        } catch (error) {
          console.error('Error starting session:', error);
        }
      }
    }
    
    // Start timing the first trial
    startTrial();
  };

  // Auto-start when coming from lesson flow (skip the "Start Exercise" gate)
  useEffect(() => {
    if (fromLesson && !isPlaying && !autoStartedRef.current) {
      autoStartedRef.current = true;
      startExercise();
    }
  }, [fromLesson]);

  const handleMoodSelect = (mood: number) => {
    setPreMood(mood);
    setShowMoodCheckIn(false);
    // Pass mood directly to avoid stale closure
    setTimeout(() => startExercise(mood), 100);
  };

  const handleSessionEnd = async () => {
    if (sessionId && preMood) {
      // Store post-session mood in summary
      const { data: session } = await supabase
        .from('sessions')
        .select('summary')
        .eq('id', sessionId)
        .single();
      
      const updatedSummary = {
        ...(session?.summary as any || {}),
        post_mood: preMood // Could prompt for post-mood, but for now use same
      };
      
      await supabase
        .from('sessions')
        .update({ summary: updatedSummary })
        .eq('id', sessionId);
    }
    
    await refreshDoseCap();
    setShowResult(true);
  };

  const handleProbeComplete = async (results: ProbeResult[]) => {
    // Store probe results in database
    if (user?.id) {
      try {
        const probeData = results.map(result => ({
          user_id: user.id,
          session_id: sessionId,
          probe_word: result.word,
          target_difficulty: result.difficulty,
          correct: result.correct,
          error_type: result.errorType,
          cues_needed: result.cuesNeeded,
          reaction_time_ms: result.reactionTimeMs
        }));
        
        // Insert probe results into database
        // Using any cast temporarily until Supabase types are regenerated
        const { error } = await (supabase as any)
          .from('probe_results')
          .insert(probeData);
        
        if (error) {
          console.error('Error storing probe results:', error);
          toast({
            title: "Warning",
            description: "Probe results saved locally but couldn't sync to database",
            variant: "destructive"
          });
        } else {
          console.log('Probe results saved successfully:', probeData);
        }
        
        // Update last probe session count
        const newSessionCount = sessionCount + 1;
        setLastProbeSession(newSessionCount);
        
      } catch (error) {
        console.error('Error storing probe results:', error);
      }
    }
    
    // Now start the regular exercise
    setShowProbe(false);
    setIsPlaying(true);
    setShowResult(false);
    
    // Initialize session tracking
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());

      // Reuse lesson session if present (prevents duplicate session rows)
      if (fromLesson && lessonSessionId) {
        console.log('[Exercise/probe] Reusing lesson sessionId:', lessonSessionId);
        setSessionId(lessonSessionId);
      } else if (user?.id) {
        try {
          const session = await startSession(user.id, {
            blocks: [
              {
                exercise: exerciseId || "photo-naming",
                duration: totalRounds,
              },
            ],
          });
          setSessionId(session.id);
        } catch (error) {
          console.error('Error starting session:', error);
        }
      }
    }
    
    startTrial();
  };

  const handleProbeSkip = () => {
    setShowProbe(false);
    // Continue to exercise
    startExercise();
  };

  // Rest prompt disabled - was interrupting sessions after 10 minutes
  // Users can end session voluntarily via the End button

  const resetExercise = () => {
    setIsPlaying(false);
    setCurrentRound(1);
    setScore(0);
    setProgress(0);
    setShowResult(false);
    setSessionStartTime(null);
    setSessionId(null);
    setPreMood(null);
    resetTelemetry();
  };

  const handleSkipExercise = async () => {
    // Log skip analytics with clinical profile snapshot
    if (user?.id && exerciseId) {
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
          exercise_slug: exerciseId,
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
    navigate(returnTo, { state: { resuming: true } });
  };

  // Show mood check-in first
  if (showMoodCheckIn) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center px-4 py-8">
        <MoodCheckIn 
          type="pre" 
          onMoodSelect={handleMoodSelect}
        />
      </div>
    );
  }

  if (showProbe) {
    return <GeneralizationProbe 
      difficultyLevel={level}
      onComplete={handleProbeComplete}
      onSkip={handleProbeSkip}
    />;
  }

  if (showRestPrompt) {
    return (
      <RestPrompt
        onContinue={() => {
          setShowRestPrompt(false);
          setIsPlaying(true);
        }}
        onEnd={() => {
          setShowRestPrompt(false);
          setShowResult(true);
        }}
      />
    );
  }

  if (showResult) {
    if (fromLesson) {
      // Effect above handles navigation — show nothing while it fires
      return null;
    }
    
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full space-y-6 animate-slide-up">
          <Card className="p-8 shadow-glow text-center">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-celebrate flex items-center justify-center mb-6 animate-celebrate">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold mb-2">Excellent Work!</h2>
            <p className="text-muted-foreground mb-8">
              You&apos;ve completed today&apos;s {exercise.title} session
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-muted rounded-lg p-4">
                <div className="text-3xl font-bold text-primary">{score}</div>
                <div className="text-sm text-muted-foreground">Total Score</div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-3xl font-bold text-success">{totalRounds}</div>
                <div className="text-sm text-muted-foreground">Rounds</div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-healing" 
                size="lg"
                onClick={resetExercise}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
              <ExerciseBackButton 
                defaultTo="/dashboard"
                className="w-full"
              />
            </div>
          </Card>

          {/* Session Summary Analytics */}
          <SessionSummaryCard sessionId={sessionId} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-gradient-calm flex flex-col">
      {/* Intervention Modals */}
      <ConfidenceBoost
        open={showConfidenceBoost}
        onClose={() => setShowConfidenceBoost(false)}
        onContinue={() => {
          logIntervention('frustration', 'confidence_boost', 'accepted');
          setIsPlaying(true);
        }}
        onSwitchExercise={() => navigate("/today")}
        stats={todayStats}
      />
      
      <BreakPrompt
        open={showBreakPrompt}
        onClose={() => setShowBreakPrompt(false)}
        onContinue={() => {
          logIntervention('fatigue', 'break_prompt', 'accepted');
          setIsPlaying(true);
        }}
        onEndSession={() => {
          logIntervention('fatigue', 'break_prompt', 'end_session');
          setShowResult(true);
        }}
      />

      <div className={`container mx-auto max-w-4xl px-2 sm:px-4 ${fromLesson ? 'py-1' : 'py-2 sm:py-4'} flex-1 flex flex-col min-h-0 ${isPlaying && !fromLesson ? 'pb-24' : ''}`}>
        {/* Compact navigation */}
        <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-4">
          <ExerciseBackButton 
            defaultTo="/dashboard"
            className="px-2 sm:px-3"
          />
          
          {fromLesson && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkipExercise}
              className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950 px-2 sm:px-3"
            >
              <SkipForward className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Skip</span>
            </Button>
          )}
        </div>

        {/* Debug badges for active adaptations - hide in session mode */}
        {!fromLesson && (() => {
          const badges = [
            lessonAdaptations?.timeoutMultiplier && lessonAdaptations.timeoutMultiplier !== 1
              ? `Timeout ×${lessonAdaptations.timeoutMultiplier}` : null,
            lessonAdaptations?.startDifficulty ? `Start Lv ${lessonAdaptations.startDifficulty}` : null,
            lessonAdaptations?.largeTargets ? 'Large Targets' : null,
            lessonAdaptations?.slowerTTS ? 'Slower TTS' : null,
            lessonAdaptations?.sessionDurationCap ? `Cap ${lessonAdaptations.sessionDurationCap}min` : null,
          ].filter(Boolean) as string[];

          const targetSource = lessonFocusWords?.length ? 'Lesson' : null;
          
          if (lessonFocusWords?.length) {
            badges.push(`${targetSource} Targets: ${lessonFocusWords.slice(0, 3).join(', ')}${lessonFocusWords.length > 3 ? ` +${lessonFocusWords.length - 3}` : ''}`);
          }

          return badges.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {badges.map(b => (
                <Badge key={b} variant="secondary">{b}</Badge>
              ))}
            </div>
          ) : null;
        })()}

        {/* Clinical Profile Widget - hidden on mobile and in session mode */}
        {!fromLesson && clinicalProfile && (
          <div className="hidden md:block mb-4">
            <StrokeProfileWidget profile={clinicalProfile} />
          </div>
        )}

        {/* Dose Cap Warning */}
        {isPlaying && doseCap.enforceCaps && (doseCap.warningLevel === 'warning' || doseCap.warningLevel === 'limit') && (
          <div className="mb-2 sm:mb-4">
            <DoseCapWarning
              minutesPracticed={doseCap.todayMinutes + sessionDurationMinutes}
              dailyCapMinutes={doseCap.dailyCapMinutes}
              sessionCapMinutes={doseCap.sessionCapMinutes}
              onEndSession={async () => {
                await handleSessionEnd();
              }}
              type={doseCap.warningLevel}
            />
          </div>
        )}

        {/* Compact Header - slimmer in session mode */}
        <Card className={`${fromLesson ? 'p-2 mb-1' : 'p-3 sm:p-4 md:p-6 mb-2 sm:mb-4'} shadow-card shrink-0`}>
          <div className={`flex justify-between items-start ${fromLesson ? 'mb-1' : 'mb-2 sm:mb-4'}`}>
            <div className="flex-1 min-w-0">
              <h1 className={`${fromLesson ? 'text-base' : 'text-lg sm:text-2xl md:text-3xl'} font-bold mb-0.5 truncate`}>
                {exercise.title}
              </h1>
              {!fromLesson && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                  <Volume2 className="w-4 h-4 shrink-0 hidden sm:block" />
                  <p className="truncate">{exercise.instruction}</p>
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-2">
              <div className={`${fromLesson ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-primary`}>{score}</div>
              <div className="text-xs text-muted-foreground">Score</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">
                Round {currentRound} of {totalRounds}
              </span>
              <span className="font-medium text-primary">
                {Math.round((currentRound / totalRounds) * 100)}%
              </span>
            </div>
            <Progress value={(currentRound / totalRounds) * 100} className="h-1.5" />
          </div>
        </Card>

        {/* Exercise Area - fills remaining space */}
        <Card className={`${fromLesson ? 'p-2 sm:p-4' : 'p-4 sm:p-8 md:p-12'} mb-1 shadow-card flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden`}>
          {!isPlaying ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-healing flex items-center justify-center animate-pulse-glow">
                <Play className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-1">Ready to Begin?</h3>
                <p className="text-sm text-muted-foreground">
                  Take your time and do your best.
                </p>
              </div>
              <Button 
                size="lg" 
                className="bg-gradient-healing text-base px-8 py-5"
                onClick={() => startExercise()}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Exercise
              </Button>
            </div>
          ) : exerciseId === 'reach-tap' ? (
            <ReachTapGame
              totalTrials={totalRounds}
              initialDifficulty={lessonAdaptations?.startDifficulty || level}
              slowMode={lessonAdaptations?.largeTargets || true} // largeTargets → slowMode (larger targets + longer timeouts)
              userId={user?.id}
              sessionId={sessionId}
              onTrialComplete={async (result) => {
                await logTrial({
                  correct: result.correct,
                  reactionTimeMs: result.reactionTimeMs,
                  cueLevel: 0, // Motor exercise doesn't use cues
                  errorType: result.correct ? undefined : 'timeout',
                  taskParameters: {
                    difficulty_level: result.difficultyLevel,
                    target_size: result.targetSize,
                    target_side: result.targetSide,
                    round: currentRound,
                    exercise_type: 'reach-tap',
                    adaptations_active: lessonAdaptations || {},
                  },
                });
                
                // Move to next round
                if (currentRound < totalRounds) {
                  setCurrentRound((prev) => prev + 1);
                  if (result.correct) {
                    setScore((prev) => prev + 100);
                  }
                  startTrial();
                }
              }}
              onGameComplete={(finalScore) => {
                setScore(finalScore);
                setIsPlaying(false);
                setShowResult(true);
              }}
              onDifficultyChange={(newLevel, reason) => {
                toast({
                  title: "Difficulty Adjusted",
                  description: reason,
                  duration: 2000,
                });
              }}
            />
          ) : exerciseId === 'photo-naming' ? (
            <PhotoNamingGame
              totalTrials={totalRounds}
              initialDifficulty={level}
              onTrialComplete={async (result) => {
                await logTrial({
                  correct: result.correct,
                  reactionTimeMs: result.reactionTimeMs,
                  cueLevel: result.cueLevel,
                  errorType: result.errorType,
                  errorClassification: result.errorClassification,
                  taskParameters: {
                    difficulty_level: result.difficultyLevel,
                    cue_level: result.cueLevel,
                    round: currentRound,
                    exercise_type: 'photo-naming',
                  },
                });
                
                if (currentRound < totalRounds) {
                  setCurrentRound((prev) => prev + 1);
                  if (result.correct) {
                    setScore((prev) => prev + 100);
                  }
                  startTrial();
                }
              }}
              onGameComplete={(finalScore) => {
                setScore(finalScore);
                setIsPlaying(false);
                setShowResult(true);
              }}
              onDifficultyChange={(newLevel, reason) => {
                toast({
                  title: "Difficulty Adjusted",
                  description: reason,
                  duration: 2000,
                });
              }}
            />
          ) : exerciseId === 'word-practice' ? (
            <PhrasePracticeGame
              ref={phraseGameRef}
              sessionId={sessionId}
              totalTrials={totalRounds}
              initialDifficulty={level}
              onTrialComplete={async (result) => {
                await logTrial({
                  correct: result.correct,
                  reactionTimeMs: result.timeMs,
                  cueLevel: result.cueLevel,
                  errorType: result.correct ? undefined : 'incorrect',
                  taskParameters: {
                    difficulty_level: result.difficulty,
                    phrase_id: result.phraseId,
                    word_accuracy: result.wordAccuracy,
                    repetitions: result.repetitions,
                    round: currentRound,
                    exercise_type: 'phrase-practice',
                  },
                });
                
                if (currentRound < totalRounds) {
                  setCurrentRound((prev) => prev + 1);
                  if (result.correct) {
                    setScore((prev) => prev + 100);
                  }
                  startTrial();
                }
              }}
              onGameComplete={(finalScore) => {
                setScore(finalScore);
                setIsPlaying(false);
                setShowResult(true);
              }}
              onDifficultyChange={(newLevel) => {
                saveLevel(newLevel);
                // Toast already shown by useInGameAdaptation inside PhrasePracticeGame
              }}
            />
          ) : exerciseId === 'left-side-hunt' ? (
            <ReachTapGame
              totalTrials={totalRounds}
              initialDifficulty={lessonAdaptations?.startDifficulty || level}
              variant="left-side-hunt"
              slowMode={lessonAdaptations?.largeTargets || true}
              userId={user?.id}
              sessionId={sessionId}
              onTrialComplete={async (result) => {
                await logTrial({
                  correct: result.correct,
                  reactionTimeMs: result.reactionTimeMs,
                  cueLevel: 0,
                  errorType: result.correct ? undefined : 'timeout',
                  taskParameters: {
                    difficulty_level: result.difficultyLevel,
                    target_size: result.targetSize,
                    target_side: result.targetSide,
                    round: currentRound,
                    exercise_type: 'left-side-hunt',
                    adaptations_active: lessonAdaptations || {},
                    ...adaptationTelemetry,
                  },
                });
                
                if (currentRound < totalRounds) {
                  setCurrentRound((prev) => prev + 1);
                  if (result.correct) {
                    setScore((prev) => prev + 100);
                  }
                  startTrial();
                }
              }}
              onGameComplete={(finalScore) => {
                setScore(finalScore);
                setIsPlaying(false);
                setShowResult(true);
              }}
              onDifficultyChange={(newLevel, reason) => {
                toast({
                  title: "Difficulty Adjusted",
                  description: reason,
                  duration: 2000,
                });
              }}
            />
          ) : (
            <div className="w-full space-y-8">
              {/* Fallback for other exercise types */}
              <div className="text-center space-y-6">
                <div className="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center border-4 border-primary shadow-glow">
                  <span className="text-6xl">🏠</span>
                </div>
                <p className="text-xl font-medium">
                  What is this object?
                </p>
                <Progress value={progress} className="h-4" />
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Round {currentRound} in progress...
              </div>
            </div>
          )}
        </Card>

        {/* Tips - hide during active play, in session mode, and on the Ready screen to keep CTA visible */}
        {false && !fromLesson && !isPlaying && (
          <Card className="p-6 shadow-card border-l-4 border-success">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              Tips for Success
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Take your time - accuracy is more important than speed</li>
              <li>• Say the words out loud, even if quietly</li>
              <li>• Don't worry about mistakes - every attempt helps you improve</li>
              <li>• Take breaks if you feel tired</li>
            </ul>
          </Card>
        )}

        {/* Pause Overlay */}
        {isPausedOverlay && isPlaying && (
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
            <Pause className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Paused</h2>
            <p className="text-muted-foreground text-center max-w-sm">
              Take your time. Press Resume when you're ready to continue.
            </p>
            <div className="flex gap-3">
              <Button
                size="lg"
                onClick={() => {
                  setIsPausedOverlay(false);
                  if (exerciseId === 'word-practice' && phraseGameRef.current) {
                    phraseGameRef.current.resume();
                  }
                }}
              >
                <Play className="w-5 h-5 mr-2" />
                Resume
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={() => {
                  setIsPausedOverlay(false);
                  setIsPlaying(false);
                  navigate("/today");
                }}
              >
                End Session
              </Button>
            </div>
          </div>
        )}

        {/* Fixed Safety Controls - hide in session mode */}
        {isPlaying && !fromLesson && (
          <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t shadow-glow p-2 sm:p-4 z-50">
            <div className="container mx-auto max-w-4xl flex justify-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="min-w-[50px] sm:min-w-[100px] h-12 sm:h-14 text-sm sm:text-base px-2 sm:px-4"
                onClick={() => {
                  const isEmbedded = exerciseId === 'word-practice' || exerciseId === 'photo-naming' || exerciseId === 'reach-tap' || exerciseId === 'left-side-hunt';
                  if (isEmbedded) {
                    if (isPausedOverlay) {
                      // Resume
                      setIsPausedOverlay(false);
                      if (exerciseId === 'word-practice' && phraseGameRef.current) {
                        phraseGameRef.current.resume();
                      }
                    } else {
                      // Pause
                      setIsPausedOverlay(true);
                      if (exerciseId === 'word-practice' && phraseGameRef.current) {
                        phraseGameRef.current.pause();
                      }
                    }
                  } else {
                    setIsPlaying(false);
                  }
                }}
              >
                {isPausedOverlay ? <Play className="w-5 h-5 sm:mr-2" /> : <Pause className="w-5 h-5 sm:mr-2" />}
                <span className="hidden sm:inline">{isPausedOverlay ? 'Resume' : 'Pause'}</span>
              </Button>
              <Button
                className="bg-success min-w-[70px] sm:min-w-[140px] h-12 sm:h-14 text-sm sm:text-base px-2 sm:px-4"
                size="sm"
                onClick={() => {
                  if (exerciseId === 'word-practice' && phraseGameRef.current) {
                    phraseGameRef.current.markCorrect();
                  } else {
                    handleRoundComplete(true);
                  }
                }}
              >
                <CheckCircle2 className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">I Said It!</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="min-w-[60px] sm:min-w-[120px] h-12 sm:h-14 text-sm sm:text-base px-2 sm:px-4"
                onClick={async () => {
                  if (exerciseId === 'word-practice' && phraseGameRef.current) {
                    phraseGameRef.current.skipTooHard();
                  } else {
                    const newLevel = await stepDown(sessionId ?? undefined);
                    toast({
                      title: "Adjusted!",
                      description: `Difficulty lowered to level ${newLevel}`,
                    });
                  }
                }}
                title="We'll make the next step easier"
              >
                <HelpCircle className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Too Hard</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="min-w-[50px] sm:min-w-[100px] h-12 sm:h-14 text-sm sm:text-base px-2 sm:px-4"
                onClick={() => {
                  setIsPlaying(false);
                  navigate("/today");
                }}
              >
                <span className="hidden sm:inline">End</span>
                <XCircle className="w-5 h-5 sm:hidden" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Exercise;
