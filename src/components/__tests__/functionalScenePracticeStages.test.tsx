import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FunctionalScenePlayer } from '@/components/FunctionalScenePlayer';

const speakMock = vi.fn(async (_s: string) => {});
vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({ speak: speakMock, isLoading: false, error: null }),
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    startListening: vi.fn(), stopListening: vi.fn(), isSupported: false,
  }),
}));
afterEach(() => { cleanup(); speakMock.mockClear(); });

describe('FunctionalScenePlayer — actual stage-specific playthroughs', () => {
  it('stage 1 offers one modeled command, not the full scene choices', () => {
    const applied = vi.fn();
    render(<FunctionalScenePlayer practiceLevel={1} onCommandApplied={applied} />);
    expect(screen.getByText(/Scene practice 1\/8/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^brighter$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^darker$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^brighter$/i }));
    expect(screen.getByText(/Goal practiced/)).toBeTruthy();
    expect(applied).toHaveBeenCalledWith(expect.objectContaining({
      practiceStage: 1, inputMode: 'tap', supportShown: true, goalReached: true,
    }));
  });
  it('stage 4 requires intentional support reveal instead of showing the answer', () => {
    const applied = vi.fn();
    render(<FunctionalScenePlayer practiceLevel={4} onCommandApplied={applied} />);
    expect(screen.queryByRole('button', { name: /^brighter$/i })).toBeNull();
    expect(screen.getByText(/Help someone read/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Need help\? Show words/i }));
    fireEvent.click(screen.getByRole('button', { name: /^brighter$/i }));
    expect(screen.getByText(/Goal practiced/)).toBeTruthy();
    expect(applied).toHaveBeenCalledWith(expect.objectContaining({
      inputMode: 'tap', supportShown: true, goalReached: true, practiceStage: 4,
    }));
  });
  it('stage 6 requires two actual opposite scene actions to finish', () => {
    render(<FunctionalScenePlayer practiceLevel={6} />);
    expect(screen.getByText(/Step 1 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Need help\? Show words/i }));
    fireEvent.click(screen.getByRole('button', { name: /^brighter$/i }));
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
    expect(screen.queryByText(/Goal practiced/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Need help\? Show words/i }));
    fireEvent.click(screen.getByRole('button', { name: /^darker$/i }));
    expect(screen.getByText(/Goal practiced/)).toBeTruthy();
  });
  it('stage 8 changes to another real scene with a different goal after step 1', () => {
    const applied = vi.fn();
    const changed = vi.fn();
    render(<FunctionalScenePlayer practiceLevel={8} onCommandApplied={applied} onSceneChange={changed} />);
    expect(screen.getByText(/Step 1 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Need help\? Show words/i }));
    fireEvent.click(screen.getByRole('button', { name: /^brighter$/i }));
    expect(screen.getByText('The Ball')).toBeTruthy();
    expect(changed).toHaveBeenCalledWith('ball');
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Need help\? Show words/i }));
    fireEvent.click(screen.getByRole('button', { name: /^bigger$/i }));
    expect(screen.getByText(/Goal practiced/)).toBeTruthy();
    expect(applied).toHaveBeenCalledTimes(2);
  });
});
