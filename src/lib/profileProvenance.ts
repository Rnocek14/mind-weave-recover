/**
 * Profile provenance (launch data-quality, plan A2).
 *
 * Records HOW a patient's clinical profile was produced so the future dataset
 * is reconstructable. This is one of the few things that becomes impossible to
 * recover after the fact, so every write path that creates or replaces a
 * clinical profile should record its source.
 *
 *   - onboarding : provisional profile built from the self-serve screener
 *   - caregiver  : a caregiver entered the profile by hand
 *   - document   : parsed from an uploaded clinical document (note/eval)
 *   - clinician  : authored or overridden by a clinician
 *
 * `field_confidence` is a per-field map (e.g. { "impairments.speech": "high" })
 * describing how confident we are in each major field — sourced from the
 * document parser when available.
 */

import { supabase } from "@/integrations/supabase/client";

export type ProfileSource =
  | "onboarding"
  | "caregiver"
  | "document"
  | "clinician";

export type FieldConfidence = Record<string, "high" | "medium" | "low">;

/**
 * Stamp provenance onto the user's active profile row. Best-effort and
 * non-blocking: provenance is metadata, so a failure here must never break the
 * primary flow (onboarding, upload, etc.).
 */
export async function setProfileProvenance(
  userId: string | undefined | null,
  source: ProfileSource,
  fieldConfidence?: FieldConfidence
): Promise<void> {
  if (!userId) return;
  try {
    const update: Record<string, unknown> = { profile_source: source };
    if (fieldConfidence && Object.keys(fieldConfidence).length > 0) {
      update.field_confidence = fieldConfidence;
    }
    await supabase
      .from("profiles")
      .update(update)
      .eq("user_id", userId)
      .eq("is_active", true);
  } catch (err) {
    console.warn("setProfileProvenance failed (non-blocking):", err);
  }
}
