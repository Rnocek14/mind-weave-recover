/**
 * Conversation Coach — design-of-record ladder (Phase 2, Wave 4).
 *
 * DESIGN-ONLY. Runtime continues to ride the Smart Coach / discourse
 * adaptation engine with its existing strategy switching and SCA cueing.
 * No progression hook, no difficulty bridge, no mastery routing.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/conversation-coach.md.
 * TL;DR: Supported Conversation for Adults with Aphasia (SCA — Kagan)
 * + Promoting Aphasic Communicative Effectiveness (PACE — Davis & Wilcox)
 * + Conversation Therapy (Hopper, Holland). Ladder advances on
 * communicative independence (scaffolded turns with cues → independent
 * turns with topic maintenance → topic shifts → conversational repair).
 * Per-level enforcement numerics intentionally omitted.
 *
 * Pure module — no I/O, no React.
 */

import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
} from './_shared/designOfRecord';

export type ConversationCoachLevelSpec = DesignOfRecordLevelSpec;

export const CONVERSATION_COACH_LEVELS: DesignOfRecordLevelTable = {
  1: {
    level: 1,
    description: 'Scripted turn — coach provides full model',
    targetSupport: 'carrier_or_full_model',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'scripted_full_model', description: 'Highly scaffolded scripted exchanges.', implemented: false },
  },
  2: {
    level: 2,
    description: 'Scripted turn — choice-based response under SCA cueing',
    targetSupport: 'choice_based',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'scripted_choice', description: 'Choice tiles with SCA visual support.', implemented: false },
  },
  3: {
    level: 3,
    description: 'Semi-scripted turn — semantic cue then open response',
    targetSupport: 'semantic_cue',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'semi_scripted_cue', description: 'Cue then patient produces.', implemented: false },
  },
  4: {
    level: 4,
    description: 'Open turn — independent on-topic response',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'open_on_topic', description: 'Independent turn, topic maintained.', implemented: false },
  },
  5: {
    level: 5,
    description: 'Multi-turn topic maintenance — sustained 3+ exchanges',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'multi_turn_topic', description: 'Topic held across exchanges.', implemented: false },
  },
  6: {
    level: 6,
    description: 'Topic introduction — patient initiates new topic appropriately',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'topic_initiate', description: 'Patient initiates topic shift.', implemented: false },
  },
  7: {
    level: 7,
    description: 'Conversational repair — patient detects and revises breakdown',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'repair', description: 'Self-monitored repair after coach signals breakdown.', implemented: false },
  },
  8: {
    level: 8,
    description: 'Spontaneous functional conversation across topics — design-of-record',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'spontaneous_functional', description: 'No runtime mode that scores cross-topic functional fluency.', implemented: false },
  },
};
