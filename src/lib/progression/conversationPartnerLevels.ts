/**
 * Conversation Partner — design-of-record ladder (Phase 2, Wave 4).
 *
 * DESIGN-ONLY. Runtime continues to ride the conversation-partner agent
 * loop with its existing strategy switching. No progression hook, no
 * difficulty bridge, no mastery routing.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/conversation-partner.md.
 * TL;DR: Partner-training literature (SCA — Kagan; Communication Partner
 * Training meta-analyses — Simmons-Mackie et al.) reframes the dyad as
 * the unit of intervention. Compared to Conversation Coach (didactic
 * scaffolding), Conversation Partner emphasizes ecologically valid
 * exchanges with a real-feeling interlocutor. Ladder advances on
 * partner-load (predictable partner with high support → naturalistic
 * partner with minimal repair → multi-party / unfamiliar partner). Per-level
 * enforcement numerics intentionally omitted.
 *
 * Pure module — no I/O, no React.
 */

import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
} from './_shared/designOfRecord';

export type ConversationPartnerLevelSpec = DesignOfRecordLevelSpec;

export const CONVERSATION_PARTNER_LEVELS: DesignOfRecordLevelTable = {
  1: {
    level: 1,
    description: 'Familiar topic, highly predictable partner — choice-supported',
    targetSupport: 'choice_based',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'familiar_predictable_choice', description: 'Partner stays on script with choice support.', implemented: false },
  },
  2: {
    level: 2,
    description: 'Familiar topic, predictable partner — semantic cue on stall',
    targetSupport: 'semantic_cue',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'familiar_predictable_cue', description: 'Cue only when patient stalls.', implemented: false },
  },
  3: {
    level: 3,
    description: 'Familiar topic, naturalistic partner — independent turns',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'familiar_natural_independent', description: 'Naturalistic exchange on known topic.', implemented: false },
  },
  4: {
    level: 4,
    description: 'New topic, naturalistic partner — patient holds topic',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'new_topic_hold', description: 'Topic maintenance on new content.', implemented: false },
  },
  5: {
    level: 5,
    description: 'Naturalistic partner — minor repair tolerated, recovers in turn',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'natural_minor_repair', description: 'Partner signals minor breakdown; patient repairs.', implemented: false },
  },
  6: {
    level: 6,
    description: 'Naturalistic partner — patient introduces topic shift',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'natural_topic_shift', description: 'Patient-initiated topic change.', implemented: false },
  },
  7: {
    level: 7,
    description: 'Unfamiliar partner persona — patient adapts register',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'unfamiliar_register', description: 'Register / formality adjustment across personas.', implemented: false },
  },
  8: {
    level: 8,
    description: 'Multi-party / unfamiliar partner across contexts — design-of-record',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'multi_party_contextual', description: 'No runtime mode for multi-party simulation or context-shift scoring.', implemented: false },
  },
};
