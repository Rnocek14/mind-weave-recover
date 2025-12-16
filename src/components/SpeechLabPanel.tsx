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

export const SpeechLabPanel = ({ userId, daysBack = 7 }: SpeechLabPanelProps) => {
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [fluencyStats, setFluencyStats] = useState<FluencyStats | null>(null);
  const [alignmentStats, setAlignmentStats] = useState<AlignmentStats | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      try {
        // Fetch pipeline status distribution
        const { data: utterances, error } = await supabase
          .from('utterance_analyses')
          .select('analysis_status, alignment_data, gop_data, audio_storage_path, speech_rate_wpm, pause_count, avg_pause_duration_ms, effortful_speech, speech_ratio')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString());

        if (error) throw error;

        // Fetch worker heartbeat (admin only - will fail silently for non-admins)
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

        // Calculate pipeline stats
        const pipeline: PipelineStats = {
          total: utterances?.length || 0,
          complete: 0,
          pending: 0,
          processing: 0,
          failed: 0,
          withAlignment: 0,
          withGop: 0,
          withAudio: 0
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
          if (u.gop_data) pipeline.withGop++;
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

          // Alignment samples (from MFA worker)
          if (u.alignment_data && u.gop_data) {
            const gopData = u.gop_data as any;
            alignmentSamples.push({
              articulationRate: gopData?.metrics?.articulation_rate_phonemes_per_sec || 0,
              speechRatio: u.speech_ratio || gopData?.metrics?.speech_ratio || 0,
              gopScore: gopData?.overall_score || 0
            });
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
  }, [userId, daysBack]);

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
        {/* Worker Status */}
        <div className="flex items-center gap-3 p-3 rounded bg-muted/30">
          {workerStatus ? (
            <>
              {workerStatus.status === 'active' ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : workerStatus.status === 'stale' ? (
                <Wifi className="w-5 h-5 text-yellow-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    MFA Worker: {workerStatus.status === 'active' ? 'Active' : workerStatus.status === 'stale' ? 'Stale' : 'Offline'}
                  </span>
                  <Badge variant={workerStatus.status === 'active' ? 'default' : workerStatus.status === 'stale' ? 'secondary' : 'destructive'} className="text-xs">
                    {workerStatus.workerId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last seen: {workerStatus.lastSeen.toLocaleTimeString()}
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <span className="font-medium text-sm text-muted-foreground">MFA Worker: No heartbeat</span>
                <p className="text-xs text-muted-foreground">Worker has not reported in yet</p>
              </div>
            </>
          )}
        </div>

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
          
          {pipelineStats.pending > 0 && pipelineStats.withAlignment === 0 && (
            <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-yellow-700 dark:text-yellow-300">
                    MFA Worker Not Active
                  </span>
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                    {pipelineStats.pending} utterances with audio are queued but no alignment data has been produced. 
                    The Fly.io speech worker needs to be deployed and running.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {pipelineStats.pending > 0 && pipelineStats.withAlignment > 0 && (
            <div className="mt-2 p-2 bg-blue-500/10 rounded text-sm text-blue-700 dark:text-blue-300">
              <Clock className="w-4 h-4 inline mr-1" />
              {pipelineStats.pending} more utterances awaiting MFA alignment
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

        {/* Alignment Metrics (from MFA worker) */}
        {alignmentStats ? (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Phoneme-Level Alignment
              <InsightEvidenceBadge
                windowLabel={`Last ${daysBack} days`}
                n={alignmentStats.sampleCount}
                confidence={alignmentStats.sampleCount >= 10 ? 'high' : alignmentStats.sampleCount >= 5 ? 'medium' : 'low'}
                evidencePoints={['Computed from MFA forced alignment', 'GOP v1 proxy scoring']}
              />
            </h4>
            <div className="grid grid-cols-3 gap-4">
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
            </div>
          </div>
        ) : (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Phoneme-Level Alignment
            </h4>
            <div className="p-4 bg-muted/30 rounded text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              No alignment data available yet. 
              {pipelineStats.pending > 0 
                ? ` ${pipelineStats.pending} utterances are queued for MFA analysis.`
                : pipelineStats.withAudio === 0 
                  ? ' No audio recordings found.'
                  : ' The MFA worker may not be running.'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};