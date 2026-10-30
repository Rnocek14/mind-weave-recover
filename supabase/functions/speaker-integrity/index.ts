/**
 * Opt-in speaker-integrity research pilot, SHADOW ONLY.
 *
 * Important boundaries:
 * - Default OFF, requires SPEAKER_INTEGRITY_ENABLED=true after vendor/legal review.
 * - Authenticates the caller; enrollment and checks are scoped to an owned
 *   patient profile and a real recorded attempt in the same owned session.
 * - Voiceprints are encrypted at rest with a separate AES-GCM key.
 * - Third-party provider only sees random media keys and the audio (never
 *   account names or IDs); short-lived media is uploaded to its private API.
 * - Does not alter ANY score, utterance, mastery or progression row.
 * - Does not return voiceprints, signed audio URLs or raw provider output.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, getAuthedUser, jsonResponse, corsHeaders } from "../_shared/auth.ts";
import { classifySpeakerIdentification } from "../_shared/speakerIntegrity.ts";

const BASE = "https://api.pyannote.ai/v1";
const MAX_REQUEST_CHARS = 3_100_000;
const MAX_ENROLL_BYTES = 2_200_000;
const MAX_CHECK_BYTES = 5_000_000;
const MAX_ENROLL_MS = 30_000;
const MIN_ENROLL_MS = 5_000;
const MAX_CHECKS_PER_DAY = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME = /^(audio\/webm|audio\/mp4|audio\/wav|audio\/ogg)(;codecs=[\w.,+-]+)?$/i;
type Data = Record<string, unknown>;

function isRecord(value: unknown): value is Data {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function allowedMime(value: unknown): value is string {
  return typeof value === "string" && MIME.test(value);
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function enabled(): boolean {
  // A deploy never enables PHI transmission by itself.
  return Deno.env.get("SPEAKER_INTEGRITY_ENABLED") === "true";
}
function apiKey(): string {
  const value = Deno.env.get("PYANNOTEAI_API_KEY");
  if (!value) throw new Error("Provider is not configured");
  return value;
}
function b64(bytes: Uint8Array): string {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(result);
}
function unb64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function encryptionKey(): Promise<CryptoKey> {
  const raw = unb64(Deno.env.get("SPEAKER_VOICEPRINT_AES_KEY_B64") ?? "");
  if (raw.length !== 32) throw new Error("Biometric encryption key unavailable");
  return await crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptVoiceprint(value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key, new TextEncoder().encode(value),
  ));
  return { voiceprint_ciphertext: b64(ciphertext), voiceprint_iv: b64(iv) };
}
async function decryptVoiceprint(ciphertext: string, nonce: string): Promise<string> {
  const key = await encryptionKey();
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(nonce) as BufferSource },
    key, unb64(ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(clear);
}

async function provider(path: string, method: "POST" | "GET", data?: Data): Promise<Data> {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + apiKey(),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Provider unavailable (" + response.status + ")");
  const result: unknown = await response.json();
  if (!isRecord(result)) throw new Error("Invalid provider response");
  return result;
}

async function uploadMedia(bytes: Uint8Array, mime: string): Promise<string> {
  // Random provider-only object identifier, no patient or session identifiers.
  const extension = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
  const media = "media://neurospark-" + crypto.randomUUID() + "." + extension;
  const location = await provider("/media/input", "POST", { url: media });
  if (typeof location.url !== "string" || !location.url.startsWith("https://")) {
    throw new Error("Provider media upload unavailable");
  }
  const res = await fetch(location.url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes as BodyInit,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error("Provider media upload failed");
  return media;
}

function getSummary(row: Data | null | undefined) {
  if (!row) return { status: "not_enrolled" };
  return {
    status: row.status,
    consentAt: row.consent_at,
    updatedAt: row.updated_at,
    // Pending provider job identifiers and biometric data never leave server.
  };
}
function checkedRecord(row: Data) {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    status: row.status,
    label: row.label ?? null,
    reason: row.reason ?? null,
    confidence: row.match_confidence ?? null,
    observedSpeakers: row.observed_speaker_count ?? null,
    patientSpeechMs: row.patient_speech_ms ?? null,
    otherOrUnknownSpeechMs: row.other_or_unknown_speech_ms ?? null,
    createdAt: row.created_at,
    manualReviewLabel: row.manual_review_label ?? null,
    manuallyReviewedAt: row.manually_reviewed_at ?? null,
    mode: "shadow_only",
    affectsScoring: false,
  };
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  // Validate JWT BEFORE checking flags or reading profile data.
  const caller = await getAuthedUser(request);
  if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_REQUEST_CHARS) return jsonResponse({ error: "Request too large" }, 413);
  let body: Data;
  try {
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_CHARS) return jsonResponse({ error: "Request too large" }, 413);
    const decoded: unknown = JSON.parse(raw);
    if (!isRecord(decoded)) return jsonResponse({ error: "Invalid request" }, 400);
    body = decoded;
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
  const { profileId, action } = body;
  if (!isUuid(profileId) || typeof action !== "string") return jsonResponse({ error: "Missing patient profile" }, 400);
  const admin = adminClient();
  const { data: owned, error: ownerError } = await admin.from("profiles")
    .select("id").eq("id", profileId).eq("user_id", caller.id)
    .eq("profile_kind", "patient").maybeSingle();
  if (ownerError) return jsonResponse({ error: "Profile unavailable" }, 503);
  if (!owned) return jsonResponse({ error: "Not authorized for this patient" }, 403);

  // Status is usable in a disabled deployment for a clear patient-facing message.
  if (!enabled()) {
    if (action === "status") return jsonResponse({ enabled: false, status: "unavailable" });
    return jsonResponse({ error: "Speaker pilot not enabled" }, 503);
  }
  try {
    if (action === "status") {
      const { data, error } = await admin.from("speaker_integrity_enrollments")
        .select("status, consent_at, updated_at").eq("profile_id", profileId).maybeSingle();
      if (error) throw new Error("Enrollment lookup failed");
      return jsonResponse({ enabled: true, ...getSummary(data) });
    }

    if (action === "enroll") {
      // Explicit consent for this single recorded clip, not implied by game use.
      const { consent, audioBase64, mimeType, durationMs } = body;
      if (consent !== true || !allowedMime(mimeType) ||
        typeof durationMs !== "number" || durationMs < MIN_ENROLL_MS || durationMs > MAX_ENROLL_MS ||
        typeof audioBase64 !== "string" || audioBase64.length > 3_000_000 ||
        !/^[\w+/]+={0,2}$/.test(audioBase64)) {
        return jsonResponse({ error: "A 5–30 second confirmed single-patient sample and consent are required" }, 400);
      }
      // Validate encryption key before uploading any voice outside our system.
      await encryptionKey();
      const prior = await admin.from("speaker_integrity_enrollments")
        .select("status").eq("profile_id", profileId).maybeSingle();
      if (prior.error) throw new Error("Enrollment state unavailable");
      if (prior.data?.status === "pending" || prior.data?.status === "ready") {
        return jsonResponse({ error: "Enrollment already exists. Revoke before replacing it." }, 409);
      }
      let bytes: Uint8Array;
      try { bytes = unb64(audioBase64); }
      catch { return jsonResponse({ error: "Invalid recording encoding" }, 400); }
      if (bytes.length < 4_000 || bytes.length > MAX_ENROLL_BYTES) {
        return jsonResponse({ error: "Recording size outside enrollment limits" }, 400);
      }
      const now = new Date().toISOString();
      const nextEnrollment = {
        profile_id: profileId, user_id: caller.id, consent_version: "speaker-v1",
        consent_by: caller.id, consent_at: now, status: "pending",
        provider_job_id: null, voiceprint_ciphertext: null, voiceprint_iv: null,
        updated_at: now, revoked_at: null,
      };
      // Atomic state transition, not upsert-after-read: concurrent enrollment
      // must never replace a ready or pending voiceprint or double-charge.
      const registration = prior.data
        ? await admin.from("speaker_integrity_enrollments")
          .update(nextEnrollment).eq("profile_id", profileId)
          .in("status", ["failed", "revoked"]).select("profile_id").maybeSingle()
        : await admin.from("speaker_integrity_enrollments")
          .insert(nextEnrollment).select("profile_id").maybeSingle();
      if (registration.error || !registration.data) {
        return jsonResponse({ error: "Enrollment already exists or is unavailable" }, 409);
      }
      try {
        const media = await uploadMedia(bytes, mimeType);
        const job = await provider("/voiceprint", "POST", { url: media, model: "precision-2" });
        if (!isUuid(job.jobId)) throw new Error("Invalid enrollment job");
        const { data: updated, error } = await admin.from("speaker_integrity_enrollments")
          .update({ provider_job_id: job.jobId, updated_at: new Date().toISOString() })
          .eq("profile_id", profileId).eq("status", "pending")
          .select("profile_id").maybeSingle();
        if (error || !updated) throw new Error("Enrollment revoked during submission");
        return jsonResponse({ status: "pending" });
      } catch (cause) {
        await admin.from("speaker_integrity_enrollments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("profile_id", profileId).eq("status", "pending");
        throw cause;
      }
    }

    if (action === "poll_enrollment") {
      const { data: enrolled, error } = await admin.from("speaker_integrity_enrollments")
        .select("status, provider_job_id, consent_at, updated_at")
        .eq("profile_id", profileId).maybeSingle();
      if (error) throw new Error("Enrollment lookup failed");
      if (!enrolled || enrolled.status !== "pending" || !isUuid(enrolled.provider_job_id)) {
        return jsonResponse({ ...getSummary(enrolled) });
      }
      const job = await provider("/jobs/" + enrolled.provider_job_id, "GET");
      if (job.status === "failed" || job.status === "canceled") {
        await admin.from("speaker_integrity_enrollments")
          .update({ status: "failed", provider_job_id: null, updated_at: new Date().toISOString() })
          .eq("profile_id", profileId).eq("status", "pending")
          .eq("provider_job_id", enrolled.provider_job_id);
        return jsonResponse({ status: "failed" });
      }
      if (job.status !== "succeeded") return jsonResponse({ status: "pending" });
      const voiceprint = isRecord(job.output) ? job.output.voiceprint : null;
      if (typeof voiceprint !== "string" || voiceprint.length < 24 || voiceprint.length > 100_000) {
        await admin.from("speaker_integrity_enrollments")
          .update({ status: "failed", provider_job_id: null, updated_at: new Date().toISOString() })
          .eq("profile_id", profileId).eq("status", "pending")
          .eq("provider_job_id", enrolled.provider_job_id);
        return jsonResponse({ status: "failed" });
      }
      const encrypted = await encryptVoiceprint(voiceprint);
      // Atomic compare-and-swap: revocation while polling must win.
      const { data: updated, error: writeError } = await admin.from("speaker_integrity_enrollments")
        .update({
          status: "ready", provider_job_id: null, ...encrypted,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profileId).eq("status", "pending")
        .eq("provider_job_id", enrolled.provider_job_id)
        .select("status").maybeSingle();
      if (writeError) throw new Error("Failed to store encrypted voiceprint");
      return jsonResponse({ status: updated?.status ?? "unavailable" });
    }

    if (action === "revoke") {
      // Remove all derived observations as well as the biometric material.
      const { error } = await admin.from("speaker_integrity_enrollments")
        .update({
          status: "revoked", voiceprint_ciphertext: null, voiceprint_iv: null,
          provider_job_id: null, revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("profile_id", profileId).eq("user_id", caller.id);
      if (error) throw new Error("Could not revoke voice enrollment");
      const { error: checksError } = await admin.from("speaker_integrity_checks")
        .delete().eq("profile_id", profileId).eq("user_id", caller.id);
      if (checksError) throw new Error("Could not remove shadow evidence");
      return jsonResponse({ status: "revoked" });
    }

    if (action === "history") {
      const { data, error } = await admin.from("speaker_integrity_checks")
        .select("id, attempt_id, status, label, reason, match_confidence, observed_speaker_count, patient_speech_ms, other_or_unknown_speech_ms, manual_review_label, manually_reviewed_at, created_at")
        .eq("profile_id", profileId).eq("user_id", caller.id)
        .order("created_at", { ascending: false }).limit(25);
      if (error) throw new Error("Shadow evidence unavailable");
      return jsonResponse({ checks: (data ?? []).map(checkedRecord) });
    }

    // The only route that issues a brief signed audio URL is scoped to an
    // actual prior shadow check and its exact owned session.
    if (action === "review_audio" || action === "review") {
      const { checkId } = body;
      if (!isUuid(checkId)) return jsonResponse({ error: "Invalid check" }, 400);
      const { data: check, error: checkError } = await admin.from("speaker_integrity_checks")
        .select("id, session_id, attempt_id")
        .eq("id", checkId).eq("profile_id", profileId)
        .eq("user_id", caller.id).maybeSingle();
      if (checkError) throw new Error("Review lookup failed");
      if (!check) return jsonResponse({ error: "Check not found" }, 404);
      const { data: session, error: sessionError } = await admin.from("sessions")
        .select("id").eq("id", check.session_id).eq("user_id", caller.id)
        .eq("profile_id", profileId).maybeSingle();
      if (sessionError || !session) return jsonResponse({ error: "Session inaccessible" }, 403);

      if (action === "review") {
        const { label } = body;
        if (!["patient", "other", "mixed", "uncertain"].includes(label as string)) {
          return jsonResponse({ error: "Invalid review label" }, 400);
        }
        const { error } = await admin.from("speaker_integrity_checks")
          .update({
            manual_review_label: label,
            manually_reviewed_at: new Date().toISOString(),
            manually_reviewed_by: caller.id,
          })
          .eq("id", check.id).eq("profile_id", profileId);
        if (error) throw new Error("Review write failed");
        return jsonResponse({ updated: true, affectsScoring: false });
      }

      let { data: audio } = await admin.from("utterance_analyses")
        .select("audio_storage_path").eq("attempt_id", check.attempt_id)
        .eq("session_id", session.id).eq("user_id", caller.id).maybeSingle();
      if (!audio?.audio_storage_path) {
        const alt = await admin.from("exercise_events")
          .select("audio_storage_path").eq("attempt_id", check.attempt_id)
          .eq("session_id", session.id).maybeSingle();
        audio = alt.data;
      }
      const path = audio?.audio_storage_path;
      if (typeof path !== "string" || !path.startsWith(caller.id + "/" + session.id + "/")) {
        return jsonResponse({ error: "Audio unavailable" }, 404);
      }
      const { data: signed, error: signedError } = await admin.storage
        .from("session-recordings").createSignedUrl(path, 90);
      if (signedError || !signed?.signedUrl) return jsonResponse({ error: "Audio unavailable" }, 404);
      // Short-lived authorization to this specific object, no public bucket.
      return jsonResponse({ signedUrl: signed.signedUrl, expiresInSeconds: 90 });
    }

    // Both queue and poll require active enrollment.
    const { data: enrolled, error: enrollError } = await admin.from("speaker_integrity_enrollments")
      .select("status, updated_at, voiceprint_ciphertext, voiceprint_iv")
      .eq("profile_id", profileId).eq("user_id", caller.id).maybeSingle();
    if (enrollError) throw new Error("Enrollment state unavailable");
    if (enrolled?.status !== "ready" || !enrolled.voiceprint_ciphertext || !enrolled.voiceprint_iv) {
      return jsonResponse({ error: "Patient has no active consented voiceprint" }, 409);
    }

    if (action === "queue") {
      const { attemptId } = body;
      if (!isUuid(attemptId)) return jsonResponse({ error: "Invalid attempt" }, 400);
      // An attempt is a legitimate session recording, never an arbitrary URL or path.
      const { data: events, error: evError } = await admin.from("utterance_analyses")
        .select("attempt_id, session_id, audio_storage_path, recording_duration_ms")
        .eq("attempt_id", attemptId).eq("user_id", caller.id).limit(1);
      if (evError) throw new Error("Attempt lookup failed");
      let attempt = events?.[0] ?? null;
      if (!attempt?.audio_storage_path) {
        const { data: alternative, error: altError } = await admin.from("exercise_events")
          .select("attempt_id, session_id, audio_storage_path, recording_duration_ms")
          .eq("attempt_id", attemptId).limit(1);
        if (altError) throw new Error("Attempt lookup failed");
        attempt = alternative?.[0] ?? attempt;
      }
      if (!attempt || !isUuid(attempt.session_id) || typeof attempt.audio_storage_path !== "string") {
        return jsonResponse({ error: "No recorded audio for this attempt" }, 404);
      }
      const { data: session, error: sessionError } = await admin.from("sessions")
        .select("id").eq("id", attempt.session_id).eq("profile_id", profileId)
        .eq("user_id", caller.id).maybeSingle();
      if (sessionError) throw new Error("Session lookup failed");
      if (!session || !attempt.audio_storage_path.startsWith(caller.id + "/" + session.id + "/")) {
        return jsonResponse({ error: "Recording does not belong to patient session" }, 403);
      }
      const { data: previouslyChecked, error: oldError } = await admin.from("speaker_integrity_checks")
        .select("id, status").eq("profile_id", profileId).eq("attempt_id", attemptId).maybeSingle();
      if (oldError) throw new Error("Check lookup failed");
      if (previouslyChecked) return jsonResponse({ checkId: previouslyChecked.id, status: previouslyChecked.status });
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await admin.from("speaker_integrity_checks")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId).gte("created_at", since);
      if (countError) throw new Error("Quota lookup failed");
      if ((count ?? 0) >= MAX_CHECKS_PER_DAY) return jsonResponse({ error: "Daily shadow review limit reached" }, 429);
      const { data: inserted, error: createError } = await admin.from("speaker_integrity_checks")
        .insert({
          user_id: caller.id, profile_id: profileId, session_id: session.id,
          attempt_id: attemptId, enrollment_updated_at: enrolled.updated_at, status: "pending",
        }).select("id").single();
      if (createError || !inserted) {
        // Concurrent request: no duplicate provider charge.
        return jsonResponse({ error: "Check already queued or unavailable" }, 409);
      }
      try {
        const { data: blob, error: downloadError } = await admin.storage
          .from("session-recordings").download(attempt.audio_storage_path);
        if (downloadError || !blob || blob.size < 1_000 || blob.size > MAX_CHECK_BYTES) {
          throw new Error("Recorded audio unavailable or outside size limit");
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const mime = allowedMime(blob.type) ? blob.type : "audio/webm";
        const media = await uploadMedia(bytes, mime);
        const voiceprint = await decryptVoiceprint(enrolled.voiceprint_ciphertext, enrolled.voiceprint_iv);
        const job = await provider("/identify", "POST", {
          url: media, model: "precision-2",
          voiceprints: [{ label: "patient", voiceprint }],
          confidence: true,
          // Preserve overlapping speakers; never collapse caregiver speech.
          exclusive: false,
          matching: { exclusive: true, threshold: 60 },
        });
        if (!isUuid(job.jobId)) throw new Error("Invalid identification job");
        const { error } = await admin.from("speaker_integrity_checks")
          .update({ provider_job_id: job.jobId, updated_at: new Date().toISOString() })
          .eq("id", inserted.id).eq("status", "pending");
        if (error) throw new Error("Cannot save identification job");
        return jsonResponse({ checkId: inserted.id, status: "pending" });
      } catch (cause) {
        await admin.from("speaker_integrity_checks")
          .update({ status: "failed", label: "uncertain", reason: "provider_unavailable", updated_at: new Date().toISOString() })
          .eq("id", inserted.id).eq("status", "pending");
        throw cause;
      }
    }

    if (action === "poll_check") {
      const { checkId } = body;
      if (!isUuid(checkId)) return jsonResponse({ error: "Invalid check" }, 400);
      const { data: check, error } = await admin.from("speaker_integrity_checks")
        .select("id, attempt_id, status, label, reason, provider_job_id, enrollment_updated_at, match_confidence, observed_speaker_count, patient_speech_ms, other_or_unknown_speech_ms, manual_review_label, manually_reviewed_at, created_at")
        .eq("id", checkId).eq("profile_id", profileId).eq("user_id", caller.id).maybeSingle();
      if (error) throw new Error("Check lookup failed");
      if (!check) return jsonResponse({ error: "Check not found" }, 404);
      // Enrollment rotation/revocation invalidates a job tied to the old print.
      if (enrolled.updated_at !== check.enrollment_updated_at) {
        return jsonResponse({ error: "Check belongs to an older voiceprint" }, 409);
      }
      if (check.status !== "pending" || !isUuid(check.provider_job_id)) {
        return jsonResponse({ check: checkedRecord(check) });
      }
      const job = await provider("/jobs/" + check.provider_job_id, "GET");
      if (job.status === "failed" || job.status === "canceled") {
        await admin.from("speaker_integrity_checks")
          .update({ status: "failed", label: "uncertain", reason: "provider_unavailable", updated_at: new Date().toISOString() })
          .eq("id", checkId).eq("status", "pending");
        return jsonResponse({ check: { ...checkedRecord(check), status: "failed", label: "uncertain" } });
      }
      if (job.status !== "succeeded") return jsonResponse({ check: checkedRecord(check) });
      const attribution = classifySpeakerIdentification(job.output);
      const { data: updated, error: updateError } = await admin.from("speaker_integrity_checks")
        .update({
          status: "complete", label: attribution.label, reason: attribution.reason,
          match_confidence: attribution.matchConfidence,
          observed_speaker_count: attribution.observedSpeakerCount,
          patient_speech_ms: attribution.patientSpeechMs,
          other_or_unknown_speech_ms: attribution.otherOrUnknownSpeechMs,
          updated_at: new Date().toISOString(),
        }).eq("id", check.id).eq("status", "pending")
        .eq("enrollment_updated_at", enrolled.updated_at)
         .select("id, attempt_id, status, label, reason, match_confidence, observed_speaker_count, patient_speech_ms, other_or_unknown_speech_ms, manual_review_label, manually_reviewed_at, created_at").maybeSingle();
      if (updateError) throw new Error("Cannot save shadow result");
      return jsonResponse({ check: updated ? checkedRecord(updated) : checkedRecord(check) });
    }
    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    // Never log or return raw audio, voiceprints, provider payloads, signed URLs.
    console.warn("[speaker-integrity] operation failed", error instanceof Error ? error.message : "unexpected");
    return jsonResponse({ error: "Speaker integrity operation unavailable" }, 503);
  }
});
