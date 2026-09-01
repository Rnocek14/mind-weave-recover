/**
 * Patient-facing exposure of the composite Recovery Score.
 *
 * RECOVERY_OUTCOME_METRICS.md ("Composite Recovery Score") is explicit:
 * the composite must not ship until the individual metrics are validated
 * against real patient data. Clinician surfaces (Patient Hub) keep the
 * beta-labeled score — clinicians can contextualize an uncalibrated,
 * directional number. Patient surfaces (Recovery Progress hero, Smart
 * Coach summary, the /recovery-score breakdown page) are held behind this
 * flag until concurrent-validity work (correlation against stored
 * standardized assessments) lands.
 *
 * Flip to true only alongside that validation evidence — not for a demo.
 */
export const PATIENT_RECOVERY_SCORE_ENABLED = false;
