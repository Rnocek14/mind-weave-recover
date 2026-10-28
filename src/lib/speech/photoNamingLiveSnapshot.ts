import type { LiveSnapshot } from '@/contexts/LiveAnalysisContext';
import type { UtteranceAnalysis } from '@/types/utteranceAnalysis';

export interface PhotoNamingLiveResult {
  attemptId?: string;
  trialIndex?: number;
  whisperTranscript?: string;
  browserTranscript?: string;
  whisperConfidence?: number;
  errorType?: string;
  utteranceAnalysis?: Partial<UtteranceAnalysis>;
  effortfulSpeech?: boolean;
  encouragementScore?: number;
  latencyMs?: number;
}

/** Observed speech fields supplied by the exercise page after its write settles. */
export function photoNamingLiveSnapshot(
  result: PhotoNamingLiveResult,
  targetWord: string,
): Partial<LiveSnapshot> {
  const ua = result.utteranceAnalysis;
  return {
    transcript: result.whisperTranscript ?? result.browserTranscript ?? ua?.transcript,
    targetWord,
    asrConfidence: result.whisperConfidence ?? ua?.asrConfidence,
    errorType: result.errorType || ua?.errorType,
    phonologicalSimilarity: ua?.phonologicalSimilarity,
    semanticSimilarity: ua?.semanticSimilarity,
    // The game owns pronunciation measurements. Its completed PA result can
    // arrive while this page awaits submitTrial; absent UA fields must not
    // erase those same-attempt scores. A new attempt clears them in context.
    meaningAccuracy: ua?.meaningAccuracy,
    circumlocutionDetected: ua?.circumlocutionDetected,
    effortfulSpeech: result.effortfulSpeech,
    reasoning: ua?.reasoning,
    classificationConfidence: ua?.classificationConfidence,
    encouragementScore: result.encouragementScore,
    encouragementLevel: ua?.encouragementLevel,
    trialIndex: result.trialIndex,
    latencyMs: result.latencyMs,
  };
}
