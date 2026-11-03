/**
 * /dev/qa-runbook — Phase 1B manual QA runbook.
 *
 * Admin-only. Renders an interactive checklist from `qaScenarios.ts`,
 * persists pass/fail/skip results to `qa_runs`, and exports a Markdown
 * summary at the end of a run.
 *
 * Does NOT touch any clinical engine, progression hook, scoring logic,
 * mastery routing, or content bank. Purely additive operational tooling.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  QA_SCENARIOS,
  QA_GAME_INVENTORY,
  QA_RUNBOOK_VERSION,
  type QaScenario,
} from '@/data/qaScenarios';

type StepResult = 'pass' | 'fail' | 'skip';
type ResultMap = Record<string, { result: StepResult; note?: string }>;

const BUILD_SHA = (import.meta.env.VITE_BUILD_SHA as string | undefined) ?? 'local';

const AREAS: QaScenario['area'][] = ['auth', 'onboarding', 'game', 'maya', 'role', 'a11y', 'recovery'];

export default function QaRunbook() {
  const { toast } = useToast();
  const [role, setRole] = useState<string>('patient');
  const [device, setDevice] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<QaScenario['area'] | 'all'>('all');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [results, setResults] = useState<ResultMap>({});
  const [persisting, setPersisting] = useState(false);

  const scenarios = useMemo(() => QA_SCENARIOS.filter((scenario) => {
    if (areaFilter !== 'all' && scenario.area !== areaFilter) return false;
    if (areaFilter === 'game' && gameFilter !== 'all') return scenario.slug === gameFilter;
    return true;
  }), [areaFilter, gameFilter]);

  // Counts must describe the visible subset, not previously tested games.
  const visibleKeys = new Set(scenarios.flatMap((scenario) =>
    scenario.steps.map((step) => `${scenario.id}::${step.id}`),
  ));
  const visibleResults = Object.entries(results)
    .filter(([key]) => visibleKeys.has(key))
    .map(([, result]) => result);
  const totalSteps = scenarios.reduce((n, s) => n + s.steps.length, 0);
  const completed = visibleResults.length;
  const passed = visibleResults.filter((r) => r.result === 'pass').length;
  const failed = visibleResults.filter((r) => r.result === 'fail').length;
  const skipped = visibleResults.filter((r) => r.result === 'skip').length;

  const setStep = (key: string, result: StepResult, note?: string) => {
    setResults((prev) => ({ ...prev, [key]: { result, note } }));
  };

  const persistAll = async () => {
    setPersisting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const rows = Object.entries(results).map(([key, value]) => {
        const [scenarioId, stepId] = key.split('::');
        return {
          user_id: userId,
          build_sha: BUILD_SHA,
          role,
          device_label: device || null,
          scenario_id: scenarioId,
          step_id: stepId,
          result: value.result,
          note: value.note ?? null,
        };
      });

      if (rows.length === 0) {
        toast({ title: 'Nothing to save', description: 'Record some results first.' });
        return;
      }

      const { error } = await supabase.from('qa_runs').insert(rows);
      if (error) throw error;
      toast({ title: 'Saved', description: `${rows.length} step results persisted.` });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPersisting(false);
    }
  };

  const downloadMarkdown = () => {
    const lines: string[] = [
      `# QA Runbook results — ${new Date().toISOString()}`,
      ``,
      `- Runbook version: \`${QA_RUNBOOK_VERSION}\``,
      `- Build: \`${BUILD_SHA}\``,
      `- Role: \`${role}\``,
      `- Device: \`${device || 'unspecified'}\``,
      `- Totals: ${passed} pass · ${failed} fail · ${skipped} skip / ${totalSteps}`,
      ``,
    ];
    for (const s of scenarios) {
      lines.push(`## ${s.title} (${s.id}) — ${s.area}${s.slug ? ` · ${s.slug}` : ''}`);
      for (const step of s.steps) {
        const r = results[`${s.id}::${step.id}`];
        const mark = r?.result === 'pass' ? '✅' : r?.result === 'fail' ? '❌' : r?.result === 'skip' ? '⏭️' : '⬜';
        lines.push(`- ${mark} **${step.id}** — ${step.action}`);
        lines.push(`  - expect: ${step.expect}`);
        if (step.safety) lines.push(`  - safety: ${step.safety}`);
        if (r?.note) lines.push(`  - note: ${r.note}`);
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-runbook-${BUILD_SHA}-${role}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">QA Runbook</h1>
          <Badge variant="outline">v{QA_RUNBOOK_VERSION}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Guided manual QA. Read-only against the app — does not modify any clinical state.
          Results persist to <code>qa_runs</code> and can be exported as Markdown.
        </p>
        <p className="text-xs text-muted-foreground">
          Game audits: {QA_GAME_INVENTORY.length} activities (28 canonical + Functional Command Scenes).
          Review every activity separately; inclusion in this checklist does not establish that it works.
        </p>
        <p className="text-xs text-muted-foreground">
          Companion to <Link to="/dev/leveling-contract" className="underline">/dev/leveling-contract</Link>{' '}
          (per-game contract registry) and the Vitest suite (`bunx vitest run`).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Run context</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Role under test</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="patient">patient</SelectItem>
                <SelectItem value="caregiver">caregiver</SelectItem>
                <SelectItem value="clinician">clinician</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Device label</label>
            <Input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="e.g. iPhone 13 Safari" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Area</label>
            <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v as typeof areaFilter); setGameFilter('all'); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {areaFilter === 'game' && (
            <div>
              <label className="text-xs text-muted-foreground">Game under test</label>
              <Select value={gameFilter} onValueChange={setGameFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {QA_GAME_INVENTORY.length} games</SelectItem>
                  {QA_GAME_INVENTORY.map(({ slug, title }) => (
                    <SelectItem key={slug} value={slug}>{title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progress</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Badge>{completed}/{totalSteps} answered</Badge>
          <Badge variant="default">{passed} pass</Badge>
          <Badge variant="destructive">{failed} fail</Badge>
          <Badge variant="secondary">{skipped} skip</Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={downloadMarkdown}>Download .md</Button>
            <Button onClick={persistAll} disabled={persisting || Object.keys(results).length === 0}>
              {persisting ? 'Saving…' : 'Save run'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {scenarios.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>{s.title}</span>
                <Badge variant="outline">{s.area}</Badge>
                {s.slug ? <Badge variant="secondary">{s.slug}</Badge> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.steps.map((step, idx) => {
                const key = `${s.id}::${step.id}`;
                const current = results[key];
                return (
                  <div key={step.id} className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">{idx + 1}. {step.action}</span>
                      <div className="text-muted-foreground text-xs mt-1">expect: {step.expect}</div>
                      {step.safety && (
                        <div className="text-destructive text-xs mt-1">safety: {step.safety}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        variant={current?.result === 'pass' ? 'default' : 'outline'}
                        onClick={() => setStep(key, 'pass', current?.note)}
                      >Pass</Button>
                      <Button
                        size="sm"
                        variant={current?.result === 'fail' ? 'destructive' : 'outline'}
                        onClick={() => setStep(key, 'fail', current?.note)}
                      >Fail</Button>
                      <Button
                        size="sm"
                        variant={current?.result === 'skip' ? 'secondary' : 'outline'}
                        onClick={() => setStep(key, 'skip', current?.note)}
                      >Skip</Button>
                      <Input
                        value={current?.note ?? ''}
                        onChange={(e) => { if (current) setStep(key, current.result, e.target.value); }}
                        placeholder={current ? "optional note" : "Mark Pass, Fail or Skip first"}
                        disabled={!current}
                        className="flex-1 min-w-[180px]"
                      />
                    </div>
                    {idx < s.steps.length - 1 ? <Separator /> : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
