import { useState } from 'react';
import { PhrasePracticeGame } from '@/components/PhrasePracticeGame';
import { FixSentenceGame } from '@/components/FixSentenceGame';
import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';

/**
 * Real phrase and sentence games running with the synthetic browser session
 * from speechTest's installBrowserControls. Captured HTTP is always intercepted.
 */
export type PhraseSentenceGameKey = 'phrase-practice' | 'fix-sentence';
export const phraseSentenceGames: readonly PhraseSentenceGameKey[] = [
  'phrase-practice', 'fix-sentence',
];

const userId = '11111111-1111-4111-8111-111111111111';
const profileId = '33333333-3333-4333-8333-333333333333';
const sessionId = '22222222-2222-4222-8222-222222222222';

export function PhraseSentenceHarness({ game }: { game: PhraseSentenceGameKey }) {
  const [results, setResults] = useState<unknown[]>([]);
  const [completions, setCompletions] = useState<unknown[]>([]);
  const capture = (result: unknown) => setResults(prev => [...prev, result]);
  return <main>
    <h1 data-testid="phrase-sentence-game-name">{game}</h1>
    {game === 'phrase-practice' && <PhrasePracticeGame
      totalTrials={1} initialDifficulty={1} sessionId={sessionId} autoListen={false}
      onTrialComplete={capture}
      onGameComplete={(score, level) => setCompletions(prev => [...prev, { score, level }])}
    />}
    {game === 'fix-sentence' && <FixSentenceGame
      trialCount={1} clinicalLevel={3} initialDifficultyFloor={4}
      sessionId={sessionId} userId={userId} profileId={profileId}
      onTrialComplete={capture} onGameComplete={(r) => setCompletions(prev => [...prev, r])}
    />}
    {/* Pure stimulus lookup from the same production bank as the game.
        This does not score or override any patient answer. */}
    {game === 'fix-sentence' && <pre data-testid="fix-sentence-bank">
      {JSON.stringify(FIX_SENTENCE_BANK.map(({ sentence, acceptedFixes }) => ({ sentence, acceptedFixes })))}
    </pre>}
    <pre data-testid="phrase-sentence-results">{JSON.stringify(results)}</pre>
    <pre data-testid="phrase-sentence-completion">{JSON.stringify(completions)}</pre>
  </main>;
}
