/**
 * Real production games whose core speech input is browser SpeechRecognition.
 * Unlike the recorded-audio cases, these games do not produce a MediaRecorder
 * file for their primary path. Use controlled Web Speech events to test actual
 * in-game classification; do not fabricate WAV/phoneme metrics.
 */
import { useState } from 'react';
import { CategoryFluencyGame } from '@/components/CategoryFluencyGame';
import { SynonymGeneratorGame } from '@/components/SynonymGeneratorGame';
import { DetectiveMindGame } from '@/components/DetectiveMindGame';

export type RecognitionGameKey = 'category-fluency' | 'synonym-generator' | 'detective-mind';
export const recognitionGames: readonly RecognitionGameKey[] = [
  'category-fluency', 'synonym-generator', 'detective-mind',
];

export function RecognitionGameHarness({ game }: { game: RecognitionGameKey }) {
  const [results, setResults] = useState<unknown[]>([]);
  const [completions, setCompletions] = useState<unknown[]>([]);
  const capture = (result: unknown) => setResults(prev => [...prev, result]);
  const finish = (results: unknown[]) => setCompletions(prev => [...prev, results]);
  return <main>
    <h1 data-testid="recognition-game-name">{game}</h1>
    {game === 'category-fluency' && <CategoryFluencyGame
      roundCount={1} difficulty={1}
      onRoundComplete={capture} onGameComplete={finish}
    />}
    {game === 'synonym-generator' && <SynonymGeneratorGame
      roundCount={1} difficulty={1}
      onRoundComplete={capture} onGameComplete={finish}
    />}
    {game === 'detective-mind' && <DetectiveMindGame
      roundCount={1} difficultyLevel={1}
      onTrialComplete={capture} onGameComplete={finish}
    />}
    <pre data-testid="recognition-results">{JSON.stringify(results)}</pre>
    <pre data-testid="recognition-completions">{JSON.stringify(completions)}</pre>
  </main>;
}
