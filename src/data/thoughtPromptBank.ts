/**
 * Thought Prompt Bank
 * 
 * These prompts follow the "easy retrieval" formula:
 * Time anchor + Scale limiter + Intent
 * 
 * Key principles:
 * - Never ask for a specific word
 * - Always narrow the memory search space
 * - Use "last", "small", "today" to constrain
 * - Emotion/story/intent oriented, not noun retrieval
 */

import type { ThoughtPrompt, IntentType, PromptTheme, NarrowingStep } from '@/types/thoughtContinuation';

// =============================================================================
// Prompt Templates
// =============================================================================

interface PromptTemplate {
  intentType: IntentType;
  theme: PromptTheme;
  promptText: string;
  narrowingSteps: NarrowingStep[];
  difficultyTier: 1 | 2 | 3;
  timeAnchor?: 'last' | 'recent' | 'today' | 'yesterday' | 'this_week';
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ==========================================================================
  // DAILY ROUTINE - Tier 1 (Easiest)
  // ==========================================================================
  {
    intentType: 'recall_recent',
    theme: 'daily_routine',
    promptText: "Talk about the last thing you ate.",
    narrowingSteps: [
      { level: 1, text: "Was it a meal or a snack?" },
      { level: 2, text: "Was it hot or cold?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'recall_recent',
    theme: 'daily_routine',
    promptText: "Talk about the first thing you did this morning.",
    narrowingSteps: [
      { level: 1, text: "Did you get up right away or rest a bit?" },
      { level: 2, text: "Did you go to the kitchen or bathroom first?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'today',
  },
  {
    intentType: 'describe_event',
    theme: 'daily_routine',
    promptText: "Talk about something you did yesterday.",
    narrowingSteps: [
      { level: 1, text: "Was it in the morning, afternoon, or evening?" },
      { level: 2, text: "Were you inside or outside?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'yesterday',
  },
  {
    intentType: 'recall_recent',
    theme: 'daily_routine',
    promptText: "Talk about the last time you went outside.",
    narrowingSteps: [
      { level: 1, text: "Was the weather nice or not?" },
      { level: 2, text: "Did you walk or drive?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'describe_event',
    theme: 'daily_routine',
    promptText: "Talk about something you watched recently.",
    narrowingSteps: [
      { level: 1, text: "Was it on TV, a phone, or something else?" },
      { level: 2, text: "Was it a show, news, or sports?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'recent',
  },

  // ==========================================================================
  // HOME - Tier 1
  // ==========================================================================
  {
    intentType: 'recall_recent',
    theme: 'home',
    promptText: "Talk about the last thing you couldn't find at home.",
    narrowingSteps: [
      { level: 1, text: "Was it something small like keys or glasses?" },
      { level: 2, text: "Did you find it eventually?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'describe_event',
    theme: 'home',
    promptText: "Talk about something you fixed or adjusted at home recently.",
    narrowingSteps: [
      { level: 1, text: "Was it something that broke, or just needed adjusting?" },
      { level: 2, text: "Did you need any tools?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'recent',
  },
  {
    intentType: 'explain_reason',
    theme: 'home',
    promptText: "Talk about a room you spend the most time in.",
    narrowingSteps: [
      { level: 1, text: "Is it where you relax or do activities?" },
      { level: 2, text: "What do you usually do there?" },
    ],
    difficultyTier: 1,
  },
  {
    intentType: 'describe_event',
    theme: 'home',
    promptText: "Talk about a small chore you did today or yesterday.",
    narrowingSteps: [
      { level: 1, text: "Was it cleaning, organizing, or something else?" },
      { level: 2, text: "Did it take a long time?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'today',
  },

  // ==========================================================================
  // FOOD - Tier 1
  // ==========================================================================
  {
    intentType: 'express_opinion',
    theme: 'food',
    promptText: "Talk about a food you don't like.",
    narrowingSteps: [
      { level: 1, text: "Is it the taste, texture, or smell?" },
      { level: 2, text: "Have you always disliked it?" },
    ],
    difficultyTier: 1,
  },
  {
    intentType: 'recall_recent',
    theme: 'food',
    promptText: "Talk about the last thing you drank.",
    narrowingSteps: [
      { level: 1, text: "Was it hot or cold?" },
      { level: 2, text: "Was it water, coffee, or something else?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'describe_event',
    theme: 'food',
    promptText: "Talk about a meal you had this week.",
    narrowingSteps: [
      { level: 1, text: "Was it breakfast, lunch, or dinner?" },
      { level: 2, text: "Did you make it yourself?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'this_week',
  },
  {
    intentType: 'express_opinion',
    theme: 'food',
    promptText: "Talk about your favorite thing to eat for breakfast.",
    narrowingSteps: [
      { level: 1, text: "Is it sweet or savory?" },
      { level: 2, text: "Do you have it often?" },
    ],
    difficultyTier: 1,
  },

  // ==========================================================================
  // PREFERENCES - Tier 1
  // ==========================================================================
  {
    intentType: 'express_opinion',
    theme: 'preferences',
    promptText: "Talk about something you enjoy doing in the morning.",
    narrowingSteps: [
      { level: 1, text: "Is it something active or relaxing?" },
      { level: 2, text: "Do you do it every day?" },
    ],
    difficultyTier: 1,
  },
  {
    intentType: 'express_opinion',
    theme: 'preferences',
    promptText: "Talk about a TV show or movie you like.",
    narrowingSteps: [
      { level: 1, text: "Is it funny, serious, or exciting?" },
      { level: 2, text: "Have you watched it more than once?" },
    ],
    difficultyTier: 1,
  },
  {
    intentType: 'explain_reason',
    theme: 'preferences',
    promptText: "Talk about why you like or don't like mornings.",
    narrowingSteps: [
      { level: 1, text: "Is it about sleep, or what you do?" },
      { level: 2, text: "Has it always been this way?" },
    ],
    difficultyTier: 1,
  },

  // ==========================================================================
  // WEATHER - Tier 1
  // ==========================================================================
  {
    intentType: 'describe_event',
    theme: 'weather',
    promptText: "Talk about the weather today.",
    narrowingSteps: [
      { level: 1, text: "Is it warm, cold, or in between?" },
      { level: 2, text: "Is it sunny, cloudy, or rainy?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'today',
  },
  {
    intentType: 'express_opinion',
    theme: 'weather',
    promptText: "Talk about your favorite kind of weather.",
    narrowingSteps: [
      { level: 1, text: "Do you prefer warm or cool?" },
      { level: 2, text: "Do you like sun or clouds better?" },
    ],
    difficultyTier: 1,
  },
  {
    intentType: 'recall_recent',
    theme: 'weather',
    promptText: "Talk about the last time the weather surprised you.",
    narrowingSteps: [
      { level: 1, text: "Was it unexpectedly hot, cold, or rainy?" },
      { level: 2, text: "Did it change your plans?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },

  // ==========================================================================
  // SMALL PROBLEMS - Tier 2 (Creates natural narrative)
  // ==========================================================================
  {
    intentType: 'describe_event',
    theme: 'daily_routine',
    promptText: "Talk about a small problem you had today.",
    narrowingSteps: [
      { level: 1, text: "Was it at home or somewhere else?" },
      { level: 2, text: "Did you solve it?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'today',
  },
  {
    intentType: 'describe_event',
    theme: 'daily_routine',
    promptText: "Talk about something that took longer than expected.",
    narrowingSteps: [
      { level: 1, text: "Was it a task, errand, or waiting?" },
      { level: 2, text: "Did it frustrate you?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'recent',
  },
  {
    intentType: 'explain_reason',
    theme: 'daily_routine',
    promptText: "Talk about something you almost forgot to do.",
    narrowingSteps: [
      { level: 1, text: "Was it something important or routine?" },
      { level: 2, text: "What reminded you?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'recent',
  },
  {
    intentType: 'describe_event',
    theme: 'home',
    promptText: "Talk about something at home that doesn't work right.",
    narrowingSteps: [
      { level: 1, text: "Is it something you use often?" },
      { level: 2, text: "Is it annoying or just a small issue?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'describe_event',
    theme: 'daily_routine',
    promptText: "Talk about a time you had to wait for something.",
    narrowingSteps: [
      { level: 1, text: "Was it at home, at a store, or somewhere else?" },
      { level: 2, text: "Was it a long or short wait?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'recent',
  },

  // ==========================================================================
  // EXPLAIN REASONS - Tier 2
  // ==========================================================================
  {
    intentType: 'explain_reason',
    theme: 'preferences',
    promptText: "Talk about why you stopped doing something.",
    narrowingSteps: [
      { level: 1, text: "Was it a hobby, habit, or routine?" },
      { level: 2, text: "Did something change, or did you just lose interest?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'explain_reason',
    theme: 'preferences',
    promptText: "Talk about why you changed your mind about something.",
    narrowingSteps: [
      { level: 1, text: "Was it a big decision or small?" },
      { level: 2, text: "Did someone help you decide?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'explain_reason',
    theme: 'daily_routine',
    promptText: "Talk about why something annoyed you recently.",
    narrowingSteps: [
      { level: 1, text: "Was it something a person did, or a situation?" },
      { level: 2, text: "Did it get resolved?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'recent',
  },

  // ==========================================================================
  // FEELINGS - Tier 2
  // ==========================================================================
  {
    intentType: 'describe_feeling',
    theme: 'daily_routine',
    promptText: "Talk about how you feel right now.",
    narrowingSteps: [
      { level: 1, text: "Are you tired, alert, or somewhere in between?" },
      { level: 2, text: "Is it a typical feeling for this time of day?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'today',
  },
  {
    intentType: 'describe_feeling',
    theme: 'daily_routine',
    promptText: "Talk about something that made you smile recently.",
    narrowingSteps: [
      { level: 1, text: "Was it something someone said or did?" },
      { level: 2, text: "Was it funny or just nice?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'recent',
  },
  {
    intentType: 'describe_feeling',
    theme: 'preferences',
    promptText: "Talk about something that relaxes you.",
    narrowingSteps: [
      { level: 1, text: "Is it something you do alone or with others?" },
      { level: 2, text: "Do you do it often?" },
    ],
    difficultyTier: 2,
  },

  // ==========================================================================
  // FAMILY - Tier 2
  // ==========================================================================
  {
    intentType: 'describe_event',
    theme: 'family',
    promptText: "Talk about the last time you talked to a family member.",
    narrowingSteps: [
      { level: 1, text: "Was it in person, on the phone, or by text?" },
      { level: 2, text: "What did you talk about?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'last',
  },
  {
    intentType: 'describe_event',
    theme: 'family',
    promptText: "Talk about something a family member did recently.",
    narrowingSteps: [
      { level: 1, text: "Was it something helpful, funny, or surprising?" },
      { level: 2, text: "Did it affect you?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'recent',
  },

  // ==========================================================================
  // HOBBIES - Tier 2
  // ==========================================================================
  {
    intentType: 'describe_event',
    theme: 'hobbies',
    promptText: "Talk about something you enjoy doing when you have free time.",
    narrowingSteps: [
      { level: 1, text: "Is it active or relaxing?" },
      { level: 2, text: "Do you do it alone or with others?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'recall_recent',
    theme: 'hobbies',
    promptText: "Talk about the last time you did something for fun.",
    narrowingSteps: [
      { level: 1, text: "Was it something you planned or spontaneous?" },
      { level: 2, text: "Did you enjoy it?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'last',
  },

  // ==========================================================================
  // HEALTH - Tier 2
  // ==========================================================================
  {
    intentType: 'describe_event',
    theme: 'health',
    promptText: "Talk about how you slept last night.",
    narrowingSteps: [
      { level: 1, text: "Did you sleep well or not?" },
      { level: 2, text: "Did you wake up during the night?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'yesterday',
  },
  {
    intentType: 'describe_feeling',
    theme: 'health',
    promptText: "Talk about how your energy is today.",
    narrowingSteps: [
      { level: 1, text: "Do you feel rested or tired?" },
      { level: 2, text: "Is it better or worse than usual?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'today',
  },

  // ==========================================================================
  // MEMORIES - Tier 3 (Broader, requires more search)
  // ==========================================================================
  {
    intentType: 'recall_recent',
    theme: 'memories',
    promptText: "Talk about a place you used to go to.",
    narrowingSteps: [
      { level: 1, text: "Was it a store, restaurant, or somewhere else?" },
      { level: 2, text: "What did you like about it?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'describe_event',
    theme: 'memories',
    promptText: "Talk about something you learned to do.",
    narrowingSteps: [
      { level: 1, text: "Was it for work, home, or fun?" },
      { level: 2, text: "Was it hard to learn?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'describe_event',
    theme: 'travel',
    promptText: "Talk about a trip you took.",
    narrowingSteps: [
      { level: 1, text: "Was it far or nearby?" },
      { level: 2, text: "Was it for fun or for a reason?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'describe_feeling',
    theme: 'memories',
    promptText: "Talk about something that surprised you.",
    narrowingSteps: [
      { level: 1, text: "Was it a good surprise or unexpected?" },
      { level: 2, text: "Did someone else cause it?" },
    ],
    difficultyTier: 3,
  },

  // ==========================================================================
  // COMPARE/CONTRAST - Tier 3
  // ==========================================================================
  {
    intentType: 'compare_contrast',
    theme: 'preferences',
    promptText: "Talk about the difference between now and before.",
    narrowingSteps: [
      { level: 1, text: "Is it about how you spend time, or how things work?" },
      { level: 2, text: "Is it better or worse now?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'compare_contrast',
    theme: 'daily_routine',
    promptText: "Talk about how your routine has changed.",
    narrowingSteps: [
      { level: 1, text: "Is it about mornings, evenings, or the whole day?" },
      { level: 2, text: "Was the change by choice or circumstance?" },
    ],
    difficultyTier: 3,
  },

  // ==========================================================================
  // SOLVE PROBLEM - Tier 3
  // ==========================================================================
  {
    intentType: 'solve_problem',
    theme: 'daily_routine',
    promptText: "Talk about how you would make something easier.",
    narrowingSteps: [
      { level: 1, text: "Is it a daily task or occasional thing?" },
      { level: 2, text: "Would it need help from someone?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'solve_problem',
    theme: 'home',
    promptText: "Talk about something at home you'd like to improve.",
    narrowingSteps: [
      { level: 1, text: "Is it about organization, comfort, or function?" },
      { level: 2, text: "Is it a big or small change?" },
    ],
    difficultyTier: 3,
  },
  // ==========================================================================
  // EXPLAIN_REASON / HYPOTHETICAL - Tier 3 (abstract, multi-step discourse)
  // ==========================================================================
  {
    intentType: 'explain_reason',
    theme: 'preferences',
    promptText: "Talk about why one thing matters more to you than another.",
    narrowingSteps: [
      { level: 1, text: "Is it about people, time, or comfort?" },
      { level: 2, text: "Has it always been this way for you?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'compare_contrast',
    theme: 'memories',
    promptText: "Talk about how a friendship has changed over time.",
    narrowingSteps: [
      { level: 1, text: "Is it closer or more distant now?" },
      { level: 2, text: "What caused the change?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'solve_problem',
    theme: 'health',
    promptText: "Talk about what you would tell someone starting recovery.",
    narrowingSteps: [
      { level: 1, text: "Is it about patience, effort, or hope?" },
      { level: 2, text: "What helped you the most?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'explain_reason',
    theme: 'family',
    promptText: "Talk about a tradition that means something to your family.",
    narrowingSteps: [
      { level: 1, text: "Is it tied to a season, holiday, or everyday life?" },
      { level: 2, text: "Why does it matter to the people involved?" },
    ],
    difficultyTier: 3,
  },

  // ==========================================================================
  // EXPANSION SET (launch content wave) — appended so existing index-based
  // prompt IDs stay stable. Same formula: time anchor + scale limiter +
  // intent; never asks for a specific word. Flagged for SLP review.
  // ==========================================================================

  // --- Tier 1 additions ---
  {
    intentType: 'recall_recent',
    theme: 'daily_routine',
    promptText: "Talk about the last thing you drank.",
    narrowingSteps: [
      { level: 1, text: "Was it hot or cold?" },
      { level: 2, text: "Did you have it with food?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'recall_recent',
    theme: 'home',
    promptText: "Talk about the last room you were in before this one.",
    narrowingSteps: [
      { level: 1, text: "Was it big or small?" },
      { level: 2, text: "What were you doing there?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'describe_event',
    theme: 'daily_routine',
    promptText: "Talk about what you watched or listened to today.",
    narrowingSteps: [
      { level: 1, text: "Was it on TV, radio, or a phone?" },
      { level: 2, text: "Was it something you've seen before?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'today',
  },
  {
    intentType: 'express_opinion',
    theme: 'food',
    promptText: "Talk about a food you would eat every day.",
    narrowingSteps: [
      { level: 1, text: "Is it sweet or savory?" },
      { level: 2, text: "When did you last have it?" },
    ],
    difficultyTier: 1,
  },
  {
    intentType: 'recall_recent',
    theme: 'family',
    promptText: "Talk about the last person you talked to.",
    narrowingSteps: [
      { level: 1, text: "Was it in person or on the phone?" },
      { level: 2, text: "Was it a short chat or a long one?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'last',
  },
  {
    intentType: 'describe_feeling',
    theme: 'weather',
    promptText: "Talk about how today's weather makes you feel.",
    narrowingSteps: [
      { level: 1, text: "Do you like this kind of day?" },
      { level: 2, text: "Does it change what you do?" },
    ],
    difficultyTier: 1,
    timeAnchor: 'today',
  },

  // --- Tier 2 additions ---
  {
    intentType: 'explain_reason',
    theme: 'preferences',
    promptText: "Talk about why you like your favorite chair or spot at home.",
    narrowingSteps: [
      { level: 1, text: "Is it about comfort or the view?" },
      { level: 2, text: "When do you sit there most?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'describe_event',
    theme: 'health',
    promptText: "Talk about something you did this week that felt good.",
    narrowingSteps: [
      { level: 1, text: "Was it moving your body, or resting?" },
      { level: 2, text: "Would you do it again tomorrow?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'this_week',
  },
  {
    intentType: 'solve_problem',
    theme: 'home',
    promptText: "Talk about what you would do if the power went out tonight.",
    narrowingSteps: [
      { level: 1, text: "What would you reach for first?" },
      { level: 2, text: "Who would you want with you?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'express_opinion',
    theme: 'preferences',
    promptText: "Talk about a sound you love and a sound you can't stand.",
    narrowingSteps: [
      { level: 1, text: "Start with the one you love." },
      { level: 2, text: "Where do you usually hear it?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'describe_event',
    theme: 'hobbies',
    promptText: "Talk about something you made with your hands.",
    narrowingSteps: [
      { level: 1, text: "Was it food, a repair, or a craft?" },
      { level: 2, text: "Did you keep it or give it away?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'explain_reason',
    theme: 'daily_routine',
    promptText: "Talk about why mornings or evenings suit you better.",
    narrowingSteps: [
      { level: 1, text: "Which one is yours?" },
      { level: 2, text: "What do you do best at that time?" },
    ],
    difficultyTier: 2,
  },
  {
    intentType: 'describe_feeling',
    theme: 'family',
    promptText: "Talk about a time someone helped you this week.",
    narrowingSteps: [
      { level: 1, text: "Was it a big favor or a small one?" },
      { level: 2, text: "How did you thank them?" },
    ],
    difficultyTier: 2,
    timeAnchor: 'this_week',
  },
  {
    intentType: 'solve_problem',
    theme: 'food',
    promptText: "Talk about what you'd cook for a guest coming tonight.",
    narrowingSteps: [
      { level: 1, text: "Something simple or something special?" },
      { level: 2, text: "What would you serve with it?" },
    ],
    difficultyTier: 2,
  },

  // --- Tier 3 additions ---
  {
    intentType: 'compare_contrast',
    theme: 'memories',
    promptText: "Talk about how your neighborhood has changed over the years.",
    narrowingSteps: [
      { level: 1, text: "What's one thing that's different?" },
      { level: 2, text: "Is the change good or bad, in your view?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'describe_event',
    theme: 'memories',
    promptText: "Talk about a piece of advice you never forgot.",
    narrowingSteps: [
      { level: 1, text: "Who gave it to you?" },
      { level: 2, text: "Have you passed it on to anyone?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'express_opinion',
    theme: 'preferences',
    promptText: "Talk about something people worry about too much.",
    narrowingSteps: [
      { level: 1, text: "Is it about money, time, or appearances?" },
      { level: 2, text: "What would you tell them instead?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'explain_reason',
    theme: 'hobbies',
    promptText: "Talk about why a hobby you had faded away.",
    narrowingSteps: [
      { level: 1, text: "Did life get busy, or did it stop being fun?" },
      { level: 2, text: "Would you pick it up again?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'describe_feeling',
    theme: 'memories',
    promptText: "Talk about a moment you felt proud of someone else.",
    narrowingSteps: [
      { level: 1, text: "Was it family, a friend, or a stranger?" },
      { level: 2, text: "Did you tell them how you felt?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'compare_contrast',
    theme: 'daily_routine',
    promptText: "Talk about the difference between a good day and a bad day for you.",
    narrowingSteps: [
      { level: 1, text: "How does a good day start?" },
      { level: 2, text: "What tips a day the wrong way?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'solve_problem',
    theme: 'family',
    promptText: "Talk about how you would cheer up someone having a hard week.",
    narrowingSteps: [
      { level: 1, text: "Would you visit, call, or send something?" },
      { level: 2, text: "What usually works with this person?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'describe_event',
    theme: 'travel',
    promptText: "Talk about a place you'd take a visitor who'd never been here.",
    narrowingSteps: [
      { level: 1, text: "Is it in town or a drive away?" },
      { level: 2, text: "What would you show them first?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'express_opinion',
    theme: 'memories',
    promptText: "Talk about an invention that changed your life the most.",
    narrowingSteps: [
      { level: 1, text: "Is it in your kitchen, pocket, or garage?" },
      { level: 2, text: "What did people do before it?" },
    ],
    difficultyTier: 3,
  },
  {
    intentType: 'compare_contrast',
    theme: 'food',
    promptText: "Talk about how cooking at home compares to eating out.",
    narrowingSteps: [
      { level: 1, text: "Which do you enjoy more?" },
      { level: 2, text: "When is the other one worth it?" },
    ],
    difficultyTier: 3,
  },
];

// =============================================================================
// Convert templates to prompts with IDs
// =============================================================================

export const THOUGHT_PROMPTS: ThoughtPrompt[] = PROMPT_TEMPLATES.map((template, index) => ({
  id: `prompt-${index + 1}`,
  intentType: template.intentType,
  theme: template.theme,
  promptText: template.promptText,
  narrowingSteps: template.narrowingSteps,
  difficultyTier: template.difficultyTier as 1 | 2 | 3,
  timeAnchor: template.timeAnchor,
  isActive: true,
}));

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map a discourse adaptation level (1..5) to the prompt content tier (1..3).
 *
 * `useDiscourseAdaptation` emits 1..5; the prompt bank is graded into 3 tiers
 * (Tier 1 = recall_recent / daily_routine, Tier 2 = describe_event / opinions,
 * Tier 3 = compare_contrast / solve_problem / explain_reason). This is the
 * SAME engine→tier contract used by FixSentence, DescribeGuess and
 * PhrasePractice. NEVER use a cumulative `<=` band — that causes silent tier
 * blending and breaks perceptual progression.
 */
export function mapDiscourseLevelToPromptTier(discourseLevel: number): 1 | 2 | 3 {
  if (!Number.isFinite(discourseLevel)) return 1;
  const lvl = Math.max(1, Math.min(5, Math.round(discourseLevel)));
  if (lvl <= 2) return 1;       // discourse 1-2 → tier 1 (concrete recall)
  if (lvl <= 4) return 2;       // discourse 3-4 → tier 2 (structured expansion)
  return 3;                     // discourse 5   → tier 3 (abstract / multi-step)
}

export function getPromptsByDifficulty(tier: 1 | 2 | 3): ThoughtPrompt[] {
  return THOUGHT_PROMPTS.filter(p => p.difficultyTier === tier && p.isActive);
}

export function getPromptsByTheme(theme: PromptTheme): ThoughtPrompt[] {
  return THOUGHT_PROMPTS.filter(p => p.theme === theme && p.isActive);
}

export function getPromptsByIntent(intent: IntentType): ThoughtPrompt[] {
  return THOUGHT_PROMPTS.filter(p => p.intentType === intent && p.isActive);
}

/**
 * Random prompt selection. The `tier` option enforces an EXACT tier band
 * (no cumulative blending). The legacy `maxDifficulty` option is now
 * interpreted as "exactly this tier" to preserve callers while removing the
 * old `<=` bug. Pass `tier` for new code.
 */
export function selectRandomPrompts(
  count: number,
  options?: {
    preferredThemes?: PromptTheme[];
    /** Exact content tier band (preferred, no blending). */
    tier?: 1 | 2 | 3;
    /** @deprecated use `tier`. Now treated as EXACT tier match, not `<=`. */
    maxDifficulty?: 1 | 2 | 3;
    excludeIds?: string[];
  }
): ThoughtPrompt[] {
  let pool = THOUGHT_PROMPTS.filter(p => p.isActive);

  const exactTier = options?.tier ?? options?.maxDifficulty;
  if (exactTier) {
    pool = pool.filter(p => p.difficultyTier === exactTier);
  }

  if (options?.preferredThemes && options.preferredThemes.length > 0) {
    const themed = pool.filter(p => options.preferredThemes!.includes(p.theme));
    if (themed.length >= count) {
      pool = themed;
    }
  }

  if (options?.excludeIds) {
    pool = pool.filter(p => !options.excludeIds!.includes(p.id));
  }

  // Shuffle and take
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// =============================================================================
// Nudge Messages (for silence/continuation)
// =============================================================================

export const NUDGE_MESSAGES = [
  "Go on...",
  "Keep going...",
  "What else?",
  "Tell me more...",
  "And then?",
];

export const STARTER_NUDGES = [
  "Take your time.",
  "Anything that comes to mind.",
  "Even a short answer is fine.",
];

export function getRandomNudge(): string {
  return NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
}

export function getRandomStarterNudge(): string {
  return STARTER_NUDGES[Math.floor(Math.random() * STARTER_NUDGES.length)];
}
