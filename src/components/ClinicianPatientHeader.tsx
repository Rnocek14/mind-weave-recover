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
  CheckCircle
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useRecoveryAlerts } from '@/hooks/useRecoveryAlerts';
import { useDailyReadiness } from '@/hooks/useDailyReadiness';
import { useNavigate } from 'react-router-dom';
import { formatEhrSummary } from '@/lib/formatEhrSummary';
import { toast } from 'sonner';

export function ClinicianPatientHeader() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;
  const navigate = useNavigate();

  const { timeline, lastActiveDate, isLoading: snapshotLoading } = useWeeklyRecoverySnapshot(profileId, 14);
  const { alerts, unacknowledgedCount } = useRecoveryAlerts(profileId, timeline);
  const { todayCheckin } = useDailyReadiness(profileId);

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
        <div className="h-16 bg-muted rounded" />
      </Card>
    );
  }

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      {/* Row 1: Patient identity + status */}
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

      {/* Row 2: Status chips */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Last active:</span>
          <span className="font-medium">{lastActiveLabel}</span>
        </div>

        {todayCheckin && (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Fatigue:</span>
            <span className="font-medium">{todayCheckin.fatigue_rating}/5</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Engagement:</span>
          <span className={`font-medium ${engagementColor}`}>{engagementLabel}</span>
          <span className="text-muted-foreground text-xs">({activeDays}/7d)</span>
        </div>
      </div>

      {/* Row 3: Quick actions */}
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
      </div>
    </Card>
  );
}
