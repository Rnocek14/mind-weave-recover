/**
 * Shared Azure Pronunciation Assessment Hook
 * 
 * Extracted from PhotoNamingGame to provide parity across all speech exercises.
 * Handles: WAV conversion → base64 encoding → Edge function call → structured result.
 * 
 * Azure requires WAV format (16kHz mono PCM) for reliable phoneme-level analysis.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────

export type PronunciationSuccessResult = {
  ok: true;
  data: {
    pronunciationScore: number;
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
    prosodyScore?: number;
    transcript: string;
    words: any[];
    alignmentData?: {
      word_segments: { word: string; start: number; end: number }[];
      phone_segments: { phone: string; start: number; end: number }[];
    };
  };
  pronRequestId: string;
  timingsMs: { wav: number; base64: number; edge: number; total: number };
  audioMeta: { originalMime: string; originalSize: number; wavSize: number; base64Len: number };
};

export type PronunciationErrorResult = {
  ok: false;
  error: {
    stage: 'wav_conversion' | 'base64_encoding' | 'edge_function' | 'azure_api' | 'unexpected';
    message: string;
    details?: any;
  };
  pronRequestId: string;
  timingsMs: { wav?: number; base64?: number; edge?: number; total: number };
  audioMeta: { originalMime: string; originalSize: number; wavSize?: number; base64Len?: number };
};

export type PronunciationResult = PronunciationSuccessResult | PronunciationErrorResult;

// ── Hook ───────────────────────────────────────────────────────────────

export function usePronunciationAnalysis() {
  const analyzePronunciation = useCallback(async (
    audioBlob: Blob,
    targetWord: string
  ): Promise<PronunciationResult> => {
    const pronRequestId = crypto.randomUUID();
    const startTime = Date.now();
    const audioMeta = {
      originalMime: audioBlob.type,
      originalSize: audioBlob.size,
      wavSize: 0 as number | undefined,
      base64Len: 0 as number | undefined,
    };
    const timings = { wav: 0, base64: 0, edge: 0, total: 0 };

    console.log('🎯 [Pronunciation] Starting analysis', {
      pronRequestId, blobSize: audioBlob.size, blobType: audioBlob.type, targetWord,
    });

    try {
      // Step 1: Convert to WAV format for Azure
      console.log('🎯 [Pronunciation] Step 1: Converting to WAV...', { pronRequestId });
      const wavStartTime = Date.now();

      let wavBlob: Blob;
      try {
        const { convertBlobToWav } = await import('@/lib/convertToWav');
        wavBlob = await convertBlobToWav(audioBlob);
        timings.wav = Date.now() - wavStartTime;
        audioMeta.wavSize = wavBlob.size;
        console.log('🎯 [Pronunciation] WAV conversion success', {
          pronRequestId, wavSize: wavBlob.size, durationMs: timings.wav,
        });
      } catch (wavError) {
        timings.total = Date.now() - startTime;
        console.error('🎯 [Pronunciation] WAV conversion FAILED:', { pronRequestId, error: wavError });
        return {
          ok: false,
          error: {
            stage: 'wav_conversion',
            message: wavError instanceof Error ? wavError.message : 'Unknown error',
            details: { errorType: (wavError as any)?.constructor?.name },
          },
          pronRequestId,
          timingsMs: { wav: Date.now() - wavStartTime, total: timings.total },
          audioMeta: { originalMime: audioMeta.originalMime, originalSize: audioMeta.originalSize },
        };
      }

      // Step 2: Convert WAV blob to base64
      console.log('🎯 [Pronunciation] Step 2: Encoding to base64...', { pronRequestId });
      const base64StartTime = Date.now();

      let base64Audio: string;
      try {
        const reader = new FileReader();
        base64Audio = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            if (!result) { reject(new Error('FileReader returned empty result')); return; }
            const base64 = result.split(',')[1];
            if (!base64) { reject(new Error('Failed to extract base64 from data URL')); return; }
            resolve(base64);
          };
          reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown'}`));
          reader.readAsDataURL(wavBlob);
        });
        timings.base64 = Date.now() - base64StartTime;
        audioMeta.base64Len = base64Audio.length;
        console.log('🎯 [Pronunciation] Base64 encoding success', {
          pronRequestId, base64Length: base64Audio.length, durationMs: timings.base64,
        });
      } catch (encodeError) {
        timings.total = Date.now() - startTime;
        console.error('🎯 [Pronunciation] Base64 encoding FAILED:', { pronRequestId, error: encodeError });
        return {
          ok: false,
          error: {
            stage: 'base64_encoding',
            message: encodeError instanceof Error ? encodeError.message : 'Unknown error',
          },
          pronRequestId,
          timingsMs: { wav: timings.wav, base64: Date.now() - base64StartTime, total: timings.total },
          audioMeta: { originalMime: audioMeta.originalMime, originalSize: audioMeta.originalSize, wavSize: audioMeta.wavSize },
        };
      }

      // Step 3: Call edge function
      console.log('🎯 [Pronunciation] Step 3: Calling Azure edge function', { pronRequestId, targetWord });
      const edgeStartTime = Date.now();

      const { data, error } = await supabase.functions.invoke('analyze-pronunciation', {
        body: {
          audioBlob: base64Audio,
          mimeType: 'audio/wav',
          referenceText: targetWord,
          pronRequestId,
        },
      });

      timings.edge = Date.now() - edgeStartTime;
      timings.total = Date.now() - startTime;

      if (error) {
        console.error('🎯 [Pronunciation] Edge function FAILED:', { pronRequestId, error });
        return {
          ok: false,
          error: { stage: 'edge_function', message: error.message || 'Unknown error', details: { context: error.context } },
          pronRequestId, timingsMs: timings, audioMeta: audioMeta as any,
        };
      }

      // Structured error response
      if (data?.ok === false) {
        console.error('🎯 [Pronunciation] Azure API returned error:', { pronRequestId, error: data.error });
        return {
          ok: false,
          error: { stage: data.error?.stage || 'azure_api', message: data.error?.message || 'Unknown Azure error', details: data.error?.details },
          pronRequestId, timingsMs: timings, audioMeta: audioMeta as any,
        };
      }

      // Legacy string error fallback
      if (data?.error && typeof data.error === 'string') {
        console.error('🎯 [Pronunciation] Azure API returned legacy error:', { pronRequestId, error: data.error });
        return {
          ok: false,
          error: { stage: 'azure_api', message: data.error },
          pronRequestId, timingsMs: timings, audioMeta: audioMeta as any,
        };
      }

      // Success
      const responseData = data.data || data;
      console.log('🎯 [Pronunciation] SUCCESS!', {
        pronRequestId,
        pronunciationScore: responseData.pronunciationScore,
        accuracyScore: responseData.accuracyScore,
        fluencyScore: responseData.fluencyScore,
        transcript: responseData.transcript,
        timingsMs: timings,
      });

      return {
        ok: true,
        data: {
          pronunciationScore: responseData.pronunciationScore || 0,
          accuracyScore: responseData.accuracyScore || 0,
          fluencyScore: responseData.fluencyScore || 0,
          completenessScore: responseData.completenessScore || 0,
          prosodyScore: responseData.prosodyScore,
          transcript: responseData.transcript || '',
          words: responseData.words || [],
          alignmentData: responseData.alignmentData,
        },
        pronRequestId,
        timingsMs: timings,
        audioMeta: audioMeta as any,
      };
    } catch (error) {
      timings.total = Date.now() - startTime;
      console.error('🎯 [Pronunciation] Unexpected error:', { pronRequestId, error });
      return {
        ok: false,
        error: {
          stage: 'unexpected',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { errorType: (error as any)?.constructor?.name },
        },
        pronRequestId, timingsMs: timings, audioMeta: audioMeta as any,
      };
    }
  }, []);

  return { analyzePronunciation };
}
