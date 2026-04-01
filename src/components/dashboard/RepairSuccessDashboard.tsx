/**
 * Repair Success Dashboard — visualizes therapy effectiveness metrics
 * 
 * Shows:
 * - Repair success rate (main KPI)
 * - Anchor usage quality (passive vs guided vs scaffolded)
 * - Session-level TRL progression
 * - Within-session improvement (first half vs second half)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Shield, Target, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RepairDashboardProps {
  userId: string | undefined;
  daysBack?: number;
}

interface SessionRepairData {
  sessionId: string;
  date: string;
  repairSuccessRate: number;
  anchorPassRate: number;
  preferredAnchorRate: number;
  trlGuidedRate: number;
  trlAvgLevel: number;
  totalTurns: number;
  anchorUsageBreakdown: Record<string, number>;
}

function useRepairDashboardData(userId: string | undefined, daysBack: number) {
  return useQuery({
    queryKey: ['repair-dashboard', userId, daysBack],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{
      sessions: SessionRepairData[];
      aggregate: {
        avgRepairRate: number;
        avgAnchorRate: number;
        avgGuidedRate: number;
        avgTrlLevel: number;
        anchorUsageTotals: Record<string, number>;
        sessionCount: number;
        totalTurns: number;
        progressionTrend: 'improving' | 'stable' | 'declining';
      };
    }> => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, started_at, engagement_summary')
        .eq('user_id', userId!)
        .not('ended_at', 'is', null)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(50);

      if (!sessions?.length) {
        return {
          sessions: [],
          aggregate: {
            avgRepairRate: 0,
            avgAnchorRate: 0,
            avgGuidedRate: 0,
            avgTrlLevel: 0,
            anchorUsageTotals: {},
            sessionCount: 0,
            totalTurns: 0,
            progressionTrend: 'stable',
          },
        };
      }

      const sessionData: SessionRepairData[] = [];
      let totalRepairRate = 0;
      let totalAnchorRate = 0;
      let totalGuidedRate = 0;
      let totalTrlLevel = 0;
      let totalTurns = 0;
      let validSessions = 0;
      const anchorUsageTotals: Record<string, number> = {};

      for (const s of sessions) {
        const es = s.engagement_summary as any;
        if (!es || !es.trl_total_turns) continue;

        validSessions++;
        const repairRate = es.repair_success_rate ?? 0;
        const anchorRate = es.anchor_pass_rate ?? 0;
        const guidedRate = es.trl_guided_rate ?? 0;
        const avgLevel = es.trl_avg_level ?? 0;
        const turns = es.total_turns || es.trl_total_turns || 0;

        totalRepairRate += repairRate;
        totalAnchorRate += anchorRate;
        totalGuidedRate += guidedRate;
        totalTrlLevel += avgLevel;
        totalTurns += turns;

        // Aggregate anchor usage
        const usage = es.trl_anchor_usage || {};
        for (const [k, v] of Object.entries(usage)) {
          anchorUsageTotals[k] = (anchorUsageTotals[k] ?? 0) + (v as number);
        }

        sessionData.push({
          sessionId: s.id,
          date: s.started_at || '',
          repairSuccessRate: repairRate,
          anchorPassRate: anchorRate,
          preferredAnchorRate: es.preferred_anchor_rate ?? 0,
          trlGuidedRate: guidedRate,
          trlAvgLevel: avgLevel,
          totalTurns: turns,
          anchorUsageBreakdown: usage,
        });
      }

      // Determine progression trend (compare first half vs second half of sessions)
      let progressionTrend: 'improving' | 'stable' | 'declining' = 'stable';
      if (sessionData.length >= 4) {
        const mid = Math.floor(sessionData.length / 2);
        // Sessions are newest-first, so second half = older
        const recentAvg = sessionData.slice(0, mid).reduce((s, d) => s + d.trlGuidedRate, 0) / mid;
        const olderAvg = sessionData.slice(mid).reduce((s, d) => s + d.trlGuidedRate, 0) / (sessionData.length - mid);
        if (recentAvg > olderAvg + 5) progressionTrend = 'improving';
        else if (recentAvg < olderAvg - 5) progressionTrend = 'declining';
      }

      return {
        sessions: sessionData,
        aggregate: {
          avgRepairRate: validSessions > 0 ? Math.round(totalRepairRate / validSessions) : 0,
          avgAnchorRate: validSessions > 0 ? Math.round(totalAnchorRate / validSessions) : 0,
          avgGuidedRate: validSessions > 0 ? Math.round(totalGuidedRate / validSessions) : 0,
          avgTrlLevel: validSessions > 0 ? Math.round((totalTrlLevel / validSessions) * 10) / 10 : 0,
          anchorUsageTotals,
          sessionCount: validSessions,
          totalTurns,
          progressionTrend,
        },
      };
    },
  });
}

export function RepairSuccessDashboard({ userId, daysBack = 14 }: RepairDashboardProps) {
  const { data, isLoading } = useRepairDashboardData(userId, daysBack);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.aggregate.sessionCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Therapy Effectiveness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No session data yet. Complete a Smart Coach session to see metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const { aggregate } = data;
  const totalAnchorUsage = Object.values(aggregate.anchorUsageTotals).reduce((s, v) => s + v, 0) || 1;
  const guidedPct = Math.round(
    ((aggregate.anchorUsageTotals['guided_prompt'] ?? 0) +
     (aggregate.anchorUsageTotals['scaffolded_choice'] ?? 0) +
     (aggregate.anchorUsageTotals['targeted_cue'] ?? 0)) / totalAnchorUsage * 100
  );

  const trendIcon = aggregate.progressionTrend === 'improving' 
    ? <ArrowUpRight className="h-3 w-3 text-green-500" />
    : aggregate.progressionTrend === 'declining'
    ? <ArrowDownRight className="h-3 w-3 text-red-500" />
    : null;

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard 
          icon={<Target className="h-4 w-4" />}
          label="Repair Success"
          value={`${aggregate.avgRepairRate}%`}
          subtext={aggregate.avgRepairRate >= 75 ? 'Strong' : aggregate.avgRepairRate >= 65 ? 'Good' : 'Needs work'}
          color={aggregate.avgRepairRate >= 65 ? 'text-green-600' : 'text-amber-600'}
        />
        <MetricCard 
          icon={<Shield className="h-4 w-4" />}
          label="Anchor Quality"
          value={`${aggregate.avgAnchorRate}%`}
          subtext="Context grounding"
          color={aggregate.avgAnchorRate >= 80 ? 'text-green-600' : 'text-amber-600'}
        />
        <MetricCard 
          icon={<Zap className="h-4 w-4" />}
          label="Guided Rate"
          value={`${aggregate.avgGuidedRate}%`}
          subtext={aggregate.avgGuidedRate >= 60 && aggregate.avgGuidedRate <= 80 ? 'Ideal range' : 'Check balance'}
          color={aggregate.avgGuidedRate >= 60 && aggregate.avgGuidedRate <= 80 ? 'text-green-600' : 'text-amber-600'}
        />
        <MetricCard 
          icon={<Activity className="h-4 w-4" />}
          label="Avg TRL Level"
          value={`${aggregate.avgTrlLevel}`}
          subtext={<span className="flex items-center gap-1">{trendIcon} {aggregate.progressionTrend}</span>}
          color="text-primary"
        />
      </div>

      {/* Anchor Usage Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Anchor Usage Quality</CardTitle>
          <p className="text-xs text-muted-foreground">
            {guidedPct}% of anchors used therapeutically (guided/scaffolded/cue) — target ≥70%
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { key: 'passive_reference', label: 'Passive', color: 'bg-muted' },
            { key: 'guided_prompt', label: 'Guided', color: 'bg-blue-500' },
            { key: 'scaffolded_choice', label: 'Scaffolded', color: 'bg-primary' },
            { key: 'targeted_cue', label: 'Targeted Cue', color: 'bg-amber-500' },
            { key: 'recovery_rebuild', label: 'Recovery', color: 'bg-red-500' },
          ].map(({ key, label, color }) => {
            const count = aggregate.anchorUsageTotals[key] ?? 0;
            const pct = Math.round((count / totalAnchorUsage) * 100);
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="w-24 text-muted-foreground">{label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right font-medium">{pct}%</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Session History ({data.sessions.length} sessions, {aggregate.totalTurns} turns)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.sessions.slice(0, 10).map((s) => (
              <div key={s.sessionId} className="flex items-center justify-between text-xs border-b border-border pb-1">
                <span className="text-muted-foreground">
                  {new Date(s.date).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px]">
                    TRL {s.trlAvgLevel}
                  </Badge>
                  <span className={s.anchorPassRate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                    Anchor {s.anchorPassRate}%
                  </span>
                  <span className="font-medium">
                    {s.totalTurns} turns
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, subtext, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>
      </CardContent>
    </Card>
  );
}
