import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Zap } from 'lucide-react';
import { useState } from 'react';
import type { LiveSnapshot } from '@/contexts/LiveAnalysisContext';
import { HelpLabel } from '@/components/HelpTooltip';

interface AdaptationCardProps {
  snapshot: LiveSnapshot;
  mode: 'patient' | 'clinician' | 'demo';
}

const CUE_LABELS: Record<string, string> = {
  none: 'No cue',
  semantic: 'Semantic cue',
  phonemic: 'Phonemic cue',
  full_word: 'Full word',
  sentence_frame: 'Sentence frame',
};

export function AdaptationCard({ snapshot, mode }: AdaptationCardProps) {
  const [showReasons, setShowReasons] = useState(false);

  if (mode === 'patient') {
    // Patient-safe: just show current hint type + difficulty trend
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> How It's Helping
        </h4>
        {snapshot.cueType && snapshot.cueType !== 'none' && (
          <p className="text-xs text-muted-foreground">
            Hint: {CUE_LABELS[snapshot.cueType] || snapshot.cueType}
          </p>
        )}
        {snapshot.difficultyTier != null && (
          <p className="text-xs text-muted-foreground">
            Difficulty: Level {snapshot.difficultyTier}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" /> <HelpLabel term="Adaptation Engine">Adaptation Engine</HelpLabel>
      </h4>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {snapshot.currentDomain && (
          <>
            <span className="text-muted-foreground"><HelpLabel term="Domain">Domain</HelpLabel></span>
            <span className="font-medium capitalize">{snapshot.currentDomain.replace(/_/g, ' ')}</span>
          </>
        )}
        {snapshot.difficultyTier != null && (
          <>
            <span className="text-muted-foreground"><HelpLabel term="Difficulty Tier">Difficulty</HelpLabel></span>
            <span className="font-medium">Level {snapshot.difficultyTier}</span>
          </>
        )}
        {snapshot.cueType && (
          <>
            <span className="text-muted-foreground">Cue</span>
            <span className="font-medium">{CUE_LABELS[snapshot.cueType] || snapshot.cueType}</span>
          </>
        )}
        {snapshot.cueLevel != null && snapshot.cueLevel > 0 && (
          <>
            <span className="text-muted-foreground">Cue level</span>
            <span className="font-medium">{snapshot.cueLevel}/3</span>
          </>
        )}
        {snapshot.transferIndex != null && (
          <>
            <span className="text-muted-foreground"><HelpLabel term="Transfer Index">Transfer</HelpLabel></span>
            <span className="font-medium">{(snapshot.transferIndex * 100).toFixed(0)}%</span>
          </>
        )}
        {snapshot.profileConfidence && (
          <>
            <span className="text-muted-foreground"><HelpLabel term="Confidence Level">Profile</HelpLabel></span>
            <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0 capitalize">
              {snapshot.profileConfidence}
            </Badge>
          </>
        )}
      </div>

      {/* Focus phonemes */}
      {snapshot.focusPhonemes && snapshot.focusPhonemes.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground"><HelpLabel term="Focus Phonemes">Focus:</HelpLabel></span>
          {snapshot.focusPhonemes.map(p => (
            <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{p}</Badge>
          ))}
        </div>
      )}

      {/* Scheduled repetition words */}
      {snapshot.scheduledRepetitionWords && snapshot.scheduledRepetitionWords.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Repetition:</span>
          {snapshot.scheduledRepetitionWords.map(w => (
            <Badge key={w} variant="outline" className="text-[10px] px-1.5 py-0">{w}</Badge>
          ))}
        </div>
      )}

      {/* Adaptation reasons (collapsible) */}
      {snapshot.adaptationReasons && snapshot.adaptationReasons.length > 0 && (
        <Collapsible open={showReasons} onOpenChange={setShowReasons}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3 w-3 transition-transform ${showReasons ? 'rotate-180' : ''}`} />
            {snapshot.adaptationReasons.length} adaptation reason{snapshot.adaptationReasons.length !== 1 ? 's' : ''}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="text-[10px] text-muted-foreground space-y-0.5 mt-1 pl-3">
              {snapshot.adaptationReasons.map((r, i) => (
                <li key={i} className="list-disc">{r}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
