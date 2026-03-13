import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, History } from 'lucide-react';
import { useState } from 'react';
import type { AuditEvent } from '@/contexts/LiveAnalysisContext';

interface AuditTrailCardProps {
  events: AuditEvent[];
  mode: 'patient' | 'clinician' | 'demo';
}

const SOURCE_COLORS: Record<string, string> = {
  asr: 'bg-primary/20 text-primary',
  utterance_analyzer: 'bg-secondary/20 text-secondary',
  adaptation_engine: 'bg-accent/20 text-accent-foreground',
  pivot_engine: 'bg-warning/20 text-warning',
  lesson_planner: 'bg-muted text-muted-foreground',
  cue_selector: 'bg-success/20 text-success',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function AuditEventRow({ event, mode }: { event: AuditEvent; mode: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const sourceColor = SOURCE_COLORS[event.source] || 'bg-muted text-muted-foreground';

  return (
    <div className="py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap mt-0.5">
          {formatTime(event.timestamp)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${sourceColor}`}>
              {event.source.replace(/_/g, ' ')}
            </Badge>
            <span className="text-[11px] font-medium truncate">{event.label}</span>
          </div>
          {event.detail && mode !== 'patient' && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{event.detail}</p>
          )}
          {event.rawData && mode === 'clinician' && (
            <Collapsible open={showRaw} onOpenChange={setShowRaw}>
              <CollapsibleTrigger className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mt-0.5">
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
                raw
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-[9px] bg-muted/50 rounded p-1.5 mt-0.5 overflow-x-auto max-h-20">
                  {JSON.stringify(event.rawData, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditTrailCard({ events, mode }: AuditTrailCardProps) {
  if (mode === 'patient') return null; // Never show audit trail to patients

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" /> Audit Trail
        {events.length > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">{events.length}</Badge>
        )}
      </h4>

      {events.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No events yet</p>
      ) : (
        <ScrollArea className="max-h-40">
          <div className="pr-2">
            {events.map(event => (
              <AuditEventRow key={event.id} event={event} mode={mode} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
