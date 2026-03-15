import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Stethoscope, 
  FileText, 
  Lightbulb, 
  Copy, 
  Clock, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Printer,
  ClipboardList,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useRecoveryAlerts } from '@/hooks/useRecoveryAlerts';
import { useDailyReadiness } from '@/hooks/useDailyReadiness';
import { useWeeklySessionStats } from '@/hooks/useWeeklySessionStats';
import { useNavigate } from 'react-router-dom';
import { formatEhrSummary } from '@/lib/formatEhrSummary';
import { computeEngagementScore } from '@/lib/computeEngagementScore';
import { generateProgressNote } from '@/lib/generateProgressNote';
import { toast } from 'sonner';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isSafetyFlag } from '@/lib/safetyFlagTypes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LastSessionData {
  date: string;
  durationMin: number;
  accuracy: number | null;
  trialCount: number;
}

function useLastSession(profileId: string | undefined): { lastSession: LastSessionData | null; isLoading: boolean } {
  const [lastSession, setLastSession] = useState<LastSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profileId) { setIsLoading(false); return; }

    const load = async () => {
      try {
        // Only fetch meaningful therapy sessions (≥60s) — exclude aborted + context-only records
        const { data: sess } = await supabase
          .from('sessions')
          .select('id, ended_at, duration_sec')
          .eq('profile_id', profileId)
          .not('ended_at', 'is', null)
          .gte('duration_sec', 60)
          .order('ended_at', { ascending: false })
          .limit(1);

        if (!sess?.length) { setLastSession(null); setIsLoading(false); return; }

        const s = sess[0];
        const { data: events } = await supabase
          .from('exercise_events')
          .select('score')
          .eq('session_id', s.id)
          .not('score', 'is', null);

        const scores = events || [];
        const avgAcc = scores.length > 0
          ? Math.round(
              scores.reduce((sum, e) => {
                const normalized = (e.score! <= 1) ? e.score! * 100 : e.score!;
                return sum + normalized;
              }, 0) / scores.length
            )
          : null;

        setLastSession({
          date: s.ended_at!,
          durationMin: Math.round((s.duration_sec || 0) / 60),
          accuracy: avgAcc,
          trialCount: scores.length,
        });
      } catch { setLastSession(null); }
      finally { setIsLoading(false); }
    };
    load();
  }, [profileId]);

  return { lastSession, isLoading };
}

/** Map clinical profile data to a human-readable speech impairment label */
function deriveSpeechLabel(clinicalProfile: Record<string, any> | null): string | null {
  if (!clinicalProfile) return null;
  
  const speechImpairments: string[] = clinicalProfile?.impairments?.speech || [];
  
  // Normalize inputs: lowercase, strip non-alpha
  const normalized = speechImpairments.map(s => s.toLowerCase().replace(/[^a-z]/g, ''));
  
  if (normalized.some(s => s.includes('broca') || s === 'expressive' || s === 'expressiveaphasia')) {
    return 'Expressive aphasia';
  }
  if (normalized.some(s => s.includes('wernicke') || s === 'receptive' || s === 'receptiveaphasia')) {
    return 'Receptive aphasia';
  }
  if (normalized.some(s => s.includes('global'))) {
    return 'Global aphasia';
  }
  if (normalized.some(s => s.includes('anomic'))) {
    return 'Anomic aphasia';
  }
  if (speechImpairments.length > 0) {
    return `Speech: ${speechImpairments[0].replace(/_/g, ' ')}`;
  }
  
  return null;
}

export function ClinicianPatientHeader() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const navigate = useNavigate();

  const { timeline, lastActiveDate, isLoading: snapshotLoading, flags } = useWeeklyRecoverySnapshot(profileId, 14);
  const sessionStats = useWeeklySessionStats(profileId);
  const alertSessionStats = useMemo(() => {
    if (sessionStats.isLoading) return undefined;
    return {
      recentAvgAccuracy: sessionStats.avgAccuracy,
      priorAvgAccuracy: sessionStats.priorAvgAccuracy,
      accuracySlope: sessionStats.accuracySlope,
      recentTrialCount: sessionStats.trialCount,
      recentSessionCount: sessionStats.sessionCount,
      priorTrialCount: sessionStats.trialCount, // approximation — prior count not separately tracked yet
    };
  }, [sessionStats]);
  const { alerts, unacknowledgedCount } = useRecoveryAlerts(profileId, timeline, alertSessionStats);
  const { todayCheckin } = useDailyReadiness(profileId);
  const { lastSession } = useLastSession(profileId);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  // Derived data
  const clinicalProfile = activeProfile?.clinical_profile as Record<string, any> | null;
  const speechLabel = deriveSpeechLabel(clinicalProfile);
  const strokeDate = activeProfile?.stroke_date;
  const daysPostOnset = strokeDate
    ? Math.floor((Date.now() - new Date(strokeDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Compute engagement for EHR export
  const engagement = useMemo(
    () => (timeline.length > 0 ? computeEngagementScore(timeline) : null),
    [timeline]
  );

  // Last active label — use UTC-consistent date slicing
  const lastActiveLabel = (() => {
    if (!lastActiveDate) return 'No activity';
    const todayUTC = new Date().toISOString().slice(0, 10);
    if (lastActiveDate === todayUTC) return 'Today';
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (lastActiveDate === y.toISOString().slice(0, 10)) return 'Yesterday';
    return new Date(lastActiveDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  // Engagement band from recent timeline
  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter(d => d.hasAnySignal).length;
  const engagementLabel = activeDays >= 5 ? 'High' : activeDays >= 3 ? 'Moderate' : activeDays >= 1 ? 'Low' : 'None';
  const engagementColor = activeDays >= 5 ? 'text-green-600 dark:text-green-400' : activeDays >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500';

  // Last session label — use ISO date comparison to avoid TZ mislabeling
  const lastSessionLabel = (() => {
    if (!lastSession) return null;
    const sessionDate = lastSession.date.slice(0, 10);
    const todayUTC = new Date().toISOString().slice(0, 10);
    if (sessionDate === todayUTC) return 'Today';
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (sessionDate === y.toISOString().slice(0, 10)) return 'Yesterday';
    return new Date(lastSession.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const handleCopyEHR = () => {
    try {
      const unresolvedAlerts = alerts.filter(a => !a.resolved_at);
      const activeFlags = flags || [];
      const summary = formatEhrSummary({
        timeline,
        flags: activeFlags,
        alerts,
        lastActiveDate,
        engagement,
      });
      // Only append explicit safety negative when NO alerts AND NO flags
      const hasConcerns = unresolvedAlerts.length > 0 || activeFlags.some(f => isSafetyFlag(f.type));
      const safetyLine = !hasConcerns
        ? '\nSafety flags: none detected in past 14 days.\n'
        : '';
      navigator.clipboard.writeText(summary + safetyLine);
      toast.success('EHR summary copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handlePrint = () => {
    navigate('/clinician/report?print=1');
  };

  const progressNote = useMemo(() => {
    if (snapshotLoading || sessionStats.isLoading) return null;
    return generateProgressNote({
      timeline,
      flags: flags || [],
      alerts,
      lastActiveDate,
      engagement,
      accuracySlope: sessionStats.accuracySlope,
      trialCount: sessionStats.trialCount,
      sessionCount: sessionStats.sessionCount,
      avgAccuracy: sessionStats.avgAccuracy,
      priorAvgAccuracy: sessionStats.priorAvgAccuracy,
      prescribedDays: null,
      profileName: activeProfile?.profile_name || undefined,
    });
  }, [timeline, flags, alerts, lastActiveDate, engagement, sessionStats, snapshotLoading, activeProfile]);

  const handleCopyNote = useCallback(() => {
    if (!progressNote) return;
    navigator.clipboard.writeText(progressNote.narrative);
    toast.success('Progress note copied to clipboard');
  }, [progressNote]);

  if (snapshotLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-5 h-5 bg-muted rounded" />
          <div className="h-6 w-32 bg-muted rounded" />
        </div>
        <div className="flex gap-4 mb-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
        <div className="h-10 bg-muted rounded" />
      </Card>
    );
  }

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      {/* Row 1: Patient identity + alerts */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Stethoscope className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-lg truncate">
              {activeProfile?.profile_name || 'Patient'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {daysPostOnset !== null && (
                <span>{daysPostOnset}d post-stroke</span>
              )}
              {speechLabel && (
                <>
                  <span>•</span>
                  <span>{speechLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Alert badge */}
        {unacknowledgedCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            {unacknowledgedCount} alert{unacknowledgedCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Row 2: Status chips — triage-critical data */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Active:</span>
          <span className="font-medium">{lastActiveLabel}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Engagement:</span>
          <span className={`font-medium ${engagementColor}`}>{engagementLabel}</span>
          <span className="text-muted-foreground text-xs">({activeDays}/7d)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Fatigue:</span>
          {todayCheckin ? (
            <span className="font-medium">{todayCheckin.fatigue_rating}/5</span>
          ) : (
            <span className="text-muted-foreground italic text-xs">— no check-in today</span>
          )}
        </div>
      </div>

      {/* Row 3: Last session metrics — immediate clinical context */}
      {lastSession && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 px-3 py-2 rounded-md bg-muted/50 text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Session</span>
          <span className="font-medium">{lastSessionLabel}</span>
          <span className="text-muted-foreground">•</span>
          <span>{lastSession.durationMin}min</span>
          {lastSession.accuracy !== null && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className={`font-medium ${lastSession.accuracy >= 70 ? 'text-green-600 dark:text-green-400' : lastSession.accuracy >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                {lastSession.accuracy}% acc
              </span>
            </>
          )}
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{lastSession.trialCount} trials</span>
        </div>
      )}

      {/* Row 4: Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => navigate('/clinician/report')} className="gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Report
        </Button>
        <Button size="sm" variant="outline" onClick={() => setNoteDialogOpen(true)} className="gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          Note
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/insights')} className="gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          Insights
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopyEHR} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" />
          Copy EHR
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
          <Printer className="w-3.5 h-3.5" />
          Print
        </Button>
      </div>

      {/* Progress Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Weekly Progress Note
            </DialogTitle>
          </DialogHeader>
          {progressNote ? (
            <div className="space-y-4">
              {/* Headline */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{progressNote.headline}</span>
                <Badge
                  variant={
                    progressNote.confidence === 'high' ? 'default' :
                    progressNote.confidence === 'moderate' ? 'secondary' :
                    'destructive'
                  }
                  className="text-xs"
                >
                  {progressNote.confidence} confidence
                </Badge>
              </div>

              {/* Narrative */}
              <div className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {progressNote.narrative}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCopyNote} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  Copy Note
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyEHR} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  Copy Full EHR
                </Button>
              </div>

              {progressNote.confidenceReason && (
                <p className="text-xs text-muted-foreground">
                  ⚠ {progressNote.confidenceReason}
                </p>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground animate-pulse">
              Generating note...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}