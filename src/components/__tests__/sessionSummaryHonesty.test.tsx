/**
 * The report card must not flatter, and must not shrug.
 *
 * The user asked for this screen because "session complete" told his father
 * nothing. Two things it did instead were worse than saying nothing:
 *
 *  - "You practiced for 15 minutes" after a 71-second session. durationSec is
 *    still null when this screen reads the sessions row (endSessionTracking is
 *    closing it concurrently), and the fallback was lesson.totalDuration — the
 *    PLAN. Measured at 15 minutes against recorded durations of 70-73 seconds,
 *    six sessions out of six. A twelvefold overstatement, and flattering, on
 *    the one concrete number the screen carries.
 *  - "— Rounds" next to a list of exercises all marked "Practiced". The tile
 *    counted only SCORED trials, so someone whose microphone struggled was
 *    told their rounds did not happen.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const rows: Array<Record<string, unknown>> = [];
let sessionRow: { duration_sec: number | null } | null = { duration_sec: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          // sessions.single()
          single: async () => ({ data: sessionRow, error: null }),
          // exercise_events — a thenable list
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: table === 'exercise_events' ? rows : [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/useActiveProfileId', () => ({ useActiveProfileId: () => 'synthetic-profile-a' }));

vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({ speak: vi.fn(async () => {}), stop: vi.fn(), isSpeaking: false, isLoading: false }),
  stopGlobalTTS: vi.fn(),
}));
vi.mock('@/hooks/useUiMode', () => ({ useUiMode: () => ({ uiMode: 'patient', profile: { variant: 'base' } }) }));
vi.mock('@/contexts/CoachingModeContext', () => ({ useCoachingMode: () => ({ mode: 'off' }) }));
vi.mock('@/lib/exerciseDetailsStore', () => ({ readAllExerciseDetails: () => [] }));
vi.mock('@/lib/reflectionEngine', () => ({ buildSessionInsight: () => null }));
vi.mock('@/lib/sessionSignalStore', () => ({ saveSessionSignals: vi.fn() }));

import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { resolveLessonConversationNavigation } from '@/lib/conversationPractice/lessonHandoff';
import { SessionSummaryScreen } from '@/components/SessionSummaryScreen';

const lesson = {
  totalDuration: 15,
  blocks: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
  reasoning: [],
} as never;

function renderSummary() {
  return render(
    <MemoryRouter>
      <SessionSummaryScreen lesson={lesson} sessionId="s1" onFinish={() => {}} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  rows.length = 0;
  sessionRow = { duration_sec: null };
});
afterEach(cleanup);

describe('the duration it reports', () => {
  it('never substitutes the planned length for what happened', async () => {
    // The plan says 15 minutes. The session row has not been written yet.
    renderSummary();
    await waitFor(() => expect(screen.getByText(/You practiced/i)).toBeTruthy());
    expect(screen.queryByText(/15 minutes/i)).toBeNull();
    expect(screen.getByText(/You practiced today/i)).toBeTruthy();
  });

  it('reports the real length once it is known', async () => {
    sessionRow = { duration_sec: 73 };
    renderSummary();
    await waitFor(() => expect(screen.getByText(/You practiced for 1 minute/i)).toBeTruthy());
  });
});

describe('the rounds it reports', () => {
  it('counts attempts when nothing could be scored', async () => {
    // A session whose trials were all validity-filtered: real practice, no
    // scores. It used to render "—" beside a list of "Practiced" exercises.
    rows.push(
      { exercise_slug: 'photo_naming', score: null, counts_toward_score: false, validity_label: 'low_confidence' },
      { exercise_slug: 'photo_naming', score: null, counts_toward_score: false, validity_label: 'low_confidence' },
      { exercise_slug: 'describe_guess', score: null, counts_toward_score: false, validity_label: 'low_confidence' }
    );
    renderSummary();
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    expect(screen.queryByText('—')).toBeNull();
  });
});

function BridgeLocation() {
  const location = useLocation();
  const bridge = resolveLessonConversationNavigation(
    location.state, 'synthetic-profile-a', 'conversation-coach',
  );
  return <p>bridge: {bridge?.sourceGame ?? 'invalid'}</p>;
}

function renderNavigableSummary() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<SessionSummaryScreen lesson={lesson} sessionId="s1" onFinish={() => {}} />} />
        <Route path="/exercise/conversation-coach" element={<BridgeLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('saved lesson to optional conversational practice bridge', () => {
  it('offers a matching follow-up only from a stored event owned by this patient', async () => {
    sessionRow = { duration_sec: 80 };
    rows.push({
      exercise_slug: 'phrase_practice', profile_id: 'synthetic-profile-a',
      score: null, counts_toward_score: false, validity_label: 'low_confidence',
    });
    renderNavigableSummary();
    const button = await screen.findByRole('button', { name: /Try a related conversation with Maya/i });
    expect(screen.getByText(/Optional scripted practice, not a real-world outcome score/i)).toBeTruthy();
    fireEvent.click(button);
    expect(await screen.findByText('bridge: phrase_practice')).toBeTruthy();
  });

  it('does not show a different patient\'s saved game as this patient\'s handoff', async () => {
    sessionRow = { duration_sec: 80 };
    rows.push({
      exercise_slug: 'phrase_practice', profile_id: 'other-profile',
      score: null, counts_toward_score: false, validity_label: 'low_confidence',
    });
    renderSummary();
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Try a related conversation with Maya/i })).toBeNull();
  });

  it('does not invent conversational practice for a plan-only or unrelated game', async () => {
    sessionRow = { duration_sec: 80 };
    rows.push({
      exercise_slug: 'pattern_match', profile_id: 'synthetic-profile-a',
      score: null, counts_toward_score: false, validity_label: 'low_confidence',
    });
    renderSummary();
    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Try a related conversation with Maya/i })).toBeNull();
  });
});
