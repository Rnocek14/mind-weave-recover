/**
 * Run the actual production discourse-game components with Chromium's native
 * getUserMedia/MediaRecorder and the fixed synthetic microphone WAV.
 *
 * This harness intentionally omits app route/session database ownership; the
 * authenticated staging suite proves those boundaries separately. A browser
 * recognition event and inert HTTP contracts are controlled, not actual ASR.
 */
import { useState } from 'react';
import { NarrativeRetellGame } from '@/components/NarrativeRetellGame';
import { AbstractCompareGame } from '@/components/AbstractCompareGame';
import { MultiStepPlanningGame } from '@/components/MultiStepPlanningGame';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';

export type DiscourseGameKey = 'narrative-retell' | 'abstract-compare' | 'multi-step-plan';
export const discourseGames: readonly DiscourseGameKey[] = [
  'narrative-retell', 'abstract-compare', 'multi-step-plan',
] as const;

export function DiscourseGameHarness({ game }: { game: DiscourseGameKey }) {
  const [results, setResults] = useState<unknown[]>([]);
  const [completed, setCompleted] = useState<unknown[]>([]);
  const common = {
    userId, sessionId,
    roundCount: 1,
    tier: 1,
    onTrialComplete: (result: unknown) => setResults(prev => [...prev, result]),
    onGameComplete: (result: unknown[]) => setCompleted(prev => [...prev, result]),
  };
  return <main>
    <h1 data-testid="speech-game-name">{game}</h1>
    {game === 'narrative-retell' && <NarrativeRetellGame {...common} />}
    {game === 'abstract-compare' && <AbstractCompareGame {...common} />}
    {game === 'multi-step-plan' && <MultiStepPlanningGame {...common} />}
    <pre data-testid="speech-game-results">{JSON.stringify(results)}</pre>
    <pre data-testid="speech-game-completion">{JSON.stringify(completed)}</pre>
  </main>;
}
