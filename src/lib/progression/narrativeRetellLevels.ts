/**
 * Narrative Retell — design-of-record ladder (Phase 2, Wave 4).
 *
 * DESIGN-ONLY. Runtime continues to ride the discourse adaptation engine.
 * No progression hook, no difficulty bridge, no mastery routing.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/narrative-retell.md.
 * TL;DR: Story-retell macrostructure analysis (Ulatowska; Wright & Capilouto)
 * + script training carryover. Ladder advances on narrative complexity
 * (simple sequential → episodic with goal/attempt/outcome → multi-episode
 * with theme). Per-level enforcement numerics intentionally omitted.
 *
 * Pure module — no I/O, no React.
 */

import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
} from './_shared/designOfRecord';

export type NarrativeRetellLevelSpec = DesignOfRecordLevelSpec;

export const NARRATIVE_RETELL_LEVELS: DesignOfRecordLevelTable = {
  1: {
    level: 1,
    description: 'Short sequential story (3–4 events) — gist retell',
    targetSupport: 'choice_based',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'short_sequential_gist', description: 'Bank tier 1 with gist-only credit.', implemented: false },
  },
  2: {
    level: 2,
    description: 'Short sequential story — core events in order',
    targetSupport: 'choice_based',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'short_sequential_ordered', description: 'Bank tier 1 with sequence-integrity expectation.', implemented: false },
  },
  3: {
    level: 3,
    description: 'Episodic story (setting + initiating event + outcome)',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'episodic_basic', description: 'Bank tier 2: setting + IE + outcome required.', implemented: false },
  },
  4: {
    level: 4,
    description: 'Episodic story — goal + attempt + outcome (full episode)',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'episodic_full', description: 'Bank tier 2 with full episode structure.', implemented: false },
  },
  5: {
    level: 5,
    description: 'Multi-episode narrative — chronology preserved',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'multi_episode_chrono', description: 'Bank tier 2–3 boundary, chronology scored.', implemented: false },
  },
  6: {
    level: 6,
    description: 'Multi-episode narrative — theme/moral surfaced',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'multi_episode_theme', description: 'Bank tier 3 with thematic-coherence credit.', implemented: false },
  },
  7: {
    level: 7,
    description: 'Long narrative — character perspective + causality',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'long_perspective', description: 'Bank tier 3 sparse; perspective + causal links.', implemented: false },
  },
  8: {
    level: 8,
    description: 'Spontaneous retell of novel narrative — design-of-record',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'novel_spontaneous', description: 'No runtime mode for novel-story bank or coherence scoring.', implemented: false },
  },
};
