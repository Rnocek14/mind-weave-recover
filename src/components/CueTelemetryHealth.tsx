import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CueTelemetryHealthProps {
  userId?: string;
  daysBack?: number;
}

interface HealthStatus {
  totalUtterances: number;
  withCueType: number;
  withTrigger: number;
  withEffectiveness: number;
  actualCuesDelivered: number;
}

export const CueTelemetryHealth = ({ userId, daysBack = 30 }: CueTelemetryHealthProps) => {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        let query = supabase
          .from('utterance_analyses')
          .select('cue_type_given, cue_trigger, cue_was_effective')
          .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());
        
        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data, error: queryError } = await query;
        
        if (queryError) throw queryError;

        const rows = data || [];
        
        setStatus({
          totalUtterances: rows.length,
          withCueType: rows.filter(r => r.cue_type_given !== null).length,
          withTrigger: rows.filter(r => r.cue_trigger !== null).length,
          withEffectiveness: rows.filter(r => r.cue_was_effective !== null).length,
          actualCuesDelivered: rows.filter(r => r.cue_type_given && r.cue_type_given !== 'none').length,
        });
      } catch (err) {
        console.error('Failed to fetch cue telemetry health:', err);
        setError('Failed to check cue telemetry status');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, [userId, daysBack]);

  if (loading) return null;
  if (error) return null; // Silently fail for non-admin users

  if (!status || status.totalUtterances === 0) {
    return (
      <Alert variant="default" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Data Yet</AlertTitle>
        <AlertDescription>
          No utterance data in the last {daysBack} days. Complete some speech exercises to start tracking.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate health metrics
  const cueTypeRate = status.withCueType / status.totalUtterances;
  const triggerRate = status.actualCuesDelivered > 0 
    ? status.withTrigger / status.actualCuesDelivered 
    : null;
  const effectivenessRate = status.actualCuesDelivered > 0 
    ? status.withEffectiveness / status.actualCuesDelivered 
    : null;

  // Determine overall health
  const hasData = status.totalUtterances > 0;
  const cueTypeHealthy = cueTypeRate >= 0.95; // 95% should have cue_type_given
  const noCuesDelivered = status.actualCuesDelivered === 0;
  const triggerMissing = status.actualCuesDelivered > 0 && triggerRate !== null && triggerRate < 0.5;
  const effectivenessMissing = status.actualCuesDelivered > 0 && effectivenessRate !== null && effectivenessRate < 0.1;

  // If healthy, show nothing (or minimal success)
  if (hasData && cueTypeHealthy && !noCuesDelivered && !triggerMissing && !effectivenessMissing) {
    return null; // All good, no banner needed
  }

  // Build warning messages with specific diagnosis
  const warnings: string[] = [];
  const diagnoses: string[] = [];
  
  if (!cueTypeHealthy) {
    warnings.push(`Only ${Math.round(cueTypeRate * 100)}% of utterances have cue_type_given logged (should be >95%)`);
    diagnoses.push('Logging pipeline issue: check logFinalAnalysis is receiving cueTypeGiven');
  }
  
  if (noCuesDelivered) {
    warnings.push(`0 cues delivered in ${daysBack} days (${status.totalUtterances} utterances)`);
    // Diagnose the specific failure mode
    if (status.withCueType === status.totalUtterances && status.totalUtterances > 0) {
      diagnoses.push('Auto-cue logic never fires: stall timer or consecutiveErrors threshold not triggering triggerAutoCue()');
    } else {
      diagnoses.push('Both logging and triggering appear broken');
    }
  } else {
    if (triggerMissing) {
      warnings.push(`Only ${Math.round((triggerRate || 0) * 100)}% of delivered cues have trigger logged`);
      diagnoses.push('cue_trigger not being set in cueState when cue shows');
    }
    if (effectivenessMissing) {
      warnings.push(`Only ${Math.round((effectivenessRate || 0) * 100)}% of delivered cues have effectiveness logged`);
      diagnoses.push('cue_was_effective not being computed in logFinalAnalysis (check 6s attribution window)');
    }
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Cue Learning Loop Issue</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 mt-2 space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-sm">{w}</li>
          ))}
        </ul>
        {diagnoses.length > 0 && (
          <div className="mt-3 p-2 bg-muted rounded text-xs">
            <strong>Likely cause:</strong>
            <ul className="list-disc pl-4 mt-1">
              {diagnoses.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Last {daysBack}d: {status.totalUtterances} utterances, {status.actualCuesDelivered} cues delivered
        </p>
      </AlertDescription>
    </Alert>
  );
};
