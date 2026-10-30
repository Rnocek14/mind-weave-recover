/**
 * Explicit temporary fail-closed release gate for all in-app research CSVs.
 *
 * Existing research serializers retain stable raw identifiers and may include
 * clinical free-text or exact dates. A weak deterministic hash is NOT a
 * de-identification procedure. This flag must stay false until the approved
 * privacy/export workflow has tests for every permitted column and recipient.
 *
 * This is a UI/application safety stop; DB authorization/RLS and audit logging
 * are separate, mandatory clinical security controls.
 */
export const CLINICAL_RESEARCH_EXPORTS_ENABLED = false;

export const RESEARCH_EXPORT_PAUSE_EXPLANATION =
  'Research CSV downloads are temporarily unavailable pending clinical privacy review. Existing pseudonyms do not establish de-identification; do not share prior exports as anonymous data.';

export function canExportResearchData(): boolean {
  return CLINICAL_RESEARCH_EXPORTS_ENABLED;
}
