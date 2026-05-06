/**
 * /dev/mastery-shadow — Admin-only inspector for the Mastery Layer (shadow).
 *
 * Shows current per-skill mastery for any profile, with confidence,
 * cue independence, plateau flag, and weekly history. Read-only.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSkillMastery } from '@/hooks/useSkillMastery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { flushMasteryShadow } from '@/lib/mastery/flushMasteryShadow';

interface SnapshotRow {
  skill_slug: string;
  week_start: string;
  mastery_score: number;
  trials_in_week: number;
  cue_independence: number | null;
}

export default function MasteryShadowDev() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { rows, loading } = useSkillMastery(activeProfile?.id);
  const [history, setHistory] = useState<SnapshotRow[]>([]);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    if (!activeProfile?.id) return;
    (async () => {
      const { data } = await supabase
        .from('skill_mastery_history')
        .select('skill_slug, week_start, mastery_score, trials_in_week, cue_independence')
        .eq('profile_id', activeProfile.id)
        .order('week_start', { ascending: false })
        .limit(60);
      setHistory((data ?? []) as SnapshotRow[]);
    })();
  }, [activeProfile?.id]);

  async function recomputeFromLastSession() {
    if (!user?.id || !activeProfile?.id) return;
    setRecomputing(true);
    const { data: sess } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sess?.id) {
      await flushMasteryShadow({ sessionId: sess.id, userId: user.id, profileId: activeProfile.id });
    }
    setRecomputing(false);
    window.location.reload();
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mastery Layer — Shadow Mode</h1>
          <p className="text-sm text-muted-foreground">
            Read-only view of computed skill mastery. Not shown to patients or clinicians.
          </p>
        </div>
        <Button variant="outline" onClick={recomputeFromLastSession} disabled={recomputing}>
          {recomputing ? 'Recomputing…' : 'Recompute from last session'}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Current mastery by skill</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mastery rows yet. Complete a session, then click "Recompute" above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Skill</th>
                  <th>Mastery</th>
                  <th>Confidence</th>
                  <th>Cue indep.</th>
                  <th>Trials (14d / total)</th>
                  <th>Velocity/wk</th>
                  <th>Plateau</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.skill_slug} className="border-t">
                    <td className="py-2 font-mono">{r.skill_slug}</td>
                    <td className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={r.mastery_score * 100} className="h-2 w-24" />
                        <span>{(r.mastery_score * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={r.confidence === 'high' ? 'default' : 'secondary'}>
                        {r.confidence}
                      </Badge>
                    </td>
                    <td>{r.cue_independence != null ? (r.cue_independence * 100).toFixed(0) + '%' : '—'}</td>
                    <td>{r.trials_recent} / {r.trials_total}</td>
                    <td>{r.velocity_per_week != null ? r.velocity_per_week.toFixed(3) : '—'}</td>
                    <td>{r.plateau_flag ? <Badge variant="destructive">plateau</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly snapshots (last 60)</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Week</th>
                  <th>Skill</th>
                  <th>Mastery</th>
                  <th>Cue indep.</th>
                  <th>Trials</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2">{h.week_start}</td>
                    <td className="font-mono">{h.skill_slug}</td>
                    <td>{(h.mastery_score * 100).toFixed(0)}%</td>
                    <td>{h.cue_independence != null ? (h.cue_independence * 100).toFixed(0) + '%' : '—'}</td>
                    <td>{h.trials_in_week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
