/**
 * Smart Coach — Clinical Playbooks
 * 
 * Per-topic therapy protocols that transform conversations into goal-directed sessions.
 * Each playbook defines objectives, elicitation strategies, tangent limits, and transfer checks.
 * 
 * Design rule: These are GUIDES, not scripts. The engine should pursue objectives
 * adaptively, not bind them to exact turn numbers.
 */

// ─── Types ───────────────────────────────────────────────────

export type TurnObjective =
  | 'warmup_anchor'
  | 'elicit_core_content'
  | 'organize_or_expand'
  | 'sentence_level_production'
  | 'transfer_check'
  | 'wrapup_reflection';

export interface ObjectiveDefinition {
  id: TurnObjective;
  /** Loose signals that this objective has been met */
  successSignals: string[];
  /** Prompts to inject when pursuing this objective */
  elicitationPrompts: string[];
  /** Prompts to use when redirecting from tangent back to this objective */
  redirectPrompts: string[];
}

export interface ClinicalPlaybook {
  topicId: string;
  skillTarget: string;
  transferTarget: string;
  /** Max turns on the same sub-detail before forced redirect */
  maxSubtopicDepth: number;
  objectives: ObjectiveDefinition[];
  tangentRedirectTemplates: string[];
  transferTemplates: string[];
  wrapupTemplates: string[];
}

// ─── Food & Cooking ─────────────────────────────────────────

const FOOD_PLAYBOOK: ClinicalPlaybook = {
  topicId: 'food',
  skillTarget: 'everyday word retrieval and phrase-level food descriptions',
  transferTarget: 'ordering a meal, describing what you want to eat',
  maxSubtopicDepth: 2,
  objectives: [
    {
      id: 'warmup_anchor',
      successSignals: ['names a food item', 'gives a food preference', 'names a meal or dish'],
      elicitationPrompts: [
        "What's something you like to eat?",
        "What did you have for your last meal?",
        "What's your favorite thing to order?",
        "What's a food you enjoy a lot?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'elicit_core_content',
      successSignals: ['names dish type, ingredient, topping, or preparation', 'gives at least 2 food-related content words'],
      elicitationPrompts: [
        "What kind do you usually like?",
        "What do you put with it?",
        "How do you usually have it?",
        "What goes with that?",
      ],
      redirectPrompts: [
        "Got it — {detail}. Do you usually order it or make it at home?",
        "Nice. Staying with the food itself, what else comes with it?",
      ],
    },
    {
      id: 'organize_or_expand',
      successSignals: ['produces 2+ content words in one response', 'names item + modifier', 'names item + source/context'],
      elicitationPrompts: [
        "Can you say the whole order in one phrase?",
        "How would you ask for that at a restaurant?",
        "Can you tell me the full thing you'd want?",
      ],
      redirectPrompts: [
        "Nice detail. How would you describe the whole dish?",
      ],
    },
    {
      id: 'sentence_level_production',
      successSignals: ['produces a sentence or near-sentence', 'uses request language like I want, I\'d like, Can I get'],
      elicitationPrompts: [
        "Say it like you're ordering it.",
        "What would you say to the server?",
        "Can you tell me the whole order in one sentence?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'transfer_check',
      successSignals: ['phrases a realistic order', 'answers a food preference question clearly'],
      elicitationPrompts: [
        "If you were ordering lunch, what would you say?",
        "If someone asked what you wanted, how would you answer?",
        "What would you order from a menu?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'wrapup_reflection',
      successSignals: [],
      elicitationPrompts: [],
      redirectPrompts: [],
    },
  ],
  tangentRedirectTemplates: [
    "Got it — {subtopic}. Staying with the meal, what else came with it?",
    "Nice. Back to the food itself — how would you describe the whole dish?",
    "That makes sense. If you were ordering it, what would you call it?",
  ],
  transferTemplates: [
    "If you were ordering lunch, what would you say?",
    "If someone asked what you wanted, how would you answer?",
    "What would you order from a menu?",
  ],
  wrapupTemplates: [
    "You found '{word1}' and '{word2}' clearly today. That's the same language you'd use ordering a meal.",
    "You described {dishPhrase} well. That helps when telling someone what you want to eat.",
    "You practiced food words and short order phrases today. That's real-world communication.",
  ],
};

// ─── Family & People ────────────────────────────────────────

const FAMILY_PLAYBOOK: ClinicalPlaybook = {
  topicId: 'family',
  skillTarget: 'naming people and relationships, building short relational sentences',
  transferTarget: 'introducing family members, telling stories about family',
  maxSubtopicDepth: 2,
  objectives: [
    {
      id: 'warmup_anchor',
      successSignals: ['names a person', 'names a relationship', 'names family role'],
      elicitationPrompts: [
        "Who's someone important to you?",
        "Tell me about one person in your family.",
        "Who would you like to talk about?",
        "Who comes to mind first?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'elicit_core_content',
      successSignals: ['names relationship and one detail', 'produces person + fact'],
      elicitationPrompts: [
        "Where does she live?",
        "What's he like?",
        "What does she do?",
        "How do you know them?",
      ],
      redirectPrompts: [
        "Got it — {detail}. Staying with {person}, what does she do there?",
        "Nice. About that person, what's one more thing you'd want someone to know?",
      ],
    },
    {
      id: 'organize_or_expand',
      successSignals: ['gives 2 linked facts', 'produces a short sentence about the person'],
      elicitationPrompts: [
        "Can you say a full sentence about her?",
        "Tell me about her in one sentence.",
        "What would you say if you were introducing her?",
      ],
      redirectPrompts: [
        "Nice detail. How would you describe them in one sentence?",
      ],
    },
    {
      id: 'sentence_level_production',
      successSignals: ['produces "This is my..."', 'describes relationship + detail in one sentence'],
      elicitationPrompts: [
        "How would you introduce her to someone?",
        "Can you tell me who she is and one thing about her?",
        "Say it like you're telling a friend about her.",
      ],
      redirectPrompts: [],
    },
    {
      id: 'transfer_check',
      successSignals: ['can phrase a realistic introduction', 'answers a social question about family clearly'],
      elicitationPrompts: [
        "If someone asked about your daughter, what would you say?",
        "How would you introduce your son to a friend?",
        "If someone asked who lives in {place}, how would you answer?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'wrapup_reflection',
      successSignals: [],
      elicitationPrompts: [],
      redirectPrompts: [],
    },
  ],
  tangentRedirectTemplates: [
    "Got it — {subtopic}. About {person}, what does she do there?",
    "Nice detail. Staying with {person}, how would you describe them in one sentence?",
    "That helps. If someone asked about {person}, what would you say?",
  ],
  transferTemplates: [
    "If someone asked about your family, what would you say?",
    "How would you introduce them to a friend?",
    "If someone asked who {person} is, how would you answer?",
  ],
  wrapupTemplates: [
    "You clearly named {relationshipWord} and described {personDetail}. That helps when talking about family.",
    "You practiced introducing someone important today. That's real conversation.",
    "You built a fuller sentence about {person}. That matters in everyday social talk.",
  ],
};

// ─── Daily Routine ──────────────────────────────────────────

const DAILY_ROUTINE_PLAYBOOK: ClinicalPlaybook = {
  topicId: 'daily_routine',
  skillTarget: 'sequencing events, using time markers, retelling daily events in order',
  transferTarget: 'telling someone about your day, answering what did you do today',
  maxSubtopicDepth: 1, // Strongest tangent control — this topic drifts easily
  objectives: [
    {
      id: 'warmup_anchor',
      successSignals: ['names a daily event', 'mentions work/home/morning activity'],
      elicitationPrompts: [
        "What have you been up to today?",
        "What did you do first this morning?",
        "Walk me through your morning.",
        "What was the first thing you did today?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'elicit_core_content',
      successSignals: ['gives multiple actions', 'references order', 'gives event chain'],
      elicitationPrompts: [
        "What came after that?",
        "Then what?",
        "What was next?",
        "And after breakfast?",
      ],
      redirectPrompts: [
        "Got it — {detail}. After that, what happened next?",
        "Nice. Staying with the order of your day, what came after that?",
        "Okay — that was {detail}. What was the next part of the morning?",
      ],
    },
    {
      id: 'organize_or_expand',
      successSignals: ['uses first/then/after that/later', 'puts events in sequence'],
      elicitationPrompts: [
        "Can you put those in order?",
        "What happened first, then next?",
        "Tell me those two steps using 'first' and 'then.'",
        "What came right after that?",
      ],
      redirectPrompts: [
        "Good. Now can you say those steps in order?",
      ],
    },
    {
      id: 'sentence_level_production',
      successSignals: ['gives a full morning/evening summary', 'connects events in sentence form'],
      elicitationPrompts: [
        "Can you say your whole morning in one sentence?",
        "Tell me the morning from start to finish.",
        "How would you say that whole routine out loud?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'transfer_check',
      successSignals: ['answers how was your day question', 'retells routine to imagined listener'],
      elicitationPrompts: [
        "If someone asked what you did today, what would you say?",
        "How would you tell a family member about your morning?",
        "If I asked, 'How was your day?', how would you answer?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'wrapup_reflection',
      successSignals: [],
      elicitationPrompts: [],
      redirectPrompts: [],
    },
  ],
  tangentRedirectTemplates: [
    "Got it — {detail}. After that part, what happened next?",
    "That makes sense. Staying with the order of your morning, what came after?",
    "Okay — that was one part. What was the next step in your day?",
  ],
  transferTemplates: [
    "If someone asked what you did today, what would you say?",
    "How would you tell a family member about your morning?",
    "If I asked, 'How was your day?', how would you answer?",
  ],
  wrapupTemplates: [
    "You practiced putting events in order today — like {event1}, then {event2}. That helps when telling someone about your day.",
    "You used sequence language to describe your routine. That's real-world conversation.",
    "You built a clearer story of your day today. That matters in everyday talk.",
  ],
};

// ─── Hobbies & Interests ────────────────────────────────────

const HOBBIES_PLAYBOOK: ClinicalPlaybook = {
  topicId: 'hobbies',
  skillTarget: 'naming activities, expressing preferences, describing participation',
  transferTarget: 'telling someone what you enjoy, social conversation about interests',
  maxSubtopicDepth: 2,
  objectives: [
    {
      id: 'warmup_anchor',
      successSignals: ['names an activity', 'names a pastime', 'names preference'],
      elicitationPrompts: [
        "What's something you enjoy doing?",
        "What do you like to do in your free time?",
        "What's a hobby you enjoy?",
        "What do you like doing most?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'elicit_core_content',
      successSignals: ['gives hobby + one detail', 'names type, place, or person'],
      elicitationPrompts: [
        "Where do you usually go?",
        "Who do you do that with?",
        "What kind do you like most?",
        "How often do you do that?",
      ],
      redirectPrompts: [
        "Nice — {detail}. Staying with {hobby}, who do you usually do that with?",
        "Got it — {detail}. What do you enjoy most about it?",
      ],
    },
    {
      id: 'organize_or_expand',
      successSignals: ['produces phrase/sentence', 'gives reason or emotional connection'],
      elicitationPrompts: [
        "Can you tell me why you like it?",
        "Say one full sentence about what you enjoy.",
        "What makes that fun for you?",
      ],
      redirectPrompts: [
        "Nice. How would you describe the whole hobby to someone new?",
      ],
    },
    {
      id: 'sentence_level_production',
      successSignals: ['produces hobby + context sentence', 'expresses preference clearly'],
      elicitationPrompts: [
        "How would you tell someone about that hobby?",
        "Can you say that in one full sentence?",
        "What would you say if someone asked what you enjoy doing?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'transfer_check',
      successSignals: ['gives realistic social answer about hobby', 'expresses preference in full sentence'],
      elicitationPrompts: [
        "If someone asked what you like to do, how would you answer?",
        "How would you tell a friend about your hobby?",
        "What would you say if someone asked what you enjoy on weekends?",
      ],
      redirectPrompts: [],
    },
    {
      id: 'wrapup_reflection',
      successSignals: [],
      elicitationPrompts: [],
      redirectPrompts: [],
    },
  ],
  tangentRedirectTemplates: [
    "Nice. Staying with {hobby}, what do you like most about it?",
    "Got it — {detail}. If you were telling someone about this hobby, what would you say?",
    "That makes sense. How would you describe the whole hobby to someone new?",
  ],
  transferTemplates: [
    "If someone asked what you like to do, how would you answer?",
    "How would you tell a friend about your hobby?",
    "What would you say if someone asked what you enjoy on weekends?",
  ],
  wrapupTemplates: [
    "You clearly talked about {hobby} and {detail}. That helps when telling people what you enjoy.",
    "You practiced describing an activity that matters to you. That's real conversation.",
    "You built a stronger sentence about your hobby today. That's useful in everyday social talk.",
  ],
};

// ─── Registry ────────────────────────────────────────────────

export const CLINICAL_PLAYBOOKS: Record<string, ClinicalPlaybook> = {
  food: FOOD_PLAYBOOK,
  family: FAMILY_PLAYBOOK,
  daily_routine: DAILY_ROUTINE_PLAYBOOK,
  hobbies: HOBBIES_PLAYBOOK,
};

/** Get playbook for a topic, or undefined if none exists */
export function getPlaybook(topicId: string): ClinicalPlaybook | undefined {
  return CLINICAL_PLAYBOOKS[topicId];
}

/** Get all topic IDs that have playbooks */
export function getPlaybookTopicIds(): string[] {
  return Object.keys(CLINICAL_PLAYBOOKS);
}
