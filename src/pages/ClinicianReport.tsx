/**
 * Clinician Report Page
 * 
 * Medical-grade 7-day report with evidence badges and print support.
 * Clinician+ only.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Printer, 
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Info,
  Volume2,
  Activity,
  Footprints,
  Moon,
  Flame
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useWeeklyTrends } from '@/hooks/useWeeklyTrends';
import { useLearningRate } from '@/hooks/useLearningRate';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { useCapabilitySpeechCorrelation } from '@/hooks/useCapabilitySpeechCorrelation';
import { useRedFlagDetection } from '@/hooks/useRedFlagDetection';
import { useUiMode } from '@/hooks/useUiMode';
import { useCuratedAudioSamples } from '@/hooks/useCuratedAudioSamples';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useRecoveryAlerts } from '@/hooks/useRecoveryAlerts';
import { buildClinicianReport, type ClinicianReport as ClinicianReportType } from '@/lib/clinicianReportBuilder';
import { AudioPlaybackWithWaveform } from '@/components/AudioPlaybackWithWaveform';
import { format } from 'date-fns';

const ConfidenceBadge = ({ level }: { level: 'low' | 'medium' | 'high' }) => {
  const config = {
    low: { label: 'Low confidence', variant: 'outline' as const, icon: Info },
    medium: { label: 'Medium confidence', variant: 'secondary' as const, icon: Info },
    high: { label: 'High confidence', variant: 'default' as const, icon: CheckCircle },
  };
  const c = config[level];
  const Icon = c.icon;
  
  return (
    <Badge variant={c.variant} className="text-xs">
      <Icon className="h-3 w-3 mr-1" />
      {c.label}
    </Badge>
  );
};

const VerdictIcon = ({ verdict }: { verdict: string }) => {
  switch (verdict) {
    case 'improving':
      return <TrendingUp className="h-5 w-5 text-success" />;
    case 'declining':
      return <TrendingDown className="h-5 w-5 text-warning" />;
    default:
      return <Minus className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function ClinicianReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { isAtLeast } = useUiMode();
  
  const { trends, loading: trendsLoading } = useWeeklyTrends();
  const { learningRates, isLoading: learningLoading } = useLearningRate(user?.id);
  const { analytics: errorAnalytics, isLoading: errorLoading } = useErrorPatternAnalytics(user?.id, { weeksBack: 1 });
  const { analytics: correlations, isLoading: correlationsLoading } = useCapabilitySpeechCorrelation(user?.id, { profileId: activeProfile?.id });
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(user?.id);
  const { samples: audioSamples, loading: audioLoading } = useCuratedAudioSamples(user?.id, 7);
  const { timeline, physicalMeta, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(activeProfile?.id, 7);
  const { alerts: recoveryAlerts } = useRecoveryAlerts(activeProfile?.id, timeline);
  
  const isLoading = trendsLoading || learningLoading || errorLoading || correlationsLoading || flagsLoading || audioLoading || snapshotLoading;
  
  // Require clinician+ mode
  if (!isAtLeast('clinician')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Clinician Access Required</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This report is available in Clinician or Admin mode only.
            </p>
            <Button variant="outline" onClick={() => navigate('/clinician/caseload')}>
              Return to Caseload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  
  // Map red flags to expected format
  const mappedFlags = redFlags.map(f => ({
    type: f.type,
    message: f.message,
    severity: f.severity === 'orange' ? 'yellow' as const : f.severity as 'red' | 'yellow' | 'green',
  }));
  
  const report: ClinicianReportType = buildClinicianReport(
    trends,
    learningRates,
    errorAnalytics,
    correlations,
    mappedFlags,
    7
  );
  
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="border-b bg-card print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Clinical Progress Report</h1>
              <p className="text-sm text-muted-foreground">{report.window.label}</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </header>
      
      {/* Report Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 print:py-0 print:px-0">
        
        {/* Report Header (visible in print) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Clinical Progress Report</h1>
          <p className="text-muted-foreground">
            {activeProfile?.profile_name || 'Patient'} • Generated {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>
        
        {/* Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Report Summary</CardTitle>
              <ConfidenceBadge level={report.confidence.level} />
            </div>
            <CardDescription>
              {report.window.start} to {report.window.end} ({report.window.days} days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{report.sample.trials}</p>
                <p className="text-xs text-muted-foreground">Total Trials</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{report.sample.practiceDays}</p>
                <p className="text-xs text-muted-foreground">Practice Days</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {report.errors.distribution.find(e => e.type === 'Correct')?.rate 
                    ? Math.round((report.errors.distribution.find(e => e.type === 'Correct')?.rate || 0) * 100) 
                    : '—'}%
                </p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <VerdictIcon verdict={report.recovery.verdict} />
                <div className="text-left">
                  <p className="text-sm font-medium">{report.recovery.headline}</p>
                  <p className="text-xs text-muted-foreground">{report.recovery.verdict}</p>
                </div>
              </div>
            </div>
            
            {report.confidence.reasons.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Evidence basis:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {report.confidence.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Alerts (if any) */}
        {report.alerts.items.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Clinical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {report.alerts.items.map((alert, i) => (
                  <li key={i} className="text-sm">{alert}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        
        {/* Recovery Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recovery Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <VerdictIcon verdict={report.recovery.verdict} />
              <div>
                <p className="font-medium">{report.recovery.headline}</p>
                <p className="text-sm text-muted-foreground">{report.recovery.detail}</p>
              </div>
            </div>
            {report.recovery.evidence.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Evidence:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {report.recovery.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Error Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Error Pattern Analysis</CardTitle>
            <CardDescription>Distribution of response types</CardDescription>
          </CardHeader>
          <CardContent>
            {report.errors.distribution.length > 0 ? (
              <div className="space-y-2">
                {report.errors.distribution.map((error, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{error.type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${error.rate * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-16 text-right">
                        {error.count} ({Math.round(error.rate * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No error data available.</p>
            )}
            
            {report.errors.topChallenges.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium mb-2">Top challenging targets:</p>
                <div className="flex flex-wrap gap-2">
                  {report.errors.topChallenges.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {c.target} ({Math.round(c.errorRate * 100)}% errors, n={c.attempts})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {report.errors.notes.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Clinical notes:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {report.errors.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Audio Samples - hidden in print */}
        {(audioSamples.challenging.length > 0 || audioSamples.best.length > 0) && (
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Audio Samples
              </CardTitle>
              <CardDescription>Curated examples for clinical review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {audioSamples.challenging.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-amber-600 dark:text-amber-400">
                    Challenging Examples
                  </p>
                  <div className="space-y-2">
                    {audioSamples.challenging.map((sample) => (
                      <div key={sample.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium capitalize">{sample.targetWord}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sample.timestamp), 'MMM d, h:mm a')}
                              {sample.transcript && ` • Said: "${sample.transcript}"`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${sample.score < 60 ? 'text-red-500' : 'text-amber-600'}`}>
                              {sample.score}%
                            </p>
                            {sample.errorType && (
                              <Badge variant="outline" className="text-[10px]">
                                {sample.errorType.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <AudioPlaybackWithWaveform storagePath={sample.audioPath} showWaveform={true} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {audioSamples.best.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">
                    Best Examples
                  </p>
                  <div className="space-y-2">
                    {audioSamples.best.map((sample) => (
                      <div key={sample.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium capitalize">{sample.targetWord}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sample.timestamp), 'MMM d, h:mm a')}
                              {sample.transcript && ` • Said: "${sample.transcript}"`}
                            </p>
                          </div>
                          <p className="font-semibold text-green-600">{sample.score}%</p>
                        </div>
                        <AudioPlaybackWithWaveform storagePath={sample.audioPath} showWaveform={true} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Cue Efficacy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cueing Strategy Efficacy</CardTitle>
          </CardHeader>
          <CardContent>
            {report.cues.byType.length > 0 ? (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Cue Type</th>
                      <th className="text-right py-2">Efficacy</th>
                      <th className="text-right py-2">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.cues.byType.map((cue, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 capitalize">{cue.cueType}</td>
                        <td className="text-right py-2">{Math.round(cue.efficacy * 100)}%</td>
                        <td className="text-right py-2 text-muted-foreground">{cue.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Recommendation</p>
                  <p className="text-sm text-muted-foreground">{report.cues.recommendation}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Insufficient cueing data (min 3 per type).</p>
            )}
          </CardContent>
        </Card>
        
        {/* Fluency */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fluency Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Avg Speech Rate</p>
                <p className="text-lg font-semibold">
                  {report.fluency.avgWpm ? `${Math.round(report.fluency.avgWpm)} WPM` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Effortful Speech Rate</p>
                <p className="text-lg font-semibold">
                  {Math.round(report.fluency.effortfulRate * 100)}%
                </p>
              </div>
            </div>
            
            {report.fluency.notes.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Clinical notes:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {report.fluency.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Treatment Plan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommended Focus Areas</CardTitle>
          </CardHeader>
          <CardContent>
            {report.plan.items.length > 0 ? (
              <div className="space-y-3">
                {report.plan.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Badge variant={item.priority === 'primary' ? 'default' : 'secondary'} className="mt-0.5">
                      {item.priority}
                    </Badge>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specific recommendations at this time.</p>
            )}
          </CardContent>
        </Card>

        {/* Physical Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Physical Activity (7-Day)
            </CardTitle>
            <CardDescription>
              Coverage: {physicalMeta.coverageDays}/7 days
              {physicalMeta.sourcesSeen.length > 0 && ` • Sources: ${physicalMeta.sourcesSeen.join(', ')}`}
              {physicalMeta.lastSyncAtMax && ` • Last sync: ${format(new Date(physicalMeta.lastSyncAtMax), 'MMM d')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Steps</p>
                    <p className="text-lg font-semibold">
                      {(() => {
                        const withSteps = timeline.filter(d => d.steps !== null);
                        return withSteps.length > 0
                          ? Math.round(withSteps.reduce((s, d) => s + (d.steps || 0), 0) / withSteps.length).toLocaleString()
                          : '—';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Active Min</p>
                    <p className="text-lg font-semibold">
                      {(() => {
                        const withActive = timeline.filter(d => d.activeMinutesObjective !== null);
                        return withActive.length > 0
                          ? Math.round(withActive.reduce((s, d) => s + (d.activeMinutesObjective || 0), 0) / withActive.length)
                          : '—';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Sleep</p>
                    <p className="text-lg font-semibold">
                      {(() => {
                        const withSleep = timeline.filter(d => d.sleepMinutes !== null);
                        return withSleep.length > 0
                          ? `${Math.round(withSleep.reduce((s, d) => s + (d.sleepMinutes || 0), 0) / withSleep.length / 60 * 10) / 10}h`
                          : '—';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Fatigue</p>
                    <p className="text-lg font-semibold">
                      {(() => {
                        const withFatigue = timeline.filter(d => d.fatigueRating !== null);
                        return withFatigue.length > 0
                          ? `${(withFatigue.reduce((s, d) => s + (d.fatigueRating || 0), 0) / withFatigue.length).toFixed(1)}/5`
                          : '—';
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No physical data for this period.</p>
            )}
          </CardContent>
        </Card>

        {/* Recovery Alerts */}
        {recoveryAlerts.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Active Recovery Alerts ({recoveryAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recoveryAlerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 p-2 rounded bg-background">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="mt-0.5 text-xs shrink-0">
                      {alert.severity}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground">{alert.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Detected: {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                        {alert.acknowledged_at && ' • Acknowledged'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Report generated {new Date(report.generatedAt).toLocaleString()}</p>
          <p>Window: {report.window.label} • N={report.sample.trials} trials • Confidence: {report.confidence.level}</p>
        </div>
      </main>
    </div>
  );
}
