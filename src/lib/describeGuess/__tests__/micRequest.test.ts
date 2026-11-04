import { describe, expect, it } from 'vitest';
import { isCurrentDescribeGuessMicRequest } from '../micRequest';

const request = { trialId: 'item-1', cycle: 4 };
const eligibleState = { trialId: 'item-1', cycle: 4, hasFeedback: false, isTyping: false };

describe('Describe & Guess delayed microphone handoff', () => {
  it('allows the current waiting trial to arm a microphone', () => {
    expect(isCurrentDescribeGuessMicRequest(request, eligibleState)).toBe(true);
  });

  it('rejects a previous trial even if its TTS finishes after advancing', () => {
    expect(isCurrentDescribeGuessMicRequest(request, { ...eligibleState, trialId: 'item-2' })).toBe(false);
  });

  it('rejects obsolete restart cycles and prevents reopening after skip', () => {
    expect(isCurrentDescribeGuessMicRequest(request, { ...eligibleState, cycle: 5 })).toBe(false);
  });

  it('never opens during feedback or after opting into typing', () => {
    expect(isCurrentDescribeGuessMicRequest(request, { ...eligibleState, hasFeedback: true })).toBe(false);
    expect(isCurrentDescribeGuessMicRequest(request, { ...eligibleState, isTyping: true })).toBe(false);
  });
});
