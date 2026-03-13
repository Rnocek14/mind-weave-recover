import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Coffee } from 'lucide-react';
import type { LiveSnapshot } from '@/contexts/LiveAnalysisContext';

interface SessionStateCardProps {
  snapshot: LiveSnapshot;
  mode: 'patient' | 'clinician' | 'demo';
}

function MiniAccuracyDots({ accuracies }: { accuracies: number[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {accuracies.map((acc, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            acc >= 0.8 ? 'bg-success' : acc >= 0.4 ? 'bg-warning' : 'bg-destructive'
          }`}
          title={`Trial: ${(acc * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  );
}

export function SessionStateCard({ snapshot, mode }: SessionStateCardProps) {
  if (mode === 'patient') {
    // Minimal: just progress
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Progress
        </h4>
        {snapshot.trialIndex != null && snapshot.trialTotal != null && (
          <p className="text-xs text-muted-foreground">
            Trial {snapshot.trialIndex} of {snapshot.trialTotal}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5" /> Session State
      </h4>

      {/* Trial progress */}
      {snapshot.trialIndex != null && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Trial</span>
          <span className="font-medium">
            {snapshot.trialIndex}{snapshot.trialTotal ? ` / ${snapshot.trialTotal}` : ''}
          </span>
        </div>
      )}

      {/* Recent accuracy dots */}
      {snapshot.recentAccuracies && snapshot.recentAccuracies.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Recent:</span>
          <MiniAccuracyDots accuracies={snapshot.recentAccuracies} />
        </div>
      )}

      {/* Consecutive errors */}
      {snapshot.consecutiveErrors != null && snapshot.consecutiveErrors > 0 && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <AlertTriangle className="h-3 w-3 text-warning" />
          <span className="text-warning">{snapshot.consecutiveErrors} consecutive error{snapshot.consecutiveErrors !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Frustration / fatigue */}
      <div className="flex flex-wrap gap-1">
        {snapshot.frustrationLevel && snapshot.frustrationLevel !== 'none' && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
            snapshot.frustrationLevel === 'high' ? 'border-destructive text-destructive' : 'border-warning text-warning'
          }`}>
            Frustration: {snapshot.frustrationLevel}
          </Badge>
        )}
        {snapshot.fatigueFlag && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning text-warning">
            <Coffee className="h-2.5 w-2.5 mr-0.5" /> Fatigue
          </Badge>
        )}
      </div>

      {/* Pivot recommendation */}
      {snapshot.pivotRecommendation && (
        <div className="bg-accent/10 border border-accent/20 rounded-md p-2 text-[11px]">
          <div className="flex items-center gap-1 font-medium text-accent-foreground mb-0.5">
            <AlertTriangle className="h-3 w-3" />
            Pivot: {snapshot.pivotRecommendation.action.replace(/_/g, ' ')}
          </div>
          <p className="text-muted-foreground">{snapshot.pivotRecommendation.reason}</p>
        </div>
      )}
    </div>
  );
}
