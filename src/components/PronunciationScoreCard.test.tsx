import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PronunciationScoreCard } from './PronunciationScoreCard';

vi.mock('@/hooks/usePronunciationScoreAnalytics', () => ({ usePronunciationScoreAnalytics: () => ({
  loading: false, error: null, analytics: {
    overallScore: 50, accuracyScore: 60, fluencyScore: 0, completenessScore: 100,
    prosodyScore: null, sampleCount: 5, hardestPhonemes: [], strongestPhonemes: [],
    needsPracticeWords: [], bestWords: [], weeklyTrend: [], weekOverWeekChange: null,
  },
}) }));
vi.mock('./AudioPlayback', () => ({ AudioPlayback: () => null }));
afterEach(cleanup);

describe('persisted pronunciation metric display', () => {
  it('displays a measured zero and unavailable optional score differently', () => {
    render(<PronunciationScoreCard userId="synthetic-user" />);
    expect(screen.getByText('50%')).toBeVisible();
    const fluency = screen.getByText('Fluency').parentElement!;
    expect(within(fluency).getByText('0%')).toBeVisible();
    const prosody = screen.getByText('Prosody').parentElement!;
    expect(within(prosody).getByText('—')).toBeVisible();
    expect(within(prosody).queryByText('0%')).not.toBeInTheDocument();
  });
});
