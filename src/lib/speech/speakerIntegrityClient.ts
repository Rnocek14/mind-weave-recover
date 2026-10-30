import { supabase } from '@/integrations/supabase/client';

/**
 * Safety switch: OFF in every build unless explicitly configured. A second
 * server-side gate and per-patient consent still apply. This never gates
 * speech recognition, games, progression or clinical scoring.
 */
export const speakerIntegrityPilotEnabled = import.meta.env.VITE_SPEAKER_INTEGRITY_SHADOW === 'true';

export type EnrollmentStatus = 'unavailable' | 'not_enrolled' | 'pending' | 'ready' | 'failed' | 'revoked';

export interface SpeakerIntegrityCheck {
  id: string;
  attemptId: string;
  status: 'pending' | 'complete' | 'failed';
  label: 'patient_candidate' | 'mixed_speakers' | 'unmatched_speaker' | 'uncertain' | null;
  reason: string | null;
  confidence: number | null;
  observedSpeakers: number | null;
  patientSpeechMs: number | null;
  otherOrUnknownSpeechMs: number | null;
  createdAt: string;
  manualReviewLabel: 'patient' | 'other' | 'mixed' | 'uncertain' | null;
  manuallyReviewedAt: string | null;
  mode: 'shadow_only';
  affectsScoring: false;
}

interface ApiResponse {
  error?: string;
  enabled?: boolean;
  status?: EnrollmentStatus;
  checkId?: string;
  check?: SpeakerIntegrityCheck;
  checks?: SpeakerIntegrityCheck[];
  signedUrl?: string;
  updated?: boolean;
}

async function callSpeakerIntegrity(profileId: string, action: string, extras: Record<string, unknown> = {}): Promise<ApiResponse> {
  if (!speakerIntegrityPilotEnabled) throw new Error('Speaker attribution pilot is not enabled in this build');
  const { data, error } = await supabase.functions.invoke<ApiResponse>('speaker-integrity', {
    body: { action, profileId, ...extras },
  });
  if (error) throw new Error('Speaker attribution service is unavailable');
  if (!data || typeof data !== 'object' || data.error) {
    throw new Error(data?.error ?? 'Speaker attribution returned an invalid response');
  }
  return data;
}

export async function getSpeakerEnrollmentStatus(profileId: string) {
  return await callSpeakerIntegrity(profileId, 'status');
}
export async function pollSpeakerEnrollment(profileId: string) {
  return await callSpeakerIntegrity(profileId, 'poll_enrollment');
}
export async function revokeSpeakerEnrollment(profileId: string) {
  return await callSpeakerIntegrity(profileId, 'revoke');
}

export async function enrollSpeakerSample(profileId: string, audio: Blob, durationMs: number, consent: boolean) {
  if (!consent) throw new Error('Explicit consent is required');
  if (!Number.isFinite(durationMs) || durationMs < 5000 || durationMs > 30000) {
    throw new Error('Please record between 5 and 30 seconds');
  }
  if (audio.size < 4000 || audio.size > 2_200_000) throw new Error('Audio sample has an unsupported size');
  const bytes = new Uint8Array(await audio.arrayBuffer());
  let binary = '';
  // Spread-of-entire-file overflows JS stack on real recordings.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return await callSpeakerIntegrity(profileId, 'enroll', {
    consent: true, audioBase64: btoa(binary), mimeType: audio.type, durationMs,
  });
}

export async function getSpeakerChecks(profileId: string) {
  return (await callSpeakerIntegrity(profileId, 'history')).checks ?? [];
}
export async function pollSpeakerCheck(profileId: string, checkId: string) {
  return (await callSpeakerIntegrity(profileId, 'poll_check', { checkId })).check;
}
export async function getSpeakerReviewAudio(profileId: string, checkId: string) {
  return (await callSpeakerIntegrity(profileId, 'review_audio', { checkId })).signedUrl;
}
export async function saveSpeakerReview(
  profileId: string, checkId: string, label: 'patient' | 'other' | 'mixed' | 'uncertain',
) {
  return await callSpeakerIntegrity(profileId, 'review', { checkId, label });
}

/**
 * Queues review in the background after a real attempt is saved. This call
 * intentionally never throws into patient therapy. Provider matching runs
 * asynchronously and only the SHADOW review table can be updated.
 */
export async function queueSpeakerIntegrityShadow(profileId: string | null | undefined, attemptId: string | null | undefined) {
  if (!speakerIntegrityPilotEnabled || !profileId || !attemptId) return false;
  try {
    const response = await callSpeakerIntegrity(profileId, 'queue', { attemptId });
    return typeof response.checkId === 'string';
  } catch {
    return false;
  }
}
