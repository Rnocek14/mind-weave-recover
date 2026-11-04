import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DescribeGuessPromptGuide } from '../DescribeGuessPromptGuide';
import type { FeatureType } from '@/data/describeGuessBank';

const emptyFeatures = new Set<FeatureType>();

describe('Describe & Guess patient question guide', () => {
  it('shows the three complete strategy questions immediately, without timers or tapping for visibility', () => {
    const onRequest = vi.fn();
    render(<DescribeGuessPromptGuide activeFeature="function" spokenFeatures={emptyFeatures} onRequest={onRequest} />);
    expect(screen.getByRole('button', { name: /what do you use it for/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /what does it look like/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /what's it made of/i })).toBeVisible();
    expect(screen.getByText('You use it to...')).toBeVisible();
    expect(screen.getByRole('button', { name: /what do you use it for/i })).toHaveAttribute('aria-pressed', 'true');
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('opens the optional questions without removing the three main prompts', () => {
    render(<DescribeGuessPromptGuide activeFeature="function" spokenFeatures={emptyFeatures} onRequest={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /where would you find it/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /more questions/i }));
    expect(screen.getByRole('button', { name: /where would you find it/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /what kind of thing is it/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /what's it made of/i })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /fewer questions/i }));
    expect(screen.queryByRole('button', { name: /where would you find it/i })).not.toBeInTheDocument();
  });

  it('tapping a prompt explicitly requests one spoken cue', () => {
    const onRequest = vi.fn();
    render(<DescribeGuessPromptGuide activeFeature="appearance" spokenFeatures={emptyFeatures} onRequest={onRequest} />);
    const button = screen.getByRole('button', { name: /what does it look like/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ featureType: 'appearance' }));
  });

  it('checkmarks reflect only actually spoken dimensions, not a displayed or selected prompt', () => {
    const spoken = new Set<FeatureType>(['appearance']);
    render(<DescribeGuessPromptGuide activeFeature="function" spokenFeatures={spoken} onRequest={vi.fn()} />);
    expect(within(screen.getByRole('button', { name: /what does it look like/i })).getByText('Already described')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /what do you use it for/i })).queryByText('Already described')).not.toBeInTheDocument();
  });
});
