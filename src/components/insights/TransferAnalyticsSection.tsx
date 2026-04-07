/**
 * Transfer Analytics Section
 * 
 * Shows clinician/caregiver-facing transfer metrics:
 * - Transfer rate (% of drills with score 3-4)
 * - Per-word transfer outcomes
 * - Trend over recent sessions
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TransferEvent {
  transferScore: number;
  targets: { value: string; type: string }[];
  label: string;
  createdAt: string;
}

interface TransferStats {
  totalChecks: number;
  spontaneous: number; // score 4
  functional: number;  // score 3
  supported: number;   // score 2
  recognition: number; // score 1
  noTransfer: number;  // score 0
  transferRate: number; // % score >= 3
  topWords: { word: string; bestScore: number; count: number }[];
}

export function TransferAnalyticsSection({ userId }: { userId: string }) {
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransferData = async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_events')
          .select('outputs, inputs, created_at')
          .eq('session_id', userId) // This won't work - need to join through sessions
          .not('task_parameters', 'is', null);

        // Actually query through sessions for this user
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(30);

        if (!sessions || sessions.length === 0) {
          setStats(null);
          setLoading(false);
          return;
        }

        const sessionIds = sessions.map(s => s.id);
        
        const { data: events } = await supabase
          .from('exercise_events')
          .select('outputs, inputs, created_at, task_parameters')
          .in('session_id', sessionIds);

        // Filter to transfer_check events
        const transferEvents = (events || []).filter(e => {
          const params = e.task_parameters as Record<string, unknown> | null;
          return params?.event_subtype === 'transfer_check';
        });

        if (transferEvents.length === 0) {
          setStats({
            totalChecks: 0,
            spontaneous: 0,
            functional: 0,
            supported: 0,
            recognition: 0,
            noTransfer: 0,
            transferRate: 0,
            topWords: [],
          });
          setLoading(false);
          return;
        }

        // Compute stats
        let spontaneous = 0, functional = 0, supported = 0, recognition = 0, noTransfer = 0;
        const wordMap = new Map<string, { bestScore: number; count: number }>();

        for (const ev of transferEvents) {
          const outputs = ev.outputs as Record<string, unknown> | null;
          const inputs = ev.inputs as Record<string, unknown> | null;
          const score = (outputs?.transfer_score as number) ?? 0;

          if (score >= 4) spontaneous++;
          else if (score >= 3) functional++;
          else if (score >= 2) supported++;
          else if (score >= 1) recognition++;
          else noTransfer++;

          // Track per-word
          const targets = (inputs?.transfer_targets as { value: string }[]) || [];
          for (const t of targets) {
            const word = t.value.toLowerCase();
            const existing = wordMap.get(word) || { bestScore: 0, count: 0 };
            wordMap.set(word, {
              bestScore: Math.max(existing.bestScore, score),
              count: existing.count + 1,
            });
          }
        }

        const total = transferEvents.length;
        const topWords = Array.from(wordMap.entries())
          .map(([word, data]) => ({ word, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        setStats({
          totalChecks: total,
          spontaneous,
          functional,
          supported,
          recognition,
          noTransfer,
          transferRate: total > 0 ? Math.round(((spontaneous + functional) / total) * 100) : 0,
          topWords,
        });
      } catch (err) {
        console.error('[TransferAnalytics] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransferData();
  }, [userId]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-8 bg-muted rounded w-1/2" />
        </div>
      </Card>
    );
  }

  if (!stats || stats.totalChecks === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Transfer Scoring</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No transfer checks recorded yet. Transfer scoring activates after drill exercises in Smart Coach sessions.
        </p>
      </Card>
    );
  }

  const scoreLabel = (score: number) => {
    if (score >= 4) return { text: 'Independent', className: 'text-green-600 dark:text-green-400' };
    if (score >= 3) return { text: 'Functional', className: 'text-primary' };
    if (score >= 2) return { text: 'With help', className: 'text-amber-600 dark:text-amber-400' };
    if (score >= 1) return { text: 'Recognized', className: 'text-muted-foreground' };
    return { text: 'Not yet', className: 'text-muted-foreground/60' };
  };

  return (
    <div className="space-y-4">
      {/* Transfer rate headline */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Transfer Scoring</h3>
          <span className="text-xs text-muted-foreground ml-auto">{stats.totalChecks} checks</span>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-foreground">{stats.transferRate}%</span>
          <span className="text-sm text-muted-foreground">transfer rate (score 3-4)</span>
        </div>

        {/* Score distribution bar */}
        <div className="space-y-2">
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {stats.spontaneous > 0 && (
              <div 
                className="bg-green-500 dark:bg-green-400" 
                style={{ width: `${(stats.spontaneous / stats.totalChecks) * 100}%` }}
                title={`Independent: ${stats.spontaneous}`}
              />
            )}
            {stats.functional > 0 && (
              <div 
                className="bg-primary" 
                style={{ width: `${(stats.functional / stats.totalChecks) * 100}%` }}
                title={`Functional: ${stats.functional}`}
              />
            )}
            {stats.supported > 0 && (
              <div 
                className="bg-amber-400 dark:bg-amber-500" 
                style={{ width: `${(stats.supported / stats.totalChecks) * 100}%` }}
                title={`With help: ${stats.supported}`}
              />
            )}
            {stats.recognition > 0 && (
              <div 
                className="bg-muted-foreground/30" 
                style={{ width: `${(stats.recognition / stats.totalChecks) * 100}%` }}
                title={`Recognition: ${stats.recognition}`}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Independent ({stats.spontaneous})</span>
            <span>Functional ({stats.functional})</span>
            <span>With help ({stats.supported})</span>
            <span>Not yet ({stats.noTransfer + stats.recognition})</span>
          </div>
        </div>
      </Card>

      {/* Per-word breakdown */}
      {stats.topWords.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Word-Level Transfer</h3>
          </div>
          <div className="space-y-2">
            {stats.topWords.map((w) => {
              const label = scoreLabel(w.bestScore);
              return (
                <div key={w.word} className="flex items-center justify-between py-1.5 border-b border-muted last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">"{w.word}"</span>
                    <span className="text-[10px] text-muted-foreground">{w.count}x</span>
                  </div>
                  <span className={cn('text-xs font-medium', label.className)}>
                    {label.text}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
