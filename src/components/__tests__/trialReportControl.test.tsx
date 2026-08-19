/**
 * TrialReportControl, rendered.
 *
 * The behavior worth pinning is not the happy path — it is the restraint:
 * this control must stay invisible when there is nothing to report and when
 * the person is not in an exercise, and it must never ask someone to type.
 * Those are the properties that decide whether it helps or becomes another
 * thing in the way of a practice session.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrialReportControl } from '@/components/TrialReportControl';
import { recordLastTrial, clearLastTrial } from '@/lib/feedback/lastTrial';

const submitMock = vi.fn(async () => ({ ok: true, id: 'report-1' }));
const attachMock = vi.fn(async () => true);

vi.mock('@/lib/feedback/submitTrialReport', async () => {
  const actual = await vi.importActual<typeof import('@/lib/feedback/submitTrialReport')>(
    '@/lib/feedback/submitTrialReport'
  );
  return {
    ...actual,
    submitTrialReport: (...args: unknown[]) => submitMock(...(args as [])),
    attachNote: (...args: unknown[]) => attachMock(...(args as [])),
  };
});

const wrongTrial = {
  exerciseSlug: 'category-fluency',
  sessionId: 's1',
  level: 2,
  trialIndex: 1,
  stimulusId: 'jobs',
  expected: 'plumber',
  userResponse: 'plumbing',
  browserTranscript: 'plumbing',
  isCorrect: false,
  cueLevel: 0,
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TrialReportControl />
    </MemoryRouter>
  );

beforeEach(() => {
  clearLastTrial();
  submitMock.mockClear();
  attachMock.mockClear();
});
afterEach(cleanup);

describe('TrialReportControl', () => {
  it('stays invisible when no trial has happened', () => {
    renderAt('/exercise/category-fluency');
    expect(screen.queryByText(/something wrong/i)).toBeNull();
  });

  it('stays invisible outside an exercise, even with a recent trial', () => {
    recordLastTrial(wrongTrial);
    renderAt('/today');
    expect(screen.queryByText(/something wrong/i)).toBeNull();
  });

  it('appears once a trial has been scored', () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    expect(screen.getByText(/something wrong/i)).toBeTruthy();
  });

  it('offers "should have counted" for a trial marked wrong', () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    expect(screen.getByText(/that should have counted/i)).toBeTruthy();
    expect(screen.queryByText(/shouldn't have counted/i)).toBeNull();
  });

  it('offers the opposite for a trial marked correct', () => {
    recordLastTrial({ ...wrongTrial, isCorrect: true });
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    expect(screen.getByText(/shouldn't have counted/i)).toBeTruthy();
    expect(screen.queryByText(/that should have counted/i)).toBeNull();
  });

  it('always offers "it didn\'t hear me", which is a different fix', () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    expect(screen.getByText(/didn't hear me/i)).toBeTruthy();
  });

  it('sends a complete report from one tap, with no typing', async () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.click(screen.getByText(/that should have counted/i));
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock.mock.calls[0][1]).toBe('should_have_counted');
    expect(await screen.findByText(/that's logged/i)).toBeTruthy();
  });

  it('says what it sends before it sends it', () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    expect(screen.getByText(/sends what you said and how it was scored/i)).toBeTruthy();
  });

  it('keeps the note optional and second', async () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    // No textarea anywhere before the report has been sent.
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByText(/didn't hear me/i));
    await screen.findByText(/that's logged/i);
    fireEvent.click(screen.getByText(/add a note/i));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('says so when the report does not reach us, and never claims it did', async () => {
    // The table may not exist yet, the network may be down. Telling someone
    // their report was logged when it was not is worse than having no button:
    // they believe the problem has been passed on, and it has not.
    submitMock.mockResolvedValueOnce({ ok: false, id: null });
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.click(screen.getByText(/that should have counted/i));
    expect(await screen.findByText(/didn't reach us/i)).toBeTruthy();
    expect(screen.queryByText(/that's logged/i)).toBeNull();
  });

  it('offers a retry that reuses the same reason', async () => {
    submitMock.mockResolvedValueOnce({ ok: false, id: null });
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.click(screen.getByText(/didn't hear me/i));
    await screen.findByText(/didn't reach us/i);
    fireEvent.click(screen.getByText(/try again/i));
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(2));
    expect(submitMock.mock.calls[1][1]).toBe('not_heard');
  });

  it('never offers to attach a note to a report that failed', async () => {
    submitMock.mockResolvedValueOnce({ ok: false, id: null });
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.click(screen.getByText(/didn't hear me/i));
    await screen.findByText(/didn't reach us/i);
    expect(screen.queryByText(/add a note/i)).toBeNull();
  });

  it('can be dismissed without reporting anything', () => {
    recordLastTrial(wrongTrial);
    renderAt('/exercise/category-fluency');
    fireEvent.click(screen.getByText(/something wrong/i));
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(screen.getByText(/something wrong/i)).toBeTruthy();
    expect(submitMock).not.toHaveBeenCalled();
  });
});
