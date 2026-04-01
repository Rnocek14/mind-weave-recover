import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/hooks/useProfile';
import { humanizeSlug } from '@/lib/performanceAwareFeedback';

interface RecentSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  caregiver_notes: string | null;
  summary: any;
  exercises: { slug: string; count: number; accuracy: number }[];
}

export function RecentSessionsSummary({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !profileId) return;

    const load = async () => {
      try {
        // Fetch last 3 completed sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, started_at, ended_at, duration_sec, caregiver_notes, summary')
          .eq('profile_id', profileId)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(3);

        if (sessionsError || !sessionsData?.length) {
          setSessions([]);
          setLoading(false);
          return;
        }

        // Fetch exercise events for these sessions
        const sessionIds = sessionsData.map(s => s.id);
        const { data: events } = await supabase
          .from('exercise_events')
          .select('session_id, exercise_slug, score')
          .in('session_id', sessionIds);

        const mapped: RecentSession[] = sessionsData.map(s => {
          const sessionEvents = (events || []).filter(e => e.session_id === s.id);
          const bySlug: Record<string, { count: number; correct: number }> = {};
          sessionEvents.forEach(e => {
            const slug = e.exercise_slug || 'unknown';
            if (!bySlug[slug]) bySlug[slug] = { count: 0, correct: 0 };
            bySlug[slug].count++;
            if (e.score && e.score > 0) bySlug[slug].correct++;
          });

          return {
            id: s.id,
            started_at: s.started_at || '',
            ended_at: s.ended_at,
            duration_sec: s.duration_sec,
            caregiver_notes: s.caregiver_notes,
            summary: s.summary,
            exercises: Object.entries(bySlug).map(([slug, data]) => ({
              slug,
              count: data.count,
              accuracy: data.count > 0 ? Math.round((data.correct / data.count) * 100) : 0,
            })),
          };
        });

        setSessions(mapped);
      } catch (err) {
        console.error('[RecentSessionsSummary] error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, profileId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No completed sessions yet.</p>
      </div>
    );
  }

  const formatDuration = (sec: number | null) => {
    if (!sec) return '—';
    if (sec < 60) return `${sec}s`;
    return `${Math.round(sec / 60)}min`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatSlug = (slug: string) => {
    const { humanizeSlug } = require('@/lib/performanceAwareFeedback');
    return humanizeSlug(slug);
  };

  return (
    <div className="space-y-3">
      {sessions.map(session => {
        const avgAccuracy = session.exercises.length > 0
          ? Math.round(session.exercises.reduce((s, e) => s + e.accuracy, 0) / session.exercises.length)
          : null;

        return (
          <Card key={session.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Date + duration */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{formatDate(session.ended_at || session.started_at)}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{formatDuration(session.duration_sec)}</span>
                  {avgAccuracy !== null && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className={`font-medium ${avgAccuracy >= 70 ? 'text-green-600 dark:text-green-400' : avgAccuracy >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                        {avgAccuracy}% acc
                      </span>
                    </>
                  )}
                </div>

                {/* Exercises */}
                <div className="flex flex-wrap gap-1.5">
                  {session.exercises.slice(0, 4).map(ex => (
                    <Badge key={ex.slug} variant="outline" className="text-[10px]">
                      {formatSlug(ex.slug)} ({ex.count})
                    </Badge>
                  ))}
                  {session.exercises.length > 4 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{session.exercises.length - 4} more
                    </Badge>
                  )}
                </div>

                {/* Caregiver notes */}
                {session.caregiver_notes && (
                  <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded bg-muted/50">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {session.caregiver_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Button
        variant="ghost"
        className="w-full gap-1"
        size="sm"
        onClick={() => navigate('/session-history')}
      >
        View Full History
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
