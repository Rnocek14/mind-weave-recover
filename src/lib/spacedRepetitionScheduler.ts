/**
 * Word-Level Spaced Repetition Scheduler
 * 
 * Leitner-style 3-box system that schedules re-exposure of failed words.
 * Built on top of useStrugglingWords data — no new DB tables needed.
 * 
 * Box 1 (failed): re-expose next session
 * Box 2 (succeeded once): re-expose in 2 days
 * Box 3 (succeeded twice): re-expose in 5 days
 */

import type { StrugglingWord } from '@/hooks/useStrugglingWords';

export interface ScheduledWord {
  word: string;
  category: string;
  box: 1 | 2 | 3;
  dueDate: string; // ISO date string (YYYY-MM-DD)
  priority: number; // Higher = more urgent
  errorSeverity: number;
  primaryErrorType: string;
}

interface BoxAssignment {
  box: 1 | 2 | 3;
  intervalDays: number;
}

/**
 * Assign a word to a Leitner box based on its error rate and practice history
 */
function assignBox(word: StrugglingWord): BoxAssignment {
  // High error rate (≥0.7) or not practiced in 5+ days → Box 1 (next session)
  if (word.errorRate >= 0.7 || word.daysSinceLastPractice >= 5) {
    return { box: 1, intervalDays: 0 };
  }
  
  // Moderate error rate (0.5-0.7) → Box 2 (2 day interval)
  if (word.errorRate >= 0.5) {
    return { box: 2, intervalDays: 2 };
  }
  
  // Lower error rate (0.4-0.5) → Box 3 (5 day interval)
  return { box: 3, intervalDays: 5 };
}

/**
 * Compute due date based on last practice and box interval
 */
function computeDueDate(lastAttempted: string, intervalDays: number): string {
  const date = new Date(lastAttempted);
  date.setDate(date.getDate() + intervalDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Compute priority score for a word (higher = more urgent to practice)
 * Factors: error severity, recency gap, functional importance (category)
 */
function computePriority(word: StrugglingWord, box: 1 | 2 | 3): number {
  let priority = 0;
  
  // Error rate contribution (0-40 points)
  priority += word.errorRate * 40;
  
  // Recency gap contribution (0-30 points) — words not practiced recently get boosted
  priority += Math.min(word.daysSinceLastPractice * 3, 30);
  
  // Box urgency (Box 1 = +20, Box 2 = +10, Box 3 = +5)
  priority += box === 1 ? 20 : box === 2 ? 10 : 5;
  
  // Functional importance by category (common/high-frequency words matter more)
  const categoryBoost: Record<string, number> = {
    'people': 10,
    'actions': 8,
    'food': 7,
    'body': 7,
    'places': 6,
    'objects': 5,
    'animals': 4,
  };
  priority += categoryBoost[word.category?.toLowerCase()] ?? 3;
  
  return Math.round(priority);
}

/**
 * Get words scheduled for practice today
 * 
 * @param strugglingWords - Words from useStrugglingWords
 * @param todayDate - Today's date in YYYY-MM-DD format
 * @param maxWords - Maximum words to return (default: 5)
 * @returns Words due for practice today, sorted by priority
 */
export function getScheduledWords(
  strugglingWords: StrugglingWord[],
  todayDate: string,
  maxWords: number = 5
): ScheduledWord[] {
  if (strugglingWords.length === 0) return [];
  
  const scheduled: ScheduledWord[] = [];
  
  for (const word of strugglingWords) {
    const { box, intervalDays } = assignBox(word);
    const dueDate = computeDueDate(word.lastAttempted, intervalDays);
    
    // Include if due today or overdue
    if (dueDate <= todayDate) {
      scheduled.push({
        word: word.word,
        category: word.category,
        box,
        dueDate,
        priority: computePriority(word, box),
        errorSeverity: word.errorRate,
        primaryErrorType: word.primaryErrorType,
      });
    }
  }
  
  // Sort by priority descending
  scheduled.sort((a, b) => b.priority - a.priority);
  
  return scheduled.slice(0, maxWords);
}

/**
 * Get all words with their box assignments (for display/debugging)
 */
export function getWordBoxAssignments(
  strugglingWords: StrugglingWord[]
): ScheduledWord[] {
  return strugglingWords.map(word => {
    const { box, intervalDays } = assignBox(word);
    return {
      word: word.word,
      category: word.category,
      box,
      dueDate: computeDueDate(word.lastAttempted, intervalDays),
      priority: computePriority(word, box),
      errorSeverity: word.errorRate,
      primaryErrorType: word.primaryErrorType,
    };
  }).sort((a, b) => b.priority - a.priority);
}
