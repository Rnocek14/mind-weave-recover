import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpeechAnalysisCard } from './SpeechAnalysisCard';

afterEach(cleanup);

describe('Speech Analysis metric display', () => {
  it('shows zero as a measured score and uses the correct 0–1 and 0–100 scales', () => {
    render(<SpeechAnalysisCard mode="clinician" snapshot={{
      phonologicalSimilarity: 0.75, pronunciationScore: 82,
      accuracyScore: 0, fluencyScore: 47,
    }} />);
    for (const value of ['75%', '82%', '0%', '47%']) expect(screen.getByText(value)).toBeVisible();
    expect(screen.queryByText('8200%')).not.toBeInTheDocument();
    expect(screen.queryByText('Prosody')).not.toBeInTheDocument();
  });

  it.each([NaN, Infinity, -1, 101])('does not display invalid provider score %s as a measurement', value => {
    render(<SpeechAnalysisCard mode="clinician" snapshot={{ pronunciationScore: value }} />);
    expect(screen.queryByText('Pronunciation')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN%|Infinity%|-1%|101%/)).not.toBeInTheDocument();
  });

  it('keeps unavailable metrics absent and numeric detail out of patient mode', () => {
    const { rerender } = render(<SpeechAnalysisCard mode="clinician" snapshot={{}} />);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    rerender(<SpeechAnalysisCard mode="patient" snapshot={{ accuracyScore: 50 }} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.queryByText('Raw Scores')).not.toBeInTheDocument();
  });
});
