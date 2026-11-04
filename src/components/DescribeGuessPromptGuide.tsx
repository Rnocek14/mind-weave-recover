/**
 * Visible, repeatable semantic-feature scaffold for Describe & Guess.
 *
 * Showing a question is navigation, not clinical cue use. Only invoking
 * onRequest (spoken help) can be logged as assistance. Checkmarks reflect
 * dimensions actually spoken, never help-button taps.
 */
import { useState } from 'react';
import { Box, Check, Eye, MapPin, Tag, Wrench, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FeatureType } from '@/data/describeGuessBank';
import { cn } from '@/lib/utils';

export interface DescribeGuessPrompt {
  featureType: FeatureType;
  question: string;
  starter: string;
  icon: LucideIcon;
}

export const DESCRIBE_GUESS_PROMPTS: readonly DescribeGuessPrompt[] = [
  { featureType: 'function', question: 'What do you use it for?', starter: 'You use it to...', icon: Wrench },
  { featureType: 'appearance', question: 'What does it look like?', starter: 'It looks like...', icon: Eye },
  { featureType: 'material', question: "What's it made of?", starter: "It's made of...", icon: Box },
  { featureType: 'location', question: 'Where would you find it?', starter: 'You find it...', icon: MapPin },
  { featureType: 'category', question: 'What kind of thing is it?', starter: "It's a kind of...", icon: Tag },
];

interface DescribeGuessPromptGuideProps {
  activeFeature: FeatureType;
  spokenFeatures: ReadonlySet<FeatureType>;
  onRequest: (prompt: DescribeGuessPrompt) => void;
}

export function DescribeGuessPromptGuide({
  activeFeature,
  spokenFeatures,
  onRequest,
}: DescribeGuessPromptGuideProps) {
  const [showMore, setShowMore] = useState(false);

  const renderQuestion = (prompt: DescribeGuessPrompt) => {
    const Icon = prompt.icon;
    const spoken = spokenFeatures.has(prompt.featureType);
    return (
      <Button
        key={prompt.featureType}
        type="button"
        variant="outline"
        aria-pressed={activeFeature === prompt.featureType}
        onClick={() => onRequest(prompt)}
        className={cn(
          'h-auto min-h-14 w-full justify-start whitespace-normal rounded-xl border-2 px-3 py-2.5 text-left',
          'hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary',
          activeFeature === prompt.featureType && 'border-primary bg-primary/10',
        )}
      >
        <Icon className="mr-3 h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug sm:text-base">{prompt.question}</span>
          <span className="block text-xs font-normal text-muted-foreground">{prompt.starter}</span>
        </span>
        {spoken && (
          <span className="ml-1 flex shrink-0 items-center gap-1 text-primary">
            <Check className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Already described</span>
          </span>
        )}
      </Button>
    );
  };

  return (
    <section aria-label="Ideas for describing" className="shrink-0 space-y-2">
      <div className="text-center">
        <p className="text-base font-bold text-foreground">Need an idea? Try a question.</p>
        <p className="text-xs text-muted-foreground">Tap a question to hear Maya read it.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DESCRIBE_GUESS_PROMPTS.slice(0, 3).map(renderQuestion)}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={showMore}
        onClick={() => setShowMore(previous => !previous)}
        className="mx-auto flex min-h-9 text-sm text-foreground"
      >
        {showMore ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
        {showMore ? 'Fewer questions' : 'More questions'}
      </Button>
      {showMore && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DESCRIBE_GUESS_PROMPTS.slice(3).map(renderQuestion)}
        </div>
      )}
    </section>
  );
}
