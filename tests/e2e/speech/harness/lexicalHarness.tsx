/**
 * Lexical-production games exercise the same native fake-microphone pipeline
 * as Photo Naming. Render the actual components and their actual speech hooks.
 * This harness never writes patient data: the speech Playwright test transport
 * intercepts all app/analysis/storage requests.
 */
import { useState } from 'react';
import { TwoCluesGame } from '@/components/TwoCluesGame';
import { DualLoadNamingGame } from '@/components/DualLoadNamingGame';

const userId = '11111111-1111-4111-8111-111111111111';
const profileId = '33333333-3333-4333-8333-333333333333';
const sessionId = '22222222-2222-4222-8222-222222222222';

export type LexicalGameKey = 'two-clues' | 'dual-load-naming';
export const lexicalGames: readonly LexicalGameKey[] = ['two-clues', 'dual-load-naming'];

export function LexicalGameHarness({ game }: { game: LexicalGameKey }) {
  const [results, setResults] = useState<unknown[]>([]);
  const [completion, setCompletion] = useState<unknown[]>([]);
  const capture = (result: unknown) => setResults(prev => [...prev, result]);
  const finish = (results: unknown[]) => setCompletion(prev => [...prev, results]);
  return <main>
    <h1 data-testid="lexical-game-name">{game}</h1>
    {game === 'two-clues' && <TwoCluesGame
      roundCount={1} userId={userId} profileId={profileId} sessionId={sessionId}
      onTrialComplete={capture} onGameComplete={finish}
    />}
    {game === 'dual-load-naming' && <DualLoadNamingGame
      roundCount={1} userId={userId} sessionId={sessionId} tier={1}
      onTrialComplete={capture} onGameComplete={finish}
    />}
    <pre data-testid="lexical-results">{JSON.stringify(results)}</pre>
    <pre data-testid="lexical-completion">{JSON.stringify(completion)}</pre>
  </main>;
}
