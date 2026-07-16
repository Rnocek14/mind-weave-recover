/**
 * Progress — Patient-friendly recovery stats
 * 
 * Lightweight view showing streak, session count, and week calendar.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Award, MessageCircle, Loader2, TrendingUp } from 'lucide-react';
import { PatientTabBar } from '@/components/PatientTabBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { SessionAdherenceTracker } from '@/components/SessionAdherenceTracker';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';

interface ProgressStats {
  totalSessions: number;
  currentStreak: number;
  totalWords: number;
}

async function loadProgressStats(userId: string, profileId?: string | null): Promise<ProgressStats> {
  // Source-of-truth = `sessions` table; count completed lesson flows (multi-block).
  // MUST be scoped to the active profile to avoid cross-profile leakage.
  let query = supabase
    .from('sessions')
    .select('ended_at, plan, summary')
    .eq('user_id', userId)
    .eq('ended_reason', 'completed')
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1000);
  if (profileId) query = query.eq('profile_id', profileId);
  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return { totalSessions: 0, currentStreak: 0, totalWords: 0 };
  }

  const lessonFlows = data.filter((row: any) => {
    const blocks = row?.plan?.blocks;
    return Array.isArray(blocks) && blocks.length > 1;
  });

  const totalSessions = lessonFlows.length;

  // Streak
  const toDay = (ts: string) => Math.floor(Date.parse(ts) / 86400000);
  const uniqueDays = [...new Set(lessonFlows.map((r: any) => toDay(r.ended_at)))].sort((a, b) => b - a);
  const today = toDay(new Date().toISOString());

  let currentStreak = 0;
  if (uniqueDays[0] === today || uniqueDays[0] === today - 1) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (uniqueDays[i - 1] - uniqueDays[i] === 1) {
        currentStreak++;
      } else break;
    }
  }

  // Total words — sum any wordsProduced/score totals from summary if present.
  const totalWords = lessonFlows.reduce((sum, r: any) => {
    const s = r?.summary;
    return sum + (s?.wordsProduced || s?.scores?.wordsProduced || 0);
  }, 0);

  return { totalSessions, currentStreak, totalWords };
}

export default function Progress() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.id) {
      loadProgressStats(user.id, activeProfile?.id).then(s => {
        setStats(s);
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [user?.id, activeProfile?.id]);

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const trend = stats && stats.totalSessions >= 3
    ? stats.currentStreak >= 3 ? "You're building great momentum!" : "Keep going — consistency is key."
    : stats && stats.totalSessions > 0
      ? "Every session counts. Keep it up!"
      : "Complete your first session to start tracking progress.";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-44">
      <header className="p-4 flex items-center gap-3 border-b">
        <Button variant="ghost" size="icon" aria-label="Back to home" onClick={() => navigate("/today")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Your Progress</h1>
      </header>

      <div className="flex-1 p-6 max-w-md mx-auto w-full space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-4 text-center space-y-1">
            <Flame className="w-5 h-5 text-primary mx-auto" />
            <p className="text-2xl font-bold">{stats?.currentStreak ?? 0}</p>
            <p className="text-xs text-muted-foreground">Day streak</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center space-y-1">
            <Award className="w-5 h-5 text-primary mx-auto" />
            <p className="text-2xl font-bold">{stats?.totalSessions ?? 0}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center space-y-1">
            <MessageCircle className="w-5 h-5 text-primary mx-auto" />
            <p className="text-2xl font-bold">{stats?.totalWords ?? 0}</p>
            <p className="text-xs text-muted-foreground">Words</p>
          </div>
        </div>

        {/* Trend line */}
        <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 rounded-xl">
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-foreground">{trend}</p>
        </div>

        {/* Week calendar — reuse existing component */}
        <SessionAdherenceTracker 
          userId={user.id} 
          currentStreak={stats?.currentStreak ?? 0} 
        />

        {/* CTA — /today is the real practice launcher (/smart-coach is a retired
            redirect to /today). */}
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate('/today')}
        >
          Start a session
        </Button>
      </div>

      <PatientTabBar />
    </div>
  );
}
