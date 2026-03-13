import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { LiveSnapshot } from '@/contexts/LiveAnalysisContext';

interface SpeechAnalysisCardProps {
  snapshot: LiveSnapshot;
  mode: 'patient' | 'clinician' | 'demo';
}

const ERROR_LABELS: Record<string, { label: string; color: string; patientLabel: string }> = {
  correct: { label: 'Correct', color: 'bg-success/20 text-success', patientLabel: 'Got it! ✓' },
  self_corrected: { label: 'Self-corrected', color: 'bg-success/20 text-success', patientLabel: 'Nice correction!' },
  attempted: { label: 'Attempted', color: 'bg-primary/20 text-primary', patientLabel: 'Good try!' },
  circumlocution: { label: 'Circumlocution', color: 'bg-primary/20 text-primary', patientLabel: 'Good description!' },
  phonemic_paraphasia: { label: 'Phonemic error', color: 'bg-warning/20 text-warning', patientLabel: 'Close sound' },
  semantic_paraphasia: { label: 'Semantic error', color: 'bg-warning/20 text-warning', patientLabel: 'Related word' },
  neologism: { label: 'Neologism', color: 'bg-destructive/20 text-destructive', patientLabel: 'Keep trying' },
  unrelated: { label: 'Unrelated', color: 'bg-destructive/20 text-destructive', patientLabel: 'Let\'s try again' },
  no_response: { label: 'No response', color: 'bg-muted text-muted-foreground', patientLabel: 'Take your time' },
  timeout: { label: 'Timeout', color: 'bg-muted text-muted-foreground', patientLabel: 'No rush' },
  uncertain: { label: 'Uncertain', color: 'bg-muted text-muted-foreground', patientLabel: 'Let me listen again' },
};

function ScoreBar({ label, value, max = 1 }: { label: string; value?: number; max?: number }) {
  if (value == null) return null;
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function SpeechAnalysisCard({ snapshot, mode }: SpeechAnalysisCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const errorInfo = ERROR_LABELS[snapshot.errorType || ''] || { label: snapshot.errorType || '—', color: 'bg-muted text-muted-foreground', patientLabel: '—' };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Speech Analysis
      </h4>

      {/* Target vs transcript */}
      {snapshot.targetWord && mode !== 'patient' && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Target:</span>
          <span className="font-semibold">{snapshot.targetWord}</span>
        </div>
      )}

      {/* Error classification */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-[11px] ${errorInfo.color}`}>
          {mode === 'patient' ? errorInfo.patientLabel : errorInfo.label}
        </Badge>
        {snapshot.encouragementScore != null && mode !== 'patient' && (
          <span className="text-[11px] text-muted-foreground">
            Score: {snapshot.encouragementScore}/100
          </span>
        )}
      </div>

      {/* Score bars - clinician/demo only */}
      {mode !== 'patient' && (
        <div className="space-y-1">
          <ScoreBar label="Phonological" value={snapshot.phonologicalSimilarity} />
          <ScoreBar label="Semantic" value={snapshot.semanticSimilarity} />
          {snapshot.pronunciationScore != null && (
            <ScoreBar label="Pronunciation" value={snapshot.pronunciationScore} max={100} />
          )}
          {snapshot.accuracyScore != null && (
            <ScoreBar label="Accuracy" value={snapshot.accuracyScore} max={100} />
          )}
          {snapshot.fluencyScore != null && (
            <ScoreBar label="Fluency" value={snapshot.fluencyScore} max={100} />
          )}
          {snapshot.prosodyScore != null && (
            <ScoreBar label="Prosody" value={snapshot.prosodyScore} max={100} />
          )}
        </div>
      )}

      {/* Flags */}
      {mode !== 'patient' && (
        <div className="flex flex-wrap gap-1">
          {snapshot.circumlocutionDetected && (
            <Badge variant="secondary" className="text-[10px]">Circumlocution</Badge>
          )}
          {snapshot.effortfulSpeech && (
            <Badge variant="secondary" className="text-[10px]">Effortful</Badge>
          )}
        </div>
      )}

      {/* Reasoning - clinician only */}
      {mode === 'clinician' && snapshot.reasoning && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-muted pl-2">
          {snapshot.reasoning}
        </p>
      )}

      {/* Raw data collapsible - demo/clinician */}
      {mode !== 'patient' && (
        <Collapsible open={showRaw} onOpenChange={setShowRaw}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3 w-3 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
            Raw Scores
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-[10px] bg-muted/50 rounded p-2 mt-1 overflow-x-auto max-h-32 text-muted-foreground">
              {JSON.stringify({
                errorType: snapshot.errorType,
                asrConfidence: snapshot.asrConfidence,
                phonologicalSimilarity: snapshot.phonologicalSimilarity,
                semanticSimilarity: snapshot.semanticSimilarity,
                pronunciationScore: snapshot.pronunciationScore,
                accuracyScore: snapshot.accuracyScore,
                fluencyScore: snapshot.fluencyScore,
                completenessScore: snapshot.completenessScore,
                prosodyScore: snapshot.prosodyScore,
                classificationConfidence: snapshot.classificationConfidence,
              }, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
