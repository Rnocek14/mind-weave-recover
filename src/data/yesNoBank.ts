/**
 * Yes/No Question Bank
 * 
 * Simple yes/no questions for the easiest level of interaction
 * in the Conversation Coach. Used when user can't initiate speech at all.
 */

export interface YesNoQuestion {
  id: string;
  question: string;
  category: 'routine' | 'preference' | 'simple_fact';
}

export const YES_NO_QUESTIONS: YesNoQuestion[] = [
  // Daily routines
  { id: 'yn-1', question: 'Did you sleep well last night?', category: 'routine' },
  { id: 'yn-2', question: 'Did you have coffee today?', category: 'routine' },
  { id: 'yn-3', question: 'Did you eat breakfast?', category: 'routine' },
  { id: 'yn-4', question: 'Did you go outside today?', category: 'routine' },
  { id: 'yn-5', question: 'Did you watch TV yesterday?', category: 'routine' },
  { id: 'yn-6', question: 'Did you talk to anyone today?', category: 'routine' },
  
  // Preferences
  { id: 'yn-7', question: 'Do you like coffee?', category: 'preference' },
  { id: 'yn-8', question: 'Do you like music?', category: 'preference' },
  { id: 'yn-9', question: 'Do you like sunny days?', category: 'preference' },
  { id: 'yn-10', question: 'Do you like dogs?', category: 'preference' },
  { id: 'yn-11', question: 'Do you like ice cream?', category: 'preference' },
  { id: 'yn-12', question: 'Do you like flowers?', category: 'preference' },
  
  // Simple facts
  { id: 'yn-13', question: 'Is it morning right now?', category: 'simple_fact' },
  { id: 'yn-14', question: 'Are you sitting down?', category: 'simple_fact' },
  { id: 'yn-15', question: 'Is it cold outside today?', category: 'simple_fact' },
  { id: 'yn-16', question: 'Are you at home?', category: 'simple_fact' },
  { id: 'yn-17', question: 'Is someone else in the room?', category: 'simple_fact' },
  { id: 'yn-18', question: 'Are you feeling okay?', category: 'simple_fact' },
  { id: 'yn-19', question: 'Is the TV on?', category: 'simple_fact' },
  { id: 'yn-20', question: 'Do you have water nearby?', category: 'simple_fact' },
];

/**
 * Get a random yes/no question
 */
export function getRandomYesNoQuestion(exclude?: string[]): YesNoQuestion {
  const available = YES_NO_QUESTIONS.filter(q => !exclude?.includes(q.id));
  const pool = available.length > 0 ? available : YES_NO_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}
