import { describe, expect, it } from 'vitest';
import {
  afterPartnerPatientTurn, completedPartnerSessionMetrics,
  type ConversationPartnerMetrics,
} from '@/lib/conversationPartnerMetrics';

const prior: ConversationPartnerMetrics = {
  totalUserWords: 4,
  totalAIWords: 7,
  avgLatencyMs: 1000,
  turnsCompleted: 2,
  nudgesGiven: 1,
  completionRate: 50,
};

describe('Conversation Partner reporting — no fabricated talk time', () => {
  it('includes the FINAL user turn in word total, latency, completed turns and response percentage', () => {
    const actual = afterPartnerPatientTurn(prior, {
      words: 2, turnNumber: 3,
      measuredLatencies: [1000, 500, 2500],
      repliesWithTwoWords: 2,
    });
    expect(actual).toEqual({
      totalUserWords: 6,
      totalAIWords: 7,
      turnsCompleted: 3,
      nudgesGiven: 1,
      avgLatencyMs: 4000 / 3,
      completionRate: (2 / 3) * 100,
    });
  });

  it('counts the final spoken Maya follow-up and labels the resulting ratio as WORD ratio', () => {
    const after = afterPartnerPatientTurn(prior, {
      words: 2, turnNumber: 3,
      measuredLatencies: [1000, 500, 2500],
      repliesWithTwoWords: 2,
    });
    expect(completedPartnerSessionMetrics(after, 'Talk again soon')).toEqual({
      turnsCompleted: 3,
      avgLatencyMs: 4000 / 3,
      completionRate: (2 / 3) * 100,
      userAIRatio: 60, // 6 user words / (7 earlier + 3 final Maya words)
    });
  });

  it('does not claim 100% patient participation when Maya supplied zero words', () => {
    expect(completedPartnerSessionMetrics({ ...prior, totalAIWords: 0 }, '  ').userAIRatio).toBe(0);
  });
});
