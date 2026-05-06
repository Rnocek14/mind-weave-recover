/**
 * /dev/mastery-audit — Admin-only contamination audit for the mastery quarantine.
 *
 * Read-only. Verifies that quarantined exercises (conversation-partner /
 * conversation-coach) have not contributed rows to user_skill_mastery or
 * skill_mastery_history, and surfaces SQL recommendations if cleanup is needed.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { runMasteryContaminationAudit, type ContaminationAuditReport } from '@/lib/mastery/contaminationAudit';

export default function MasteryAuditDev() {
  const [report, setReport] = useState<ContaminationAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [windowDays, setWindowDays] = useState(30);

  async function run() {
    setLoading(true);
    try {
      const r = await runMasteryContaminationAudit(windowDays);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }

  const verdictColor =
    report?.verdict === 'clean'
      ? 'bg-green-500/10 text-green-700 border-green-500/30'
      : report?.verdict === 'suspicious'
      ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
      : 'bg-red-500/10 text-red-700 border-red-500/30';

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Mastery Contamination Audit</h1>
        <p className="text-sm text-muted-foreground">
          Verifies that quarantined open-ended exercises are not polluting the mastery shadow tables.
          Read-only. Does not delete data.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <label className="text-sm">Window (days):</label>
          <input
            type="number"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value) || 30)}
            className="w-20 px-2 py-1 border rounded bg-background"
          />
          <Button onClick={run} disabled={loading}>
            {loading ? 'Running…' : 'Run audit'}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Verdict</CardTitle>
              <Badge variant="outline" className={verdictColor}>
                {report.verdict.toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="font-mono whitespace-pre-wrap">{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Log scan — quarantined exercise trials</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>Total: <strong>{report.logScan.quarantinedTrialCount}</strong></div>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{JSON.stringify(report.logScan.bySlug, null, 2)}
              </pre>
              {report.logScan.wouldMapIfUnquarantined.length > 0 && (
                <div>
                  <div className="font-medium mt-2">Would map to (if unquarantined):</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{JSON.stringify(report.logScan.wouldMapIfUnquarantined, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Row scan — suspicious mastery rows</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="font-medium">user_skill_mastery</div>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{JSON.stringify(report.rowScan.userSkillMastery, null, 2)}
              </pre>
              <div className="font-medium mt-2">skill_mastery_history</div>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{JSON.stringify(report.rowScan.skillMasteryHistory, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
