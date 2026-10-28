import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PronunciationAnalyticsDashboard } from './PronunciationAnalyticsDashboard';

vi.mock('@/hooks/usePronunciationAnalytics', () => ({ usePronunciationAnalytics: () => ({
  isLoading: false, error: null, data: {
    timeSeries: [{ date: '2026-10-28', speechRate: null, pauseFrequency: null, avgPauseDuration: null, confidence: 0, trialCount: 1 }],
    overallStats: {
      avgSpeechRate: null, avgPauseFrequency: null, avgConfidence: 0,
      totalTrials: 1, avgPronunciationScore: null, avgAccuracyScore: null,
      avgFluencyScore: null, hasAzureData: false,
      improvementTrend: { speechRate: null, confidence: null, pauseFrequency: null, pronunciationScore: null },
    },
  },
}) }));
vi.mock('recharts', async importOriginal => ({
  ...(await importOriginal<typeof import('recharts')>()),
  // Chart layout needs a physical viewport; the actual summary rendering is under test.
  ResponsiveContainer: () => null,
}));
afterEach(cleanup);

describe('speech analytics unavailable measurements', () => {
  it('shows unknown rates as unavailable, retains observed zero confidence and uses a provider-neutral label', () => {
    render(<PronunciationAnalyticsDashboard userId="synthetic-user" />);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('0%')).toBeVisible();
    expect(screen.queryByText('0 WPM')).not.toBeInTheDocument();
    expect(screen.getByText('Recognition Confidence Trend')).toBeVisible();
    expect(screen.queryByText(/Whisper AI/)).not.toBeInTheDocument();
  });
});
