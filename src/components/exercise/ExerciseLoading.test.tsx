import React, { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExerciseLoading } from './ExerciseLoading';

function RoutesUnderTest({ finishLoadingAfterMs }: { finishLoadingAfterMs?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (finishLoadingAfterMs == null) return;
    const t = setTimeout(() => setReady(true), finishLoadingAfterMs);
    return () => clearTimeout(t);
  }, [finishLoadingAfterMs]);
  return (
    <MemoryRouter initialEntries={['/exercise/two-clues']}>
      <Routes>
        <Route path="/exercise/two-clues" element={ready ? <h1>Playable Two Clues</h1> : <ExerciseLoading />} />
        <Route path="/today" element={<h1>Today page</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('ExerciseLoading patient-safe recovery', () => {
  it('does not silently navigate away from a legitimate exercise when loading crosses five seconds', () => {
    render(<RoutesUnderTest />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading exercise...');
    act(() => { vi.advanceTimersByTime(5_100); });
    expect(screen.queryByRole('heading', { name: 'Today page' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Still loading exercise...');
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeVisible();
  });

  it('allows a slow but successful session initialization to reveal its playable game', () => {
    render(<RoutesUnderTest finishLoadingAfterMs={7_500} />);
    act(() => { vi.advanceTimersByTime(5_100); });
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeVisible();
    act(() => { vi.advanceTimersByTime(2_400); });
    expect(screen.getByRole('heading', { name: 'Playable Two Clues' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Go to Today' })).toBeNull();
  });

  it('provides a single explicit route out if session setup cannot finish', () => {
    render(<RoutesUnderTest />);
    act(() => { vi.advanceTimersByTime(5_100); });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Today' }));
    expect(screen.getByRole('heading', { name: 'Today page' })).toBeVisible();
  });

  it('does not show a misleading error button before loading becomes slow', () => {
    render(<RoutesUnderTest />);
    expect(screen.queryByRole('button')).toBeNull();
    act(() => { vi.advanceTimersByTime(4_999); });
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('shows a clear failure immediately, with a large retry button that invokes the supplied recovery', () => {
    const retry = vi.fn();
    render(
      <MemoryRouter>
        <ExerciseLoading error="Could not start this exercise. Check your connection and try again." onRetry={retry} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start this exercise');
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeVisible();
  });

  it('never presents an inert retry button when a parent has no retry handler', () => {
    render(<MemoryRouter><ExerciseLoading error="Session unavailable" /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Session unavailable');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeVisible();
  });

});
