/**
 * Offline scoring of independently annotated ASR replay results.
 * Does not call Azure, identify speakers, or infer clinical efficacy.
 */
export type AudioBenchmarkCase = {
  caseId: string;
  sourceId: string;
  referenceTranscript: string;
  recognizedTranscript: string | null;
  condition: 'clean' | 'noise' | 'silence' | 'aphasia' | 'caregiver' | 'other';
  eligibleForAccuracy: boolean;
  expectedSpeaker: 'patient' | 'caregiver' | 'unknown';
  detectedSpeaker?: 'patient' | 'caregiver' | 'unknown';
};
export type AudioBenchmarkResult = {
  caseId: string;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWords: number;
  wer: number | null;
  status: 'scored' | 'excluded' | 'missing_output';
  speakerMismatch: boolean | null;
};
export function words(text: string): string[] {
  return text.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}' ]/gu, ' ')
    .trim().split(/\s+/).filter(Boolean);
}
export function alignWords(reference: string[], hypothesis: string[]) {
  type Counts = { substitutions: number; deletions: number; insertions: number };
  const table: Counts[][] = Array.from({ length: reference.length + 1 }, () =>
    Array.from({ length: hypothesis.length + 1 }, () => ({ substitutions: 0, deletions: 0, insertions: 0 })));
  for (let i = 1; i <= reference.length; i++) table[i][0] = { substitutions: 0, deletions: i, insertions: 0 };
  for (let j = 1; j <= hypothesis.length; j++) table[0][j] = { substitutions: 0, deletions: 0, insertions: j };
  const cost = (c: Counts) => c.substitutions + c.deletions + c.insertions;
  for (let i = 1; i <= reference.length; i++) for (let j = 1; j <= hypothesis.length; j++) {
    const match = reference[i - 1] === hypothesis[j - 1];
    const diag = table[i - 1][j - 1];
    const choices: Counts[] = [
      { ...diag, substitutions: diag.substitutions + (match ? 0 : 1) },
      { ...table[i - 1][j], deletions: table[i - 1][j].deletions + 1 },
      { ...table[i][j - 1], insertions: table[i][j - 1].insertions + 1 },
    ];
    table[i][j] = choices.reduce((a, b) => cost(a) <= cost(b) ? a : b);
  }
  return table[reference.length][hypothesis.length];
}
export function scoreAudioCase(item: AudioBenchmarkCase): AudioBenchmarkResult {
  const ref = words(item.referenceTranscript);
  const speakerMismatch = item.detectedSpeaker === undefined ? null : item.expectedSpeaker !== 'unknown'
    && item.detectedSpeaker !== item.expectedSpeaker;
  const base = { caseId: item.caseId, referenceWords: ref.length, speakerMismatch };
  if (!item.eligibleForAccuracy || ref.length === 0)
    return { ...base, substitutions: 0, deletions: 0, insertions: 0, wer: null, status: 'excluded' };
  if (item.recognizedTranscript === null)
    return { ...base, substitutions: 0, deletions: 0, insertions: 0, wer: null, status: 'missing_output' };
  const counts = alignWords(ref, words(item.recognizedTranscript));
  return { ...base, ...counts, wer: (counts.substitutions + counts.deletions + counts.insertions) / ref.length, status: 'scored' };
}
export function summarizeAudioBenchmark(items: AudioBenchmarkCase[]) {
  const results = items.map(scoreAudioCase);
  const scored = results.filter(r => r.status === 'scored');
  const referenceWords = scored.reduce((n, r) => n + r.referenceWords, 0);
  const errors = scored.reduce((n, r) => n + r.substitutions + r.deletions + r.insertions, 0);
  return {
    cases: results.length,
    scored: scored.length,
    excluded: results.filter(r => r.status === 'excluded').length,
    missingOutput: results.filter(r => r.status === 'missing_output').length,
    referenceWords,
    microWER: referenceWords ? errors / referenceWords : null,
    speakerMismatchCount: results.filter(r => r.speakerMismatch === true).length,
    speakerUnknownCount: results.filter(r => r.speakerMismatch === null).length,
    results,
  };
}
