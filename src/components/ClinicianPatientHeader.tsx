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
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useRecoveryAlerts } from '@/hooks/useRecoveryAlerts';
import { useDailyReadiness } from '@/hooks/useDailyReadiness';
import { useNavigate } from 'react-router-dom';
import { formatEhrSummary } from '@/lib/formatEhrSummary';
import { computeEngagementScore } from '@/lib/computeEngagementScore';
import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
        const { data: sess } = await supabase
          .from('sessions')
          .select('id, ended_at, duration_sec')
          .eq('profile_id', profileId)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(1);

        if (!sess?.length) { setLastSession(null); setIsLoading(false); return; }

        const s = sess[0];
        // Only fetch score column, filter nulls server-side
        const { data: events } = await supabase
          .from('exercise_events')
          .select('score')
          .eq('session_id', s.id)
          .not('score', 'is', null);

        const scores = events || [];
        // score is 0 or 1 (binary correct/incorrect), so multiply by 100
        // If score > 1, it's already a percentage — don't inflate
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
  
  // Map common clinical terms to display labels
  if (speechImpairments.includes('expressive') || speechImpairments.includes('broca')) {
    return 'Expressive aphasia';
  }
  if (speechImpairments.includes('receptive') || speechImpairments.includes('wernicke')) {
    return 'Receptive aphasia';
  }
  if (speechImpairments.includes('global')) {
    return 'Global aphasia';
  }
  if (speechImpairments.includes('anomic')) {
    return 'Anomic aphasia';
  }
  if (speechImpairments.length > 0) {
    // Capitalize the first impairment as a fallback
    return `Speech: ${speechImpairments[0].replace(/_/g, ' ')}`;
  }
  
  // Don't use stroke_location as aphasia type — it's misleading
  return null;
}

export function ClinicianPatientHeader() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const navigate = useNavigate();

  const { timeline, lastActiveDate, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(profileId, 14);
  const { alerts, unacknowledgedCount } = useRecoveryAlerts(profileId, timeline);
  const { todayCheckin } = useDailyReadiness(profileId);
  const { lastSession } = useLastSession(profileId);

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

  // Last active label
  const lastActiveLabel = (() => {
    if (!lastActiveDate) return 'No activity';
    const today = new Date().toISOString().slice(0, 10);
    if (lastActiveDate === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastActiveDate === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
    return new Date(lastActiveDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  // Engagement band from recent timeline
  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter(d => d.hasAnySignal).length;
  const engagementLabel = activeDays >= 5 ? 'High' : activeDays >= 3 ? 'Moderate' : activeDays >= 1 ? 'Low' : 'None';
  const engagementColor = activeDays >= 5 ? 'text-green-600 dark:text-green-400' : activeDays >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500';

  // Last session label
  const lastSessionLabel = (() => {
    if (!lastSession) return null;
    const d = new Date(lastSession.date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const handleCopyEHR = () => {
    try {
      const summary = formatEhrSummary({
        timeline,
        flags: [],
        alerts,
        lastActiveDate,
        engagement,
      });
      navigator.clipboard.writeText(summary);
      toast.success('EHR summary copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handlePrint = () => {
    navigate('/clinician-report?print=1');
  };

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

        {todayCheckin && (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Fatigue:</span>
            <span className="font-medium">{todayCheckin.fatigue_rating}/5</span>
          </div>
        )}
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
        <Button size="sm" variant="outline" onClick={() => navigate('/clinician-report')} className="gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Report
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
    </Card>
  );
}
