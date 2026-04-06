/**
 * Today — Daily Session Launcher
 * 
 * Single-purpose screen: one button to start today's practice.
 * Shows streak, session count, and last session context.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, Loader2, Calendar, Zap, Flame, Award, Gamepad2, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { loadLastSessionSummary } from '@/lib/smartCoach/progressNarrative';
import { supabase } from '@/integrations/supabase/client';

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

  // Calculate streak from unique days
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

export default function Today() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [lastSession, setLastSession] = useState<{ topic: string; wordsProduced: number; date: string } | null>(null);
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
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

          {/* Main CTA */}
          <Button 
            size="lg" 
            className="w-full gap-2 text-base py-6" 
            onClick={() => navigate('/smart-coach')}
          >
            <Zap className="w-5 h-5" />
            {stats && stats.totalSessions > 0
              ? `Start session #${sessionNumber}`
              : "Start today's practice"}
            <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Secondary options */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => navigate('/practice')}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-border
                hover:border-primary hover:bg-accent/50 active:scale-[0.97]
                transition-all duration-150 ease-out touch-manipulation text-left"
            >
              <Gamepad2 className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-sm font-medium text-foreground block">Practice Games</span>
                <span className="text-[11px] text-muted-foreground">Pick an exercise</span>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-border
                hover:border-primary hover:bg-accent/50 active:scale-[0.97]
                transition-all duration-150 ease-out touch-manipulation text-left"
            >
              <LayoutDashboard className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-sm font-medium text-foreground block">Daily Session</span>
                <span className="text-[11px] text-muted-foreground">Adaptive lesson plan</span>
              </div>
            </button>
          </div>

          {/* Progress link */}
          <div className="flex justify-center pt-1">
            <button 
              onClick={() => navigate('/progress')} 
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" />
              View progress
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
