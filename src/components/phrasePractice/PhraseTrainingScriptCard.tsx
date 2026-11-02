import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PhraseTrial } from '@/data/phraseBank';
import { getPhraseTrainingPrompt, type PhraseTrainingStage } from '@/lib/phrasePractice/trainingStages';

/** Visible, patient-safe phrase support. A hidden script is not in the DOM. */
export function PhraseTrainingScriptCard({
  trial,
  trainingStage,
  revealed,
  onReveal,
}: {
  trial: PhraseTrial;
  trainingStage?: PhraseTrainingStage | null;
  revealed: boolean;
  onReveal: () => void;
}) {
  const prompt = getPhraseTrainingPrompt(trial, trainingStage, revealed);
  return (
    <div className="space-y-4">
      {trainingStage && (
        <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
          <p className="text-base font-semibold">Phrase practice • Stage {trainingStage.level}</p>
          <p className="text-sm">{trainingStage.label}</p>
          <p className="text-xs text-muted-foreground">
            A practice stage, not a verified recovery score.
          </p>
        </div>
      )}
      <p className="text-sm text-muted-foreground uppercase tracking-wide">
        {prompt.title}
      </p>
      <div className="text-3xl sm:text-4xl font-bold text-foreground leading-relaxed py-6 px-4 bg-accent/20 rounded-lg">
        {prompt.text}
      </div>
      {!prompt.fullPhraseRevealed && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-14 w-full text-base"
          onClick={onReveal}
        >
          Show whole phrase
        </Button>
      )}
      <Badge variant="outline" className="text-sm">
        {trial.category.replace('_', ' ')}
      </Badge>
    </div>
  );
}
