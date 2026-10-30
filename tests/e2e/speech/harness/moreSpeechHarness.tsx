/**
 * Actual NeuroSpark components for the remaining speech modalities.
 * This is an isolated client harness; PostgREST and speech services are
 * explicitly intercepted and are NOT real saved patient evidence.
 */
import { useState } from 'react';
import { MinimalPairsGame } from '@/components/MinimalPairsGame';
import { SentenceConstructionGame } from '@/components/SentenceConstructionGame';
import { ConversationPartnerGame } from '@/components/ConversationPartnerGame';
import { PHOTO_BANK } from '@/data/photoBank';
import { getExerciseConfig } from '@/lib/clinicalProfileMapper';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';

export type MoreSpeechGameKey = 'minimal-pairs' | 'sentence-construction' | 'conversation-partner';
export const moreSpeechGames: readonly MoreSpeechGameKey[] = ['minimal-pairs', 'sentence-construction', 'conversation-partner'];
const userId = '11111111-1111-4111-8111-111111111111';
const profileId = '33333333-3333-4333-8333-333333333333';
const sessionId = '22222222-2222-4222-8222-222222222222';

export function MoreSpeechHarness({ game }: { game: MoreSpeechGameKey }) {
  const [trials, setTrials] = useState<unknown[]>([]);
  const [ends, setEnds] = useState<unknown[]>([]);
  const capture = (result: unknown) => setTrials(previous => [...previous, result]);
  return <main>
    <h1 data-testid="more-speech-game-name">{game}</h1>
    {game === 'minimal-pairs' && <MinimalPairsGame
      totalTrials={1} difficulty={1} sessionId={sessionId}
      onTrialComplete={capture}
      onComplete={(result) => setEnds(previous => [...previous, result])}
    />}
    {game === 'sentence-construction' && <SentenceConstructionGame
      config={getExerciseConfig('sentence-construction', null)}
      bounds={getCapabilityDifficultyBounds('sentence-construction', null)}
      difficultyLevel={1} sessionId={sessionId} clinicalLevel={3}
      onTrialComplete={capture}
      onGameComplete={(score, total) => setEnds(previous => [...previous, { score, total }])}
    />}
    {game === 'conversation-partner' && <ConversationPartnerGame
      userId={userId} profileId={profileId} sessionId={sessionId}
      onComplete={(result) => setEnds(previous => [...previous, result])}
    />}
    {/* The exact photo-bank assets used by Minimal Pairs are exposed solely
        to match the spoken synthetic stimulus to its on-screen image.
        Neither side nor patient success is predetermined by this harness. */}
    {game === 'minimal-pairs' && <pre data-testid="minimal-photo-lookup">
      {JSON.stringify(PHOTO_BANK.map(({ target, imageUrl }) => ({ target, imageUrl })))}
    </pre>}
    <pre data-testid="more-speech-results">{JSON.stringify(trials)}</pre>
    <pre data-testid="more-speech-completions">{JSON.stringify(ends)}</pre>
  </main>;
}
