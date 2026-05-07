/**
 * Shadow Gate version constants — replay invariants pinned in code.
 *
 * Source of truth: docs/shadow-gate-replay-spec.md §3.
 *
 * These constants are part of the governance identity 5-tuple:
 *   (trial_id, surface, gate_policy_version, checklist_version, adopted_slug_set_version)
 *     → ShadowGateDecision
 *
 * Bump rules (from spec §3, restated for the implementer):
 *
 *   GATE_POLICY_VERSION
 *     Bump when:
 *       - The §4 rule→verdict table in docs/progression-gating-spec.md changes.
 *       - The POLICY map in gate.ts changes (any add / remove / verdict change).
 *       - Strictest-wins ordering or tie-break changes.
 *       - Any behavioral change to evaluateGate() — the code and the policy
 *         version are kept in lockstep on purpose; evaluateGate does not get
 *         its own separate version.
 *     Never decrement. Never silently re-use a prior version after a
 *     behavioral change.
 *
 *   ADOPTED_SLUG_SET_VERSION
 *     Bump when:
 *       - ADOPTED_GATE_SLUGS in gate.ts gains or loses a slug.
 *     Never decrement.
 *
 * Discipline mechanism:
 *   The version constants below are paired with content-hash sentinels
 *   computed from the POLICY map and the adopted slug set. The gate's
 *   own unit tests assert that:
 *     - changing POLICY without bumping GATE_POLICY_VERSION fails the build.
 *     - changing ADOPTED_GATE_SLUGS without bumping ADOPTED_SLUG_SET_VERSION
 *       fails the build.
 *   This makes silent governance drift impossible.
 *
 * What this file is NOT:
 *   - Not a runtime feature.
 *   - Not consumed by any UI, mastery write, or enforcement path.
 *   - Not a versioned schema.
 *   It is purely the constitutional version axes for replay integrity.
 */

/**
 * Current gate policy version.
 *
 * v0.1.0 = initial policy as transcribed from progression-gating-spec.md §4
 *          on 2026-05-07. Strictest-wins ordering: drop > delay > annotate > pass.
 */
export const GATE_POLICY_VERSION = 'v0.1.0' as const;

/**
 * Current adopted slug set version.
 *
 * v0.1.0 = { photo-naming } only.
 */
export const ADOPTED_SLUG_SET_VERSION = 'v0.1.0' as const;

/**
 * Stable content sentinels.
 *
 * These are NOT cryptographic hashes. They are deterministic short fingerprints
 * over the policy table and adopted slug set, computed at module load. The
 * unit tests pin them to known constants so any unrecorded edit fails CI.
 *
 * Implementation detail: kept simple (FNV-1a over a canonical JSON form) so
 * the test failure message is reproducible across machines without crypto.
 */
export function fingerprint(input: string): string {
  // FNV-1a 32-bit; deterministic, dependency-free.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Pinned fingerprints. Bumping a version constant REQUIRES updating the
 * corresponding sentinel here so the test suite acknowledges the change.
 *
 * If you change POLICY or ADOPTED_GATE_SLUGS in gate.ts you MUST:
 *   1. Bump the corresponding *_VERSION constant above.
 *   2. Update the corresponding sentinel below to the new fingerprint
 *      (run the failing test once; the expected value is in the failure).
 *   3. Update docs/shadow-gate-replay-spec.md §3 if the change affects
 *      replay semantics (it almost always does).
 */
export const PINNED_POLICY_FINGERPRINT = 'db4b41d6' as const;
export const PINNED_ADOPTED_SLUGS_FINGERPRINT = '71ee589a' as const;
