/**
 * Document-processing consent (launch-critical, plan A3).
 *
 * Uploaded clinical documents (discharge summaries, SLP evaluations, rehab
 * reports) are real medical records. Before any document is stored or parsed
 * the user must give explicit consent to process it. This hook checks whether
 * a valid consent record already exists and records one when the user agrees.
 *
 * Backed by the existing `consent_records` table using
 * `consent_type = 'document_processing'` (decoupled from clinical-trial
 * enrollment).
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Bump when the consent language materially changes so users re-consent.
export const DOCUMENT_CONSENT_VERSION = 1;

export const DOCUMENT_CONSENT_TEXT = `By uploading a clinical document you confirm you are permitted to share it and you consent to it being securely stored and analyzed to personalize this person's therapy. Documents may contain protected health information. You can request deletion at any time.`;

export function useDocumentConsent() {
  const { user } = useAuth();
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setHasConsent(false);
      return;
    }
    try {
      // Cast: generated types lag behind the new consent_type/user_id columns.
      const { data, error } = await (supabase.from("consent_records") as any)
        .select("id, consent_version")
        .eq("consent_type", "document_processing")
        .eq("user_id", user.id)
        .gte("consent_version", DOCUMENT_CONSENT_VERSION)
        .limit(1);
      if (error) throw error;
      setHasConsent((data?.length ?? 0) > 0);
    } catch (err) {
      console.warn("useDocumentConsent refresh failed:", err);
      setHasConsent(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Record consent for the signed-in user. Returns true on success. */
  const recordConsent = useCallback(
    async (signedName?: string): Promise<boolean> => {
      if (!user?.id) return false;
      setIsRecording(true);
      try {
        const { error } = await supabase.from("consent_records").insert({
          consent_type: "document_processing",
          user_id: user.id,
          consent_version: DOCUMENT_CONSENT_VERSION,
          signed_name: signedName || user.email || null,
          signed_at: new Date().toISOString(),
          document_text_snapshot: DOCUMENT_CONSENT_TEXT,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
        if (error) throw error;
        setHasConsent(true);
        return true;
      } catch (err) {
        console.error("recordConsent failed:", err);
        return false;
      } finally {
        setIsRecording(false);
      }
    },
    [user?.id, user?.email]
  );

  return { hasConsent, isRecording, recordConsent, refresh };
}
