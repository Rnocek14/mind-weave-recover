/**
 * A delayed TTS/microphone handoff belongs to exactly one Describe & Guess
 * trial. Never let an old async continuation arm the next patient's item.
 */
export interface DescribeGuessMicRequest {
  trialId: string;
  cycle: number;
}

export interface DescribeGuessMicState {
  trialId?: string;
  cycle: number;
  hasFeedback: boolean;
  isTyping: boolean;
}

export function isCurrentDescribeGuessMicRequest(
  request: DescribeGuessMicRequest,
  state: DescribeGuessMicState,
): boolean {
  return (
    request.trialId === state.trialId &&
    request.cycle === state.cycle &&
    !state.hasFeedback &&
    !state.isTyping
  );
}
