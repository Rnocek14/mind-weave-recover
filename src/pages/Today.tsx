/**
 * Today — Daily Session Launcher
 * 
 * Single-purpose screen: one button to start today's practice.
 * Shows streak, last session context, and readiness — nothing else.
 * 
 * This is the "home screen" for returning users.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, Loader2, Calendar, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { loadLastSessionSummary } from '@/lib/smartCoach/progressNarrative';

export default function Today() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [lastSession, setLastSession] = useState<{ topic: string; wordsProduced: number; date: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.id) {
      loadLastSessionSummary(user.id).then(summary => {
        if (summary) {
          setLastSession({
            topic: summary.topicId || 'practice',
            wordsProduced: summary.metrics?.wordsProduced || 0,
            date: summary.date || '',
          });
        }
        setLoaded(true);
      }).catch(() => setLoaded(true));
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 text-center">
          {/* Greeting */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{greeting}, {displayName}</h1>
            <p className="text-muted-foreground">
              {lastSession
                ? "Ready for today's practice?"
                : "Let's get started with your first session."}
            </p>
          </div>

          {/* Last session context */}
          {lastSession && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Last session
              </p>
              <p className="text-sm text-foreground">
                You produced {lastSession.wordsProduced} words practicing{' '}
                <span className="font-medium capitalize">{lastSession.topic.replace(/_/g, ' ')}</span>.
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
            Start today's practice
            <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Secondary nav */}
          <div className="flex justify-center gap-4 pt-2">
            <button 
              onClick={() => navigate('/recovery-progress')} 
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
