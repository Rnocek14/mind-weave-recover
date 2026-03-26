/**
 * Maps cognitive domain slugs to plain-language, real-world activities
 * that caregivers can do with patients at home.
 */

import type { DomainSlug } from "@/lib/cognitiveStateEngine";

export interface CaregiverAction {
  text: string;
  /** Short label for the domain in caregiver-friendly language */
  domainLabel: string;
}

const ACTION_MAP: Record<string, CaregiverAction[]> = {
  lexical_retrieval: [
    { text: "Name objects around the house together — kitchen items are great", domainLabel: "word finding" },
    { text: "Pause and give extra time before helping with a word", domainLabel: "word finding" },
    { text: "Look at family photos and name the people and places", domainLabel: "word finding" },
  ],
  semantic_depth: [
    { text: "Group items by category — foods, animals, clothing", domainLabel: "word meaning" },
    { text: "Ask 'what goes with this?' questions during meals", domainLabel: "word meaning" },
    { text: "Play simple sorting games with everyday objects", domainLabel: "word meaning" },
  ],
  phonology: [
    { text: "Encourage repeating sounds slowly, one syllable at a time", domainLabel: "sound skills" },
    { text: "Break difficult words into smaller parts together", domainLabel: "sound skills" },
    { text: "Practice rhyming words during daily routines", domainLabel: "sound skills" },
  ],
  syntax: [
    { text: "Encourage full sentences instead of single words", domainLabel: "sentences" },
    { text: "Repeat back what they say in a complete sentence as a model", domainLabel: "sentences" },
    { text: "Practice simple directions together: 'Put the cup on the table'", domainLabel: "sentences" },
  ],
  discourse_organization: [
    { text: "Have short conversations about daily events", domainLabel: "telling stories" },
    { text: "Ask open-ended questions and wait patiently", domainLabel: "telling stories" },
    { text: "Ask them to describe what happened during their day", domainLabel: "telling stories" },
  ],
  executive_function: [
    { text: "Practice simple planning: 'What do we need from the store?'", domainLabel: "problem solving" },
    { text: "Do puzzles or simple card games together", domainLabel: "problem solving" },
    { text: "Break tasks into small steps and do them one at a time", domainLabel: "problem solving" },
  ],
  cognitive_endurance: [
    { text: "Keep sessions short — even 5 minutes of focused practice helps", domainLabel: "focus" },
    { text: "Take breaks when they seem tired — rest is part of recovery", domainLabel: "focus" },
    { text: "Practice at the time of day when they have the most energy", domainLabel: "focus" },
  ],
};

/**
 * Given a domain slug, return 2 randomized caregiver actions.
 * Returns generic tips if domain is unknown.
 */
export function getActionsForDomain(slug: string): CaregiverAction[] {
  const pool = ACTION_MAP[slug];
  if (!pool?.length) {
    return [
      { text: "Celebrate their progress — positive reinforcement helps recovery", domainLabel: "general" },
      { text: "Practice together — even sitting with them during a session helps", domainLabel: "general" },
    ];
  }
  // Shuffle and take 2
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

/**
 * Generate a headline for caregiver guidance based on the primary struggle domain.
 */
export function getGuidanceHeadline(domainLabel: string, patientName: string): string {
  return `This week, ${patientName} is working on ${domainLabel}`;
}
