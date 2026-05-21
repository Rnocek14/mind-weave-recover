/**
 * Design-of-record level spec — shared shape for Wave 4 (discourse /
 * open-ended games).
 *
 * These specs are PUBLISHED CLINICAL DESIGN only. They are NOT wired into
 * runtime: no progression hook, no difficulty bridge, no mastery routing,
 * no per-level mastery enforcement. The games continue to ride the
 * existing discourse adaptation engine.
 *
 * Purpose:
 *   - Surface clinical intent (level → support / complexity progression)
 *     on each game's About page so clinicians can read the ladder we are
 *     building toward.
 *   - Reserve the slug / level shape so a future structural migration can
 *     promote these without re-designing.
 *
 * Honesty discipline:
 *   - `implemented: false` on every contentSelector — runtime does not yet
 *     enforce any of this.
 *   - No `minOnTargetAttempts` / `minOnTargetAccuracy` — promotion is not
 *     evidence-gated yet, and we MUST NOT render numerics the engine does
 *     not actually enforce.
 *
 * Pure module — no I/O, no React.
 */

import type { SupportLevel } from '../clinicalProgression';

export interface DesignOfRecordLevelSpec {
  level: number;
  description: string;
  /** Intended clinical support target if/when the ladder is enforced. */
  targetSupport: SupportLevel;
  /** Phase 1 readiness — almost always 'aspirational' for design-only. */
  readiness: 'ready' | 'thin' | 'aspirational';
  /** Always `implemented: false` for design-only specs. */
  contentSelector: {
    tierKey: string;
    description: string;
    implemented: false;
  };
}

export type DesignOfRecordLevelTable = Record<number, DesignOfRecordLevelSpec>;
