import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PHRASE_BANK } from '@/data/phraseBank';
import { PhraseTrainingScriptCard } from '@/components/phrasePractice/PhraseTrainingScriptCard';
import { getPhraseTrainingStage } from '@/lib/phrasePractice/trainingStages';

const phrase = PHRASE_BANK.find(t => t.id === 'need_help')!;

describe('PhraseTrainingScriptCard real patient presentation', () => {
  it('shows the whole stage-one script as an accessible modeled practice cue', () => {
    render(<PhraseTrainingScriptCard
      trial={phrase}
      trainingStage={getPhraseTrainingStage(1)}
      revealed={false}
      onReveal={vi.fn()}
    />);
    expect(screen.getByText(phrase.phrase)).toBeTruthy();
    expect(screen.getByText(/Stage 1/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show whole phrase' })).toBeNull();
  });

  it('hides the rest of the script in stage two until an explicit reveal', () => {
    const onReveal = vi.fn();
    const props = {
      trial: phrase, trainingStage: getPhraseTrainingStage(2),
      onReveal,
    };
    const { rerender } = render(<PhraseTrainingScriptCard {...props} revealed={false} />);
    expect(screen.getByText(/Finish the phrase/)).toBeTruthy();
    expect(screen.queryByText(phrase.phrase)).toBeNull();
    const reveal = screen.getByRole('button', { name: 'Show whole phrase' });
    fireEvent.click(reveal);
    expect(onReveal).toHaveBeenCalledTimes(1);
    rerender(<PhraseTrainingScriptCard {...props} revealed />);
    expect(screen.getByText(phrase.phrase)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show whole phrase' })).toBeNull();
  });

  it('offers stage-three word clues and a full script recovery action', () => {
    const wordCues = PHRASE_BANK.find(t => t.difficulty === 2)!;
    const { rerender } = render(
      <PhraseTrainingScriptCard
        trial={wordCues}
        trainingStage={getPhraseTrainingStage(3)}
        revealed={false}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText(/Stage 3/)).toBeTruthy();
    expect(screen.getByText('Recall your phrase using these key words')).toBeTruthy();
    expect(screen.queryByText(wordCues.phrase)).toBeNull();
    rerender(
      <PhraseTrainingScriptCard
        trial={wordCues}
        trainingStage={getPhraseTrainingStage(3)}
        revealed
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText(wordCues.phrase)).toBeTruthy();
  });
});
