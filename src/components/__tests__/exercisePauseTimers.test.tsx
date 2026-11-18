import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryFluencyGame } from '@/components/CategoryFluencyGame';
import { RoundDoneAutoAdvance } from '@/components/RoundDoneAutoAdvance';
import { SessionPauseControl } from '@/components/SessionPauseControl';
import { CoachingModeProvider } from '@/contexts/CoachingModeContext';
import { voiceController } from '@/lib/voiceController';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: null }) }));
vi.mock('@/hooks/useTextToSpeech', () => ({ useTextToSpeech: () => ({ speak: vi.fn(), stop: vi.fn() }) }));
vi.mock('@/lib/voiceControllerStop', () => ({ stopAllVoice: vi.fn() }));

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const pause = () => fireEvent.click(screen.getByRole('button', { name: 'Pause session' }));
const resume = () => fireEvent.click(screen.getByRole('button', { name: /^Resume$/ }));
function mount(children: React.ReactNode) {
  return render(<MemoryRouter initialEntries={['/exercise/category-fluency']}>
    <CoachingModeProvider>{children}<SessionPauseControl /></CoachingModeProvider>
  </MemoryRouter>);
}
function startRound() {
  fireEvent.click(screen.getByRole('button', { name: /start when you're ready/i }));
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); voiceController.setSessionPaused(false); vi.useRealTimers(); });

describe('exercises while the global pause dialog is open', () => {
  it('holds the pre-round countdown and resumes from the same count', async () => {
    const completed = vi.fn();
    mount(<CategoryFluencyGame onRoundComplete={completed} />);
    startRound();
    await tick(800);
    expect(screen.getByText('2', { exact: true })).toBeVisible();
    pause();
    await tick(60000);
    expect(completed).not.toHaveBeenCalled();
    resume();
    expect(screen.getByText('2', { exact: true })).toBeVisible();
    await tick(1600);
    expect(screen.getByRole('button', { name: /done early/i })).toBeVisible();
  });

  it('keeps a timed round and its saved word-rate denominator on active practice time', async () => {
    const completed = vi.fn();
    mount(<CategoryFluencyGame onRoundComplete={completed} />);
    startRound();
    await tick(2400);
    await tick(2000);
    const remaining = screen.getByText(/^\d+s$/).textContent!;
    pause();
    await tick(90000);
    expect(completed).not.toHaveBeenCalled();
    resume();
    expect(screen.getByText(remaining)).toBeVisible();
    await tick(2000);
    fireEvent.click(screen.getByRole('button', { name: /done early/i }));
    expect(completed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ durationSec: 4 }));
  });

  it('reports requested examples and the actual difficulty change on the round that earned it', async () => {
    localStorage.clear();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const completed = vi.fn();
    const changed = vi.fn();
    try {
      mount(<CategoryFluencyGame difficulty={4} roundCount={4}
        onDifficultyChange={changed} onRoundComplete={completed} />);
      startRound();
      for (let i = 0; i < 4; i++) {
        await tick(3000);
        if (i === 0) fireEvent.click(screen.getByRole('button', { name: 'Show different examples' }));
        fireEvent.click(screen.getByRole('button', { name: /done early/i }));
        if (i < 3) fireEvent.click(screen.getByRole('button', { name: /try a different one|next round/i }));
      }
      expect(completed.mock.calls.map(([result]) => result.exampleRequests)).toEqual([1, 0, 0, 0]);
      expect(changed).toHaveBeenCalledWith(expect.any(Number), 'down');
      expect(completed.mock.calls.map(([result]) => result.difficultyChanged)).toContain('down');
    } finally { random.mockRestore(); }
  });

  it('preserves remaining feedback time across global and local holds and advances only once', async () => {
    const advance = vi.fn();
    mount(<RoundDoneAutoAdvance onAdvance={advance}>Round complete</RoundDoneAutoAdvance>);
    await tick(2000);
    pause();
    await tick(30000);
    expect(advance).not.toHaveBeenCalled();
    resume();
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-advance' }));
    pause();
    await tick(30000);
    resume();
    await tick(5000);
    expect(advance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume auto-advance' }));
    await tick(2900);
    expect(advance).not.toHaveBeenCalled();
    await tick(100);
    expect(advance).toHaveBeenCalledTimes(1);
    await tick(6000);
    expect(advance).toHaveBeenCalledTimes(1);
  });
});
