/**
 * Exercising the actual remaining NeuroSpark speech components.
 * The harness only exposes callbacks. It cannot replace clinical scoring.
 */
import { useState } from 'react';
import { ThoughtContinuationGame } from '@/components/ThoughtContinuationGame';
import { DescribeGuessGame } from '@/components/DescribeGuessGame';
import { ConversationCoachGame } from '@/components/ConversationCoachGame';

export type RemainingSpeechGameKey = 'thought-continuation' | 'describe-guess' | 'conversation-coach';
export const remainingSpeechGames: readonly RemainingSpeechGameKey[] = [
  'thought-continuation', 'describe-guess', 'conversation-coach',
];
const userId = '11111111-1111-4111-8111-111111111111';
const profileId = '33333333-3333-4333-8333-333333333333';
const sessionId = '22222222-2222-4222-8222-222222222222';

export function RemainingSpeechHarness({ game }: { game: RemainingSpeechGameKey }) {
  const [results, setResults] = useState<unknown[]>([]);
  const [exited, setExited] = useState(false);
  const capture = (result: unknown) => setResults(prev => [...prev, result]);
  return <main>
    <h1 data-testid="remaining-speech-game-name">{game}</h1>
    <button data-testid="end-remaining-speech-game" onClick={() => setExited(true)}>Exit testing session</button>
    {!exited && game === 'thought-continuation' && <ThoughtContinuationGame
      userId={userId} profileId={profileId} sessionId={sessionId}
      onComplete={capture} onExit={() => setExited(true)}
    />}
    {!exited && game === 'describe-guess' && <DescribeGuessGame
      trialCount={1} sessionId={sessionId} userId={userId} profileId={profileId}
      onTrialComplete={capture} onGameComplete={capture}
    />}
    {!exited && game === 'conversation-coach' && <ConversationCoachGame
      userId={userId} profileId={profileId} sessionId={sessionId}
      onComplete={capture} onExit={() => setExited(true)}
    />}
    <output data-testid="remaining-speech-exited">{exited ? 'exited' : 'active'}</output>
    <pre data-testid="remaining-speech-results">{JSON.stringify(results)}</pre>
  </main>;
}
