/**
 * Centralized Maya voice configuration.
 * Every TTS call in the app should use these constants
 * so Maya always sounds like the same person.
 *
 * Two modes:
 *  - 'fast'    → eleven_turbo_v2_5  (≈300ms TTFB, used during live conversation)
 *  - 'natural' → eleven_multilingual_v2 (highest fidelity prosody for intros,
 *                summaries, instructions, and any non-time-critical speech)
 */

// Matilda — warm, natural female voice from ElevenLabs
export const MAYA_VOICE_ID = 'XrExE9yKIg1WjnnlVkGX';

export type MayaTtsMode = 'fast' | 'natural';

/**
 * Voice settings tuned for clinical / aphasia use:
 * - higher stability for predictable pacing
 * - slightly slower than baseline for comprehension
 * - speaker boost on for clarity
 */
export const MAYA_VOICE_SETTINGS = {
  fast: {
    model_id: 'eleven_turbo_v2_5',
    stability: 0.55,
    similarity_boost: 0.8,
    style: 0.25,
    use_speaker_boost: true,
    speed: 0.95,
  },
  natural: {
    model_id: 'eleven_multilingual_v2',
    stability: 0.6,
    similarity_boost: 0.85,
    style: 0.35,
    use_speaker_boost: true,
    speed: 0.95,
  },
} as const;
