/**
 * Today — Daily Session Launcher (Patient Home)
 * 
 * Single-purpose screen: one button to start today's practice.
 * Shows streak, session count, and coaching mode toggle.
 * Generates a personalized lesson and passes it to /lesson.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, Loader2, Zap, Flame, Award, Brain, Play, X, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PatientTabBar } from '@/components/PatientTabBar';
import { useAuth } from '@/hooks/useAuth';
import { loadLastSessionSummary } from '@/lib/smartCoach/progressNarrative';
import { supabase } from '@/integrations/supabase/client';
import { useCoachingMode, type CoachingMode } from '@/contexts/CoachingModeContext';
import { useProfile } from '@/hooks/useProfile';
import { useDailyLesson } from '@/hooks/useDailyLesson';
import { buildPresetLesson, type LessonPreset } from '@/lib/dailyLessonEngine';
import { ClinicalProfile } from '@/lib/clinicalProfileMapper';
import { cn } from '@/lib/utils';
import { recommendNextSession, type SessionRecommendation } from '@/lib/sessionRecommender';

interface AdherenceStats {
  totalSessions: number;
  currentStreak: number;
}

async function loadAdherenceStats(userId: string): Promise<AdherenceStats> {
  const { data, error } = await supabase
    .from('coach_conversation_summaries')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return { totalSessions: 0, currentStreak: 0 };
  }

  const totalSessions = data.length;
  const toDay = (ts: string) => Math.floor(Date.parse(ts) / 86400000);
  const uniqueDays = [...new Set(data.map(r => toDay(r.created_at)))].sort((a, b) => b - a);
  const today = toDay(new Date().toISOString());

  let currentStreak = 0;
  if (uniqueDays[0] === today || uniqueDays[0] === today - 1) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (uniqueDays[i - 1] - uniqueDays[i] === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { totalSessions, currentStreak };
}

const MODE_OPTIONS: { value: CoachingMode; label: string; desc: string }[] = [
  { value: 'off', label: 'Games only', desc: 'Pure practice, no guidance' },
  { value: 'light', label: 'Guided', desc: 'Purpose + light feedback' },
  { value: 'full', label: 'Full coaching', desc: 'Continuity + reflections' },
];

export default function Today() {
  // All hooks at the top — never after conditionals
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { mode, setMode } = useCoachingMode();
  const { activeProfile } = useProfile();
  const [lastSession, setLastSession] = useState<{ topic: string; wordsProduced: number; date: string } | null>(null);
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const [savedSession, setSavedSession] = useState<{
    currentBlockIndex: number;
    blockCount: number;
    lesson: any;
    clinicalProfile: any;
    sessionId: string | null;
  } | null>(null);

  // Check for in-progress session (from localStorage which persists across navigation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lessonFlowState_resume');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Expire after 4 hours
        if (parsed.savedAt && Date.now() - parsed.savedAt > 4 * 60 * 60 * 1000) {
          localStorage.removeItem('lessonFlowState_resume');
          return;
        }
        if (parsed.lesson && parsed.blockCount && typeof parsed.currentBlockIndex === 'number') {
          setSavedSession({
            currentBlockIndex: parsed.currentBlockIndex,
            blockCount: parsed.blockCount,
            lesson: parsed.lesson,
            clinicalProfile: parsed.clinicalProfile || null,
            sessionId: parsed.sessionId || null,
          });
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Generate the daily lesson
  const { lesson, todayFocus } = useDailyLesson(
    user?.id || undefined,
    activeProfile?.id,
    clinicalProfile
  );

  const currentTab = location.pathname === '/practice' ? 'practice' 
    : location.pathname === '/progress' ? 'progress' 
    : 'home';

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Load clinical profile
  useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('clinical_profile')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.clinical_profile) {
            setClinicalProfile(data.clinical_profile as unknown as ClinicalProfile);
          }
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      Promise.all([
        loadLastSessionSummary(user.id).then(summary => {
          if (summary) {
            setLastSession({
              topic: summary.metadata?.topic || summary.primaryDomain || 'practice',
              wordsProduced: summary.metadata?.metrics?.wordsProduced || 0,
              date: summary.createdAt || '',
            });
          }
        }),
        loadAdherenceStats(user.id).then(setStats),
      ]).finally(() => setLoaded(true));
    }
  }, [user?.id]);

  const handleStartSession = () => {
    if (!lesson) return;
    // Clear any saved session when starting fresh
    sessionStorage.removeItem('lessonFlowState');
    localStorage.removeItem('lessonFlowState_resume');
    setSavedSession(null);
    navigate('/lesson', {
      state: {
        lesson,
        clinicalProfile,
        todayFocus,
        skipDailyCheck: true,
        autoStart: true,
      },
    });
  };

  const handleStartRecommended = (recommendation: SessionRecommendation) => {
    const presetId = recommendation.templateId as LessonPreset;
    const recLesson = buildPresetLesson(presetId);
    if (!recLesson) return;
    sessionStorage.removeItem('lessonFlowState');
    localStorage.removeItem('lessonFlowState_resume');
    setSavedSession(null);
    navigate('/lesson', {
      state: {
        lesson: recLesson,
        clinicalProfile,
        skipDailyCheck: true,
        autoStart: true,
        recommendationReason: recommendation.mayaReason,
      },
    });
  };

  const handleContinueSession = () => {
    if (!savedSession) return;
    // Restore to sessionStorage so LessonFlow can find it
    const resumeData = localStorage.getItem('lessonFlowState_resume');
    if (resumeData) {
      sessionStorage.setItem('lessonFlowState', resumeData);
    }
    navigate('/lesson', {
      state: {
        lesson: savedSession.lesson,
        clinicalProfile: savedSession.clinicalProfile,
        skipDailyCheck: true,
        autoStart: true,
        resuming: true,
      },
    });
  };

  const handleDiscardSession = () => {
    sessionStorage.removeItem('lessonFlowState');
    localStorage.removeItem('lessonFlowState_resume');
    setSavedSession(null);
  };

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.user_metadata?.display_name || 'there';
  const greeting = getGreeting();
  const topicLabel = lastSession?.topic?.replace(/_/g, ' ') || '';
  const sessionNumber = (stats?.totalSessions ?? 0) + 1;
  const lessonReady = !!lesson;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6 pb-20">
        <div className="w-full max-w-sm space-y-6 text-center">
          {/* Greeting */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{greeting}, {displayName}</h1>
            <p className="text-muted-foreground">
              {lastSession
                ? "Ready to build on last time?"
                : "Let's get started with your first session."}
            </p>
          </div>

          {/* Streak + Session count */}
          {stats && stats.totalSessions > 0 && (
            <div className="flex items-center justify-center gap-4">
              {stats.currentStreak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {stats.currentStreak} day{stats.currentStreak !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {stats.totalSessions} session{stats.totalSessions !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Last session context */}
          {lastSession && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Last session
              </p>
              <p className="text-sm text-foreground">
                You practiced{' '}
                <span className="font-medium capitalize">{topicLabel}</span>
                {lastSession.wordsProduced > 0 && (
                  <> and produced {lastSession.wordsProduced} words</>
                )}.
              </p>
              <p className="text-xs text-muted-foreground">
                Today we'll build on that.
              </p>
            </div>
          )}

          {/* Coaching mode toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Brain className="w-3.5 h-3.5" />
              <span>Coaching level</span>
            </div>
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                    mode === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {MODE_OPTIONS.find(o => o.value === mode)?.desc}
            </p>
          </div>

          {/* Resume in-progress session */}
          {savedSession && (
            <div className="bg-accent/50 border border-accent rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Session in progress
                </p>
                <button
                  onClick={handleDiscardSession}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                  title="Discard session"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                You completed {savedSession.currentBlockIndex} of {savedSession.blockCount} exercises.
              </p>
              <Button
                size="lg"
                className="w-full gap-2 text-base py-5"
                onClick={handleContinueSession}
              >
                <Play className="w-5 h-5" />
                Continue session
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Main CTA */}
          <Button 
            size="lg" 
            className="w-full gap-2 text-base py-6" 
            onClick={handleStartSession}
            disabled={!lessonReady}
            variant={savedSession ? 'outline' : 'default'}
          >
            {!lessonReady ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing session...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                {savedSession
                  ? 'Start new session instead'
                  : stats && stats.totalSessions > 0
                    ? `Start session #${sessionNumber}`
                    : "Start today's practice"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          {/* Recommended session — Maya's choice */}
          {mode !== 'off' && !savedSession && (() => {
            const recommendation = recommendNextSession();
            return (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs font-medium text-primary uppercase tracking-wide">
                    Recommended for today
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {recommendation.templateLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {recommendation.reason}
                  </p>
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 text-sm py-5"
                  onClick={() => handleStartRecommended(recommendation)}
                >
                  <Sparkles className="w-4 h-4" />
                  Start recommended session
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            );
          })()}
        </div>
      </div>

      <PatientTabBar />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
