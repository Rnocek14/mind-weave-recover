import { Mic, MicOff, Radio, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LiveSnapshot } from '@/contexts/LiveAnalysisContext';

interface LiveInputCardProps {
  snapshot: LiveSnapshot;
  mode: 'patient' | 'clinician' | 'demo';
}

function confidenceLabel(conf?: number): { label: string; color: string } {
  if (conf == null) return { label: '—', color: 'bg-muted text-muted-foreground' };
  if (conf >= 0.8) return { label: 'High', color: 'bg-success/20 text-success' };
  if (conf >= 0.5) return { label: 'Medium', color: 'bg-warning/20 text-warning' };
  return { label: 'Low', color: 'bg-destructive/20 text-destructive' };
}

function formatMs(ms?: number): string {
  if (ms == null) return '—';
  return `${Math.round(ms)}ms`;
}

export function LiveInputCard({ snapshot, mode }: LiveInputCardProps) {
  const conf = confidenceLabel(snapshot.asrConfidence);
  const micIcon = snapshot.micState === 'listening' ? (
    <Mic className="h-3.5 w-3.5 text-success animate-pulse" />
  ) : snapshot.micState === 'processing' ? (
    <Radio className="h-3.5 w-3.5 text-warning animate-pulse" />
  ) : (
    <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {micIcon} Live Input
        </h4>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${conf.color}`}>
          {conf.label}
        </Badge>
      </div>

      {/* Transcript */}
      <div className="bg-card rounded-md border px-3 py-2 min-h-[36px]">
        <p className="text-sm font-medium break-words">
          {snapshot.transcript ? `"${snapshot.transcript}"` : (
            <span className="text-muted-foreground italic">Waiting for speech…</span>
          )}
        </p>
      </div>

      {/* Clinician extras */}
      {mode !== 'patient' && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {snapshot.asrConfidence != null && (
            <span>Conf: {(snapshot.asrConfidence * 100).toFixed(0)}%</span>
          )}
          {snapshot.latencyMs != null && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> {formatMs(snapshot.latencyMs)}
            </span>
          )}
          {snapshot.micState && (
            <span className="capitalize">{snapshot.micState}</span>
          )}
        </div>
      )}
    </div>
  );
}
