/**
 * Smart Coach — Topic Purpose Map
 * 
 * Maps every conversation topic to a clinical purpose.
 * This is the core of the Purpose Layer:
 * every topic must answer: what, why, how we measure, where it transfers.
 */

import type { PurposeContext } from './types';

export interface TopicDefinition {
  id: string;
  label: string;
  emoji: string;
  description: string;
  keywords: string[];
  purpose: PurposeContext;
}

const TOPIC_PURPOSE_MAP: Record<string, TopicDefinition> = {
  food: {
    id: 'food',
    label: 'Food & Cooking',
    emoji: '🍳',
    description: 'Meals, recipes, and favorites',
    keywords: ['food', 'cook', 'eat', 'meal', 'recipe', 'kitchen', 'lunch', 'dinner', 'breakfast'],
    purpose: {
      goalId: 'ordering_food',
      skillTarget: 'Retrieving everyday food and kitchen words',
      transferTarget: 'ordering at a restaurant, asking for food at home',
      rationale: 'Practicing familiar food words builds the same retrieval pathways you use when ordering meals or telling someone what you want to eat.',
      measure: 'Independent word retrieval, sentence completeness, cue count',
      supportMode: 'guided_retrieval',
      expectedDifficulty: 'easy',
    },
  },
  family: {
    id: 'family',
    label: 'Family',
    emoji: '👨‍👩‍👧',
    description: 'People you care about',
    keywords: ['family', 'mom', 'dad', 'sister', 'brother', 'kids', 'son', 'daughter', 'husband', 'wife'],
    purpose: {
      goalId: 'describing_people',
      skillTarget: 'Building sentences about people and relationships',
      transferTarget: 'telling stories about family, introducing people',
      rationale: 'Describing the people in your life practices the sentence-building skills you use in everyday conversation.',
      measure: 'Sentence length, descriptive detail, independent responses',
      supportMode: 'open_conversation',
      expectedDifficulty: 'moderate',
    },
  },
  hobbies: {
    id: 'hobbies',
    label: 'Hobbies',
    emoji: '🎨',
    description: 'Things you enjoy doing',
    keywords: ['hobby', 'fun', 'play', 'game', 'read', 'music', 'garden', 'sport', 'watch'],
    purpose: {
      goalId: 'expressing_preferences',
      skillTarget: 'Expressing preferences and describing activities',
      transferTarget: 'telling someone what you enjoy, joining conversations about interests',
      rationale: 'Talking about things you enjoy practices expressing preferences — something you do every day in social conversation.',
      measure: 'Vocabulary range, preference expression, fluency',
      supportMode: 'open_conversation',
      expectedDifficulty: 'easy',
    },
  },
  daily_routine: {
    id: 'daily_routine',
    label: 'Daily Routine',
    emoji: '☀️',
    description: 'Your day, morning to night',
    keywords: ['morning', 'day', 'routine', 'wake', 'sleep', 'night', 'afternoon', 'evening'],
    purpose: {
      goalId: 'sequencing_events',
      skillTarget: 'Describing events in order and using time words',
      transferTarget: 'telling someone about your day, explaining what happened',
      rationale: 'Describing your daily routine practices sequencing — putting events in order, which strengthens everyday storytelling.',
      measure: 'Event sequencing accuracy, time word usage, narrative flow',
      supportMode: 'structured_practice',
      expectedDifficulty: 'moderate',
    },
  },
  travel: {
    id: 'travel',
    label: 'Travel & Places',
    emoji: '✈️',
    description: 'Places you\'ve been',
    keywords: ['travel', 'trip', 'visit', 'place', 'city', 'beach', 'vacation', 'country'],
    purpose: {
      goalId: 'describing_places',
      skillTarget: 'Describing locations and experiences with detail',
      transferTarget: 'telling someone about a trip, describing where you want to go',
      rationale: 'Describing places you\'ve been practices detailed description — the same skill you use when giving directions or sharing memories.',
      measure: 'Descriptive vocabulary, spatial language, sentence complexity',
      supportMode: 'open_conversation',
      expectedDifficulty: 'moderate',
    },
  },
  pets: {
    id: 'pets',
    label: 'Pets & Animals',
    emoji: '🐕',
    description: 'Furry friends',
    keywords: ['pet', 'dog', 'cat', 'animal', 'walk', 'feed', 'puppy', 'kitten'],
    purpose: {
      goalId: 'describing_routines',
      skillTarget: 'Naming animals and describing care routines',
      transferTarget: 'talking about pets with friends, describing animal needs to a vet',
      rationale: 'Talking about pets practices naming and routine descriptions — familiar words that help build retrieval confidence.',
      measure: 'Noun retrieval speed, action verb usage, independent responses',
      supportMode: 'guided_retrieval',
      expectedDifficulty: 'easy',
    },
  },
};

/** Get purpose context for a topic ID */
export function getTopicPurpose(topicId: string): PurposeContext {
  const topic = TOPIC_PURPOSE_MAP[topicId];
  if (topic) return topic.purpose;
  
  // Default purpose for unknown topics
  return {
    goalId: 'general_conversation',
    skillTarget: 'General word retrieval and sentence building',
    transferTarget: 'everyday conversations',
    rationale: 'Practicing conversation helps maintain and strengthen your communication skills.',
    measure: 'Word count, fluency, independence',
    supportMode: 'open_conversation',
    expectedDifficulty: 'moderate',
  };
}

/** Get all available topics */
export function getAllTopics(): TopicDefinition[] {
  return Object.values(TOPIC_PURPOSE_MAP);
}

/** Get a specific topic definition */
export function getTopicDefinition(topicId: string): TopicDefinition | undefined {
  return TOPIC_PURPOSE_MAP[topicId];
}
