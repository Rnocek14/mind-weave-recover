import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionSummaryStrip } from '../SessionSummaryStrip';

afterEach(cleanup);

const baseProps = {
  startedAt: '2026-10-30T14:00:00Z',
  durationSec: 180,
  gamesPlayed: 2,
  highestLevel: 4,
  validityBuckets: { valid: 0, filler: 1, silence: 1, noise: 0, flagged: 1 },
};

describe('SessionSummaryStrip: clear clinical evidence on every viewport', () => {
  it('shows unavailable rates and transparent denominators instead of false failure', () => {
    const { container } = render(
      <SessionSummaryStrip {...baseProps}
        accuracyPct={null} cueDependencyPct={null} attemptedCount={3} eligibleCount={0} />
    );
    const region = screen.getByRole('region', { name: 'Session measurements' });
    expect(within(region).getByText('Correct answers')).toBeInTheDocument();
    expect(within(region).getByText('Responses with cues')).toBeInTheDocument();
    expect(within(region).getAllByText('—')).toHaveLength(2);
    expect(within(region).queryByText('0%')).not.toBeInTheDocument();
    expect(within(region).getByText(/3 responses were not scored/)).toBeInTheDocument();
    expect(within(region).getByText(/An unscored response is not a wrong answer/)).toBeInTheDocument();
    expect(container.querySelector('.grid')).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-6');
  });

  it('shows measured zero with eligible count, not false missing data', () => {
    render(
      <SessionSummaryStrip {...baseProps} accuracyPct={0} cueDependencyPct={0}
        attemptedCount={2} eligibleCount={2} />
    );
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText(/2 of 2/)).toBeInTheDocument();
    expect(screen.queryByText('Not enough scored data')).not.toBeInTheDocument();
  });

  it('does not describe highest task difficulty as a clinical recovery level', () => {
    render(
      <SessionSummaryStrip {...baseProps} accuracyPct={50} cueDependencyPct={50}
        attemptedCount={2} eligibleCount={2} />
    );
    expect(screen.getByText('Highest task difficulty')).toBeInTheDocument();
    expect(screen.getByText('Not a clinical recovery level')).toBeInTheDocument();
    expect(screen.queryByText('Highest level')).not.toBeInTheDocument();
  });
});
