import { ArrowDown, Brain } from 'lucide-react';
import type { DecisionChain } from '@/contexts/LiveAnalysisContext';

interface DecisionChainCardProps {
  chain: DecisionChain;
  mode: 'patient' | 'clinician' | 'demo';
}

function ChainStep({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-start gap-2 text-[11px] ${highlight ? 'font-medium' : ''}`}>
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className={highlight ? 'text-primary' : ''}>{value}</span>
    </div>
  );
}

export function DecisionChainCard({ chain, mode }: DecisionChainCardProps) {
  if (mode === 'patient') return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5" /> Decision Chain
      </h4>

      <div className="bg-card border rounded-md p-2.5 space-y-1">
        <ChainStep label="Heard" value={`"${chain.transcript}"`} />
        <div className="flex items-center pl-8">
          <ArrowDown className="h-3 w-3 text-muted-foreground" />
        </div>
        <ChainStep label="Detected" value={chain.detected} highlight />
        <ChainStep label="Confidence" value={chain.confidence} />
        <div className="flex items-center pl-8">
          <ArrowDown className="h-3 w-3 text-muted-foreground" />
        </div>
        <ChainStep label="Cue" value={chain.cueChosen} highlight />
        <ChainStep label="Difficulty" value={chain.difficultyAction} />
        <div className="flex items-center pl-8">
          <ArrowDown className="h-3 w-3 text-muted-foreground" />
        </div>
        <ChainStep label="Reason" value={chain.reason} />
      </div>
    </div>
  );
}
