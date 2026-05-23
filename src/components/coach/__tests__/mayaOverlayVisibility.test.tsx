/**
 * Contract tests — Maya overlay visibility.
 *
 * Locks the rules in MayaSessionOverlay:
 *   - Hidden when CoachingMode is 'off' (Games Only).
 *   - Hidden when the route is NOT an exercise route.
 *   - Hidden when no active exercise slug is in sessionStorage.
 *   - Visible (bubble renders) when mode is 'light' or 'full', on an
 *     exercise route, with a valid lessonFlowState in sessionStorage.
 *
 * Mocks CoachingModeContext + the underlying bubble so we only test
 * visibility logic, not the bubble's internals. No runtime logic changed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/contexts/CoachingModeContext', () => ({
  useCoachingMode: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/components/coach/MayaAssistantBubble', () => ({
  MayaAssistantBubble: ({ visible }: { visible?: boolean }) =>
    visible ? <div data-testid="maya-bubble">MAYA_BUBBLE</div> : null,
}));

import { MayaSessionOverlay } from '@/components/coach/MayaSessionOverlay';
import { useCoachingMode } from '@/contexts/CoachingModeContext';

type Mode = 'off' | 'light' | 'full';

function renderAt(path: string, mode: Mode) {
  (useCoachingMode as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ mode });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<MayaSessionOverlay />} />
      </Routes>
    </MemoryRouter>
  );
}

const seedLesson = (phase = 'exercise', exerciseId: string | null = 'photo_naming') => {
  sessionStorage.setItem(
    'lessonFlowState',
    JSON.stringify({
      phase,
      currentBlockIndex: 0,
      lesson: { blocks: [{ exerciseId }] },
    })
  );
};

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('MayaSessionOverlay visibility', () => {
  it('renders nothing when coaching mode is "off" (Games Only)', () => {
    seedLesson();
    renderAt('/exercise/photo_naming', 'off');
    expect(screen.queryByTestId('maya-bubble')).toBeNull();
  });

  it('renders nothing on a non-exercise route, even in full mode', () => {
    seedLesson();
    renderAt('/today', 'full');
    expect(screen.queryByTestId('maya-bubble')).toBeNull();
  });

  it('renders nothing when no lesson state is in sessionStorage', () => {
    renderAt('/exercise/photo_naming', 'full');
    expect(screen.queryByTestId('maya-bubble')).toBeNull();
  });

  it('renders nothing when lesson phase is not "exercise"', () => {
    seedLesson('intro');
    renderAt('/exercise/photo_naming', 'full');
    expect(screen.queryByTestId('maya-bubble')).toBeNull();
  });

  it('renders nothing when the active block has no exerciseId', () => {
    seedLesson('exercise', null);
    renderAt('/exercise/photo_naming', 'full');
    expect(screen.queryByTestId('maya-bubble')).toBeNull();
  });

  it('renders the bubble in "full" mode on an exercise route with valid state', () => {
    seedLesson();
    renderAt('/exercise/photo_naming', 'full');
    expect(screen.getByTestId('maya-bubble')).toBeInTheDocument();
  });

  it('renders the bubble in "light" (Guided) mode on an exercise route', () => {
    seedLesson();
    renderAt('/exercise/photo_naming', 'light');
    expect(screen.getByTestId('maya-bubble')).toBeInTheDocument();
  });

  it('survives corrupted sessionStorage JSON without rendering', () => {
    sessionStorage.setItem('lessonFlowState', '{not valid json');
    renderAt('/exercise/photo_naming', 'full');
    expect(screen.queryByTestId('maya-bubble')).toBeNull();
  });
});
