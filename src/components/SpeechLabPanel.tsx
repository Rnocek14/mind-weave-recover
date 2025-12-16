import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Clock, 
  AudioWaveform, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  BarChart3,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InsightEvidenceBadge } from './InsightEvidenceBadge';
import { StaffPipelineControls } from './StaffPipelineControls';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { pronunciationHealth, type PronunciationHealthStatus } from '@/lib/pipelineOpsClient';

interface SpeechLabPanelProps {
  userId: string;
  daysBack?: number;
}

interface PipelineStats {
  total: number;
  complete: number;
  pending: number;
  processing: number;
  failed: number;
  withAlignment: number;
  withGop: number;
  withAudio: number;
  withAzure: number; // Azure pronunciation assessment data
}

interface FluencyStats {
  avgSpeechRateWpm: number | null;
  avgPauseCount: number | null;
  avgPauseDurationMs: number | null;
  effortfulSpeechRate: number;
  sampleCount: number;
}

interface AlignmentStats {
  avgArticulationRate: number | null;
  avgSpeechRatio: number | null;
  avgGopScore: number | null;
  sampleCount: number;
}

interface WorkerStatus {
  workerId: string;
  lastSeen: Date;
  status: 'active' | 'stale' | 'offline';
  meta?: Record<string, unknown>;
}

interface QueueHealth {
  oldestPendingAgeMin: number | null;
  p50PendingAgeMin: number | null;
  p90PendingAgeMin: number | null;
  stuckProcessingCount: number;
  completedLast60Min: number;
  failedRetryCapped: number;
}

export const SpeechLabPanel = ({ userId, daysBack = 7 }: SpeechLabPanelProps) => {
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [fluencyStats, setFluencyStats] = useState<FluencyStats | null>(null);
  const [alignmentStats, setAlignmentStats] = useState<AlignmentStats | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [queueHealth, setQueueHealth] = useState<QueueHealth | null>(null);
  const [azureHealth, setAzureHealth] = useState<{ status: 'loading' | 'ready' | 'misconfigured' | 'offline'; details?: PronunciationHealthStatus }>({ status: 'loading' });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isAdmin, isModerator } = useUserPermissions(userId);
  const isStaff = isAdmin || isModerator;

  // Check Azure health on mount and refresh
  useEffect(() => {
    const checkAzureHealth = async () => {
      try {
        const health = await pronunciationHealth();
        if (health.configured) {
          setAzureHealth({ status: 'ready', details: health });
        } else {
          setAzureHealth({ status: 'misconfigured', details: health });
        }
      } catch (error) {
        console.error('Azure health check failed:', error);
        setAzureHealth({ status: 'offline' });
      }
    };
    checkAzureHealth();
  }, [refreshKey]);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      try {
        // Fetch all utterances for detailed queue analysis
        const { data: utterances, error } = await supabase
          .from('utterance_analyses')
          .select('analysis_status, alignment_data, gop_data, audio_storage_path, speech_rate_wpm, pause_count, avg_pause_duration_ms, effortful_speech, speech_ratio, created_at, locked_at, retry_count, updated_at')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString());

        if (error) throw error;

        // Fetch worker heartbeat (staff only)
        const { data: heartbeats } = await supabase
          .from('worker_heartbeats')
          .select('worker_id, last_seen, status, meta')
          .order('last_seen', { ascending: false })
          .limit(1);

        if (heartbeats && heartbeats.length > 0) {
          const hb = heartbeats[0];
          const lastSeen = new Date(hb.last_seen);
          const ageMs = Date.now() - lastSeen.getTime();
          const ageMinutes = ageMs / 1000 / 60;
          
          let status: 'active' | 'stale' | 'offline';
          if (ageMinutes < 1) status = 'active';
          else if (ageMinutes < 5) status = 'stale';
          else status = 'offline';

          setWorkerStatus({
            workerId: hb.worker_id,
            lastSeen,
            status,
            meta: hb.meta as Record<string, unknown>
          });
        }

        // Calculate queue health metrics
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        const tenMinutesAgo = now - 10 * 60 * 1000;
        
        const pendingAges: number[] = [];
        let stuckProcessingCount = 0;
        let completedLast60Min = 0;
        let failedRetryCapped = 0;

        utterances?.forEach(u => {
          if (u.analysis_status === 'pending' && u.created_at) {
            const ageMin = (now - new Date(u.created_at).getTime()) / 1000 / 60;
            pendingAges.push(ageMin);
          }
          
          if (u.analysis_status === 'processing' && u.locked_at) {
            const lockedAt = new Date(u.locked_at).getTime();
            if (lockedAt < tenMinutesAgo) {
              stuckProcessingCount++;
            }
          }
          
          if (u.analysis_status === 'complete' && u.updated_at) {
            const completedAt = new Date(u.updated_at).getTime();
            if (completedAt > oneHourAgo) {
              completedLast60Min++;
            }
          }
          
          if (u.analysis_status === 'failed' && (u.retry_count ?? 0) >= 5) {
            failedRetryCapped++;
          }
        });

        // Calculate percentiles
        pendingAges.sort((a, b) => a - b);
        const p50Index = Math.floor(pendingAges.length * 0.5);
        const p90Index = Math.floor(pendingAges.length * 0.9);
        
        setQueueHealth({
          oldestPendingAgeMin: pendingAges.length > 0 ? Math.round(pendingAges[pendingAges.length - 1]) : null,
          p50PendingAgeMin: pendingAges.length > 0 ? Math.round(pendingAges[p50Index]) : null,
          p90PendingAgeMin: pendingAges.length > 0 ? Math.round(pendingAges[p90Index]) : null,
          stuckProcessingCount,
          completedLast60Min,
          failedRetryCapped
        });

        // Calculate pipeline stats
        const pipeline: PipelineStats = {
          total: utterances?.length || 0,
          complete: 0,
          pending: 0,
          processing: 0,
          failed: 0,
          withAlignment: 0,
          withGop: 0,
          withAudio: 0,
          withAzure: 0
        };

        const fluencySamples: { wpm: number; pauses: number; duration: number; effortful: boolean }[] = [];
        const alignmentSamples: { articulationRate: number; speechRatio: number; gopScore: number }[] = [];

        utterances?.forEach(u => {
          // Pipeline status
          switch (u.analysis_status) {
            case 'complete': pipeline.complete++; break;
            case 'pending': pipeline.pending++; break;
            case 'processing': pipeline.processing++; break;
            case 'failed': pipeline.failed++; break;
          }
          
          if (u.alignment_data) pipeline.withAlignment++;
          if (u.gop_data) {
            pipeline.withGop++;
            // Check if this is Azure data
            const gopData = u.gop_data as any;
            if (gopData?.source === 'azure') {
              pipeline.withAzure++;
            }
          }
          if (u.audio_storage_path) pipeline.withAudio++;

          // Fluency samples (from Whisper/browser estimates)
          if (u.speech_rate_wpm != null) {
            fluencySamples.push({
              wpm: u.speech_rate_wpm,
              pauses: u.pause_count || 0,
              duration: u.avg_pause_duration_ms || 0,
              effortful: u.effortful_speech || false
            });
          }

          // Alignment samples (from MFA worker OR Azure)
          if (u.gop_data) {
            const gopData = u.gop_data as any;
            if (gopData?.source === 'azure') {
              // Azure pronunciation data
              alignmentSamples.push({
                articulationRate: 0, // Azure doesn't provide this
                speechRatio: 0, // Azure doesn't provide this
                gopScore: gopData.pronunciationScore || gopData.accuracyScore || 0
              });
            } else if (u.alignment_data) {
              // MFA worker data
              alignmentSamples.push({
                articulationRate: gopData?.metrics?.articulation_rate_phonemes_per_sec || 0,
                speechRatio: u.speech_ratio || gopData?.metrics?.speech_ratio || 0,
                gopScore: gopData?.overall_score || 0
              });
            }
          }
        });

        setPipelineStats(pipeline);

        // Calculate fluency averages
        if (fluencySamples.length > 0) {
          const effortfulCount = fluencySamples.filter(s => s.effortful).length;
          setFluencyStats({
            avgSpeechRateWpm: Math.round(fluencySamples.reduce((a, s) => a + s.wpm, 0) / fluencySamples.length),
            avgPauseCount: Math.round(fluencySamples.reduce((a, s) => a + s.pauses, 0) / fluencySamples.length * 10) / 10,
            avgPauseDurationMs: Math.round(fluencySamples.reduce((a, s) => a + s.duration, 0) / fluencySamples.length),
            effortfulSpeechRate: Math.round((effortfulCount / fluencySamples.length) * 100),
            sampleCount: fluencySamples.length
          });
        } else {
          setFluencyStats(null);
        }

        // Calculate alignment averages
        if (alignmentSamples.length > 0) {
          setAlignmentStats({
            avgArticulationRate: Math.round(alignmentSamples.reduce((a, s) => a + s.articulationRate, 0) / alignmentSamples.length * 10) / 10,
            avgSpeechRatio: Math.round(alignmentSamples.reduce((a, s) => a + s.speechRatio, 0) / alignmentSamples.length * 100),
            avgGopScore: Math.round(alignmentSamples.reduce((a, s) => a + s.gopScore, 0) / alignmentSamples.length * 100),
            sampleCount: alignmentSamples.length
          });
        } else {
          setAlignmentStats(null);
        }

      } catch (err) {
        console.error('Failed to fetch speech lab stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) fetchStats();
  }, [userId, daysBack, refreshKey]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AudioWaveform className="w-5 h-5" />
            Speech Lab
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pipelineStats || pipelineStats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AudioWaveform className="w-5 h-5" />
            Speech Lab
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No speech data in the last {daysBack} days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AudioWaveform className="w-5 h-5" />
          Speech Lab
          <Badge variant="outline" className="ml-auto text-xs">Clinician</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pronunciation Analysis Source - Real Azure health check */}
        <div className="flex items-center gap-3 p-3 rounded bg-muted/30">
          {pipelineStats.withAzure > 0 ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Azure Pronunciation Assessment: Active</span>
                  <Badge variant="default" className="text-xs">
                    {pipelineStats.withAzure} analyzed
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time pronunciation scoring enabled (MFA worker not required)
                </p>
              </div>
            </>
          ) : azureHealth.status === 'ready' ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Azure Pronunciation Assessment: Ready</span>
                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                    Configured
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Will analyze pronunciation when voice exercises are used with recording enabled
                </p>
              </div>
            </>
          ) : azureHealth.status === 'misconfigured' ? (
            <>
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Azure Pronunciation Assessment: Misconfigured</span>
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                    Missing {!azureHealth.details?.hasKey && 'API Key'}{!azureHealth.details?.hasKey && !azureHealth.details?.hasRegion && ' & '}{!azureHealth.details?.hasRegion && 'Region'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to Supabase secrets
                </p>
              </div>
            </>
          ) : azureHealth.status === 'offline' ? (
            <>
              <WifiOff className="w-5 h-5 text-destructive" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Azure Pronunciation Assessment: Offline</span>
                  <Badge variant="destructive" className="text-xs">
                    Unreachable
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Could not connect to Azure health endpoint
                </p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <div className="flex-1">
                <span className="font-medium text-sm text-muted-foreground">Checking Azure status...</span>
              </div>
            </>
          )}
        </div>

        {/* Worker Offline Alert - only show when there are RECENT pending MFA jobs AND Azure is NOT handling them */}
        {/* Legacy pending jobs (> 2 hours old) are ignored since Azure is now the primary path */}
        {pipelineStats.pending > 0 && 
         pipelineStats.withAzure === 0 && 
         (!workerStatus || workerStatus.status !== 'active') &&
         queueHealth?.oldestPendingAgeMin !== null && 
         queueHealth.oldestPendingAgeMin < 120 && (
          <div className="p-4 rounded-lg border-2 border-destructive/50 bg-destructive/10">
            <div className="flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive">MFA Worker Offline</h4>
                <p className="text-sm text-destructive/80 mt-1">
                  {pipelineStats.pending} job(s) are queued but no worker heartbeat is present. 
                  Azure Pronunciation Assessment is now the recommended alternative.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Oldest pending: {queueHealth.oldestPendingAgeMin < 60 
                    ? `${queueHealth.oldestPendingAgeMin}m` 
                    : `${Math.round(queueHealth.oldestPendingAgeMin / 60)}h ${queueHealth.oldestPendingAgeMin % 60}m`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Queue Health */}
        {queueHealth && (pipelineStats.pending > 0 || queueHealth.stuckProcessingCount > 0 || queueHealth.failedRetryCapped > 0) && (
          <div className="p-3 rounded border border-border bg-muted/20">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Queue Health
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {queueHealth.oldestPendingAgeMin !== null && (
                <div>
                  <span className="text-muted-foreground">Oldest pending:</span>
                  <span className={`ml-2 font-medium ${queueHealth.oldestPendingAgeMin > 60 ? 'text-red-500' : queueHealth.oldestPendingAgeMin > 30 ? 'text-yellow-500' : ''}`}>
                    {queueHealth.oldestPendingAgeMin < 60 
                      ? `${queueHealth.oldestPendingAgeMin}m` 
                      : `${Math.round(queueHealth.oldestPendingAgeMin / 60)}h`}
                  </span>
                </div>
              )}
              {queueHealth.p50PendingAgeMin !== null && (
                <div>
                  <span className="text-muted-foreground">p50 age:</span>
                  <span className="ml-2 font-medium">{queueHealth.p50PendingAgeMin}m</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Completed (1h):</span>
                <span className="ml-2 font-medium text-green-600">{queueHealth.completedLast60Min}</span>
              </div>
            </div>
            
            {queueHealth.stuckProcessingCount > 0 && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {queueHealth.stuckProcessingCount} job(s) stuck in processing &gt;10min (will auto-reclaim)
              </div>
            )}
            
            {queueHealth.failedRetryCapped > 0 && (
              <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded text-sm text-orange-700 dark:text-orange-300">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {queueHealth.failedRetryCapped} job(s) permanently failed (retry cap reached)
              </div>
            )}
          </div>
        )}

        {/* Pipeline Status */}
        <div>
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Analysis Pipeline Status
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Complete:</span>
              <span className="font-medium">{pipelineStats.complete}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-medium">{pipelineStats.pending}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 text-blue-500" />
              <span className="text-muted-foreground">Processing:</span>
              <span className="font-medium">{pipelineStats.processing}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-muted-foreground">Failed:</span>
              <span className="font-medium">{pipelineStats.failed}</span>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-muted-foreground">
            {pipelineStats.withAudio} utterances have audio | {pipelineStats.withAlignment} have alignment data | {pipelineStats.withGop} have GOP scores
          </div>
          
          {pipelineStats.pending > 0 && pipelineStats.withAlignment === 0 && pipelineStats.withAzure === 0 && (
            <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-yellow-700 dark:text-yellow-300">
                    No Pronunciation Analysis Active
                  </span>
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                    {pipelineStats.pending} utterances with audio are queued. 
                    Azure Pronunciation Assessment is now the recommended analysis method.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {pipelineStats.pending > 0 && (pipelineStats.withAlignment > 0 || pipelineStats.withAzure > 0) && (
            <div className="mt-2 p-2 bg-blue-500/10 rounded text-sm text-blue-700 dark:text-blue-300">
              <Clock className="w-4 h-4 inline mr-1" />
              {pipelineStats.pending} more utterances awaiting analysis
            </div>
          )}
        </div>

        {/* Fluency Metrics (from Whisper estimates) */}
        {fluencyStats && (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Fluency Estimates
              <InsightEvidenceBadge
                windowLabel={`Last ${daysBack} days`}
                n={fluencyStats.sampleCount}
                confidence={fluencyStats.sampleCount >= 20 ? 'high' : fluencyStats.sampleCount >= 10 ? 'medium' : 'low'}
                evidencePoints={['Computed from Whisper ASR timestamps']}
              />
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/50 rounded">
                <div className="text-2xl font-bold">{fluencyStats.avgSpeechRateWpm}</div>
                <div className="text-xs text-muted-foreground">Avg WPM</div>
              </div>
              <div className="p-3 bg-muted/50 rounded">
                <div className="text-2xl font-bold">{fluencyStats.avgPauseCount}</div>
                <div className="text-xs text-muted-foreground">Avg Pauses</div>
              </div>
              <div className="p-3 bg-muted/50 rounded">
                <div className="text-2xl font-bold">{fluencyStats.avgPauseDurationMs}ms</div>
                <div className="text-xs text-muted-foreground">Avg Pause Len</div>
              </div>
              <div className="p-3 bg-muted/50 rounded">
                <div className="text-2xl font-bold">{fluencyStats.effortfulSpeechRate}%</div>
                <div className="text-xs text-muted-foreground">Effortful Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Pronunciation Metrics (from Azure or MFA) */}
        {alignmentStats ? (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {pipelineStats.withAzure > 0 ? 'Azure Pronunciation Scores' : 'Phoneme-Level Alignment'}
              <InsightEvidenceBadge
                windowLabel={`Last ${daysBack} days`}
                n={alignmentStats.sampleCount}
                confidence={alignmentStats.sampleCount >= 10 ? 'high' : alignmentStats.sampleCount >= 5 ? 'medium' : 'low'}
                evidencePoints={pipelineStats.withAzure > 0 
                  ? ['Azure Pronunciation Assessment API', 'Accuracy + Fluency + Completeness'] 
                  : ['Computed from MFA forced alignment', 'GOP v1 proxy scoring']}
              />
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {pipelineStats.withAzure > 0 ? (
                // Azure metrics
                <div className="col-span-3 p-3 bg-muted/50 rounded text-center">
                  <div className="text-3xl font-bold">{alignmentStats.avgGopScore}%</div>
                  <div className="text-xs text-muted-foreground">Avg Pronunciation Score</div>
                </div>
              ) : (
                // MFA metrics
                <>
                  <div className="p-3 bg-muted/50 rounded">
                    <div className="text-2xl font-bold">{alignmentStats.avgArticulationRate}</div>
                    <div className="text-xs text-muted-foreground">Phones/sec</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <div className="text-2xl font-bold">{alignmentStats.avgSpeechRatio}%</div>
                    <div className="text-xs text-muted-foreground">Speech Ratio</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <div className="text-2xl font-bold">{alignmentStats.avgGopScore}%</div>
                    <div className="text-xs text-muted-foreground">GOP Score</div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Pronunciation Analysis
            </h4>
            <div className="p-4 bg-muted/30 rounded text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              No pronunciation data available yet. 
              {pipelineStats.pending > 0 
                ? ` ${pipelineStats.pending} utterances are queued for analysis.`
                : pipelineStats.withAudio === 0 
                  ? ' No audio recordings found.'
                  : ' Enable Azure Pronunciation Assessment for real-time scoring.'}
            </div>
          </div>
        )}

        {/* Staff Pipeline Controls */}
        {isStaff && <StaffPipelineControls userId={userId} onRefresh={handleRefresh} />}
      </CardContent>
    </Card>
  );
};