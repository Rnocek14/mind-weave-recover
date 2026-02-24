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
  Target
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useRecoveryAlerts } from '@/hooks/useRecoveryAlerts';
import { useDailyReadiness } from '@/hooks/useDailyReadiness';
import { useNavigate } from 'react-router-dom';
import { formatEhrSummary } from '@/lib/formatEhrSummary';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LastSessionData {
  date: string;
  durationMin: number;
  accuracy: number | null;
  exerciseCount: number;
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
        const { data: events } = await supabase
          .from('exercise_events')
          .select('score')
          .eq('session_id', s.id);

        const scores = (events || []).filter(e => e.score !== null);
        const avgAcc = scores.length > 0
          ? Math.round(scores.reduce((sum, e) => sum + (e.score || 0), 0) / scores.length * 100)
          : null;

        setLastSession({
          date: s.ended_at!,
          durationMin: Math.round((s.duration_sec || 0) / 60),
          accuracy: avgAcc,
          exerciseCount: (events || []).length,
        });
      } catch { setLastSession(null); }
      finally { setIsLoading(false); }
    };
    load();
  }, [profileId]);

  return { lastSession, isLoading };
}

export function ClinicianPatientHeader() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const navigate = useNavigate();

  const { timeline, lastActiveDate, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(profileId, 14);
  const { alerts, unacknowledgedCount } = useRecoveryAlerts(profileId, timeline);
  const { todayCheckin } = useDailyReadiness(profileId);
  const { lastSession } = useLastSession(profileId);

  // Derived data
  const clinicalProfile = activeProfile?.clinical_profile as Record<string, any> | null;
  const aphasiaType = clinicalProfile?.stroke_location || clinicalProfile?.impairments?.speech?.[0] || null;
  const strokeDate = activeProfile?.stroke_date;
  const daysPostOnset = strokeDate
    ? Math.floor((Date.now() - new Date(strokeDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

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
        engagement: null,
      });
      navigator.clipboard.writeText(summary);
      toast.success('EHR summary copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (snapshotLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-20 bg-muted rounded" />
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
              {aphasiaType && (
                <>
                  <span>•</span>
                  <span className="capitalize">{aphasiaType}</span>
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
          <span className="text-muted-foreground">{lastSession.exerciseCount} trials</span>
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
        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
          <Printer className="w-3.5 h-3.5" />
          Print
        </Button>
      </div>
    </Card>
  );
}