import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDeviceScope } from '@/lib/deviceStore';
import { getTodaysPracticedWords, recordPracticedWord } from '@/lib/reviewQueue';
import { getAllLedgers } from '@/lib/transferLedger';
import { recordFixSentenceReviewTargets, recordTwoCluesReviewTargets } from '@/lib/gameReviewHandoff';

// Real game adapters, review engine and ledger. Only capture/navigation are mocked.
const voice = vi.hoisted(() => ({
  search: '?lesson=lesson-one',
  navigate: vi.fn(),
  onResult: null as null | ((transcript: string) => void),
  transcript: '',
  confidence: 0.95 as number | null,
  micSupported: true,
  speechError: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => voice.navigate,
    useLocation: () => ({ search: voice.search, state: null }),
  };
});
vi.mock('@/contexts/KidsModeContext', () => ({ useKidsMode: () => ({ kidsMode: false }) }));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: ({ onResult }: { onResult: (transcript: string) => void }) => {
    voice.onResult = onResult;
    return {
      isListening: false,
      startListening: voice.start,
      stopListening: voice.stop,
      isSupported: voice.micSupported,
      error: voice.speechError,
      getLastRecognition: () => ({
        transcript: voice.transcript.trim().toLowerCase(),
        confidence: voice.confidence,
        alternatives: [],
      }),
    };
  },
}));

import ReviewChatPage from './ReviewChatPage';

const LESSON = 'lesson-one';

function hear(transcript: string, confidence: number | null = 0.95) {
  act(() => {
    voice.transcript = transcript;
    voice.confidence = confidence;
    voice.onResult?.(transcript);
  });
}

function start() {
  fireEvent.click(screen.getByRole('button', { name: /start the chat/i }));
}

function practiceApple(mode: 'selection' | 'speech' = 'selection') {
  expect(recordPracticedWord('apple', 'food', true, {
    sessionId: LESSON, sourceGame: 'photo_naming', responseMode: mode,
  })).toBe(true);
}

function tiers(word: string) {
  return getAllLedgers().find((entry) => entry.word === word)?.events.map((event) => event.tier) ?? [];
}

beforeEach(() => {
  localStorage.clear();
  setDeviceScope('synthetic-patient-a');
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  voice.search = '?lesson=' + LESSON;
  voice.onResult = null;
  voice.transcript = '';
  voice.confidence = 0.95;
  voice.micSupported = true;
  voice.speechError = null;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  setDeviceScope(null);
});

describe('real games to the bounded Maya conversation: patient-safe evidence', () => {
  it('links Photo Naming, Two Clues and lexical Fix Sentence without converting game scores into spoken success', () => {
    practiceApple('selection');
    expect(recordTwoCluesReviewTargets([{
      puzzleId: 'tc-animals-1', clues: ['tweets', 'flies'], anchors: ['bird'],
      spokenWord: 'bird', matchedWord: 'bird', tier: 'strong', score: 100,
      reachedAnchor: true, semanticSimilarity: 1, reactionTimeMs: 4000,
      attemptNumber: 1,
    }], LESSON)).toBe(1);
    expect(recordFixSentenceReviewTargets([{
      trialId: 'fs_1', sentence: 'I washed my hands with a pillow.',
      wrongWord: 'pillow', spokenWord: 'soap', matchedFix: 'soap',
      isCorrect: true, isPartialCredit: false, selfCorrected: false,
      semanticSimilarity: 1, reactionTimeMs: 2300, attemptNumber: 1,
      difficulty: 1, phonemeTargets: ['/s/'], support: 'open_response',
    }], LESSON)).toBe(1);
    recordPracticedWord('water', 'food', false, {
      sessionId: 'different-lesson', sourceGame: 'photo_naming', responseMode: 'speech',
    });

    expect(tiers('apple')).toEqual(['practice']);
    expect(tiers('bird')).toEqual(['practice']);
    expect(tiers('soap')).toEqual(['practice']);

    render(<ReviewChatPage />);
    expect(screen.getByText(/3 words, a few minutes/i)).toBeTruthy();
    start();
    expect(screen.getByText(/We practiced apple/i)).toBeTruthy();
    hear('apple', 0.95);
    expect(tiers('apple')).toEqual(['practice', 'elicited']);
    expect(tiers('bird')).toEqual(['practice']);
    expect(tiers('soap')).toEqual(['practice']);

    fireEvent.click(screen.getByRole('button', { name: /all done/i }));
    expect(screen.getByText(/found in conversation/i)).toBeTruthy();
    expect(getTodaysPracticedWords({ sessionId: LESSON })).toEqual([]);
    expect(getTodaysPracticedWords({ sessionId: 'different-lesson' }).map((p) => p.word))
      .toEqual(['water']);
    expect(tiers('bird')).toEqual(['practice', 'released']);
    expect(tiers('soap')).toEqual(['practice', 'released']);
  });

  it('does not count a low-confidence recognition hypothesis until the patient confirms it', () => {
    practiceApple();
    render(<ReviewChatPage />);
    start();
    hear('apple', 0.2);
    expect(screen.getByRole('button', { name: /^yes$/i })).toBeTruthy();
    expect(tiers('apple')).toEqual(['practice']);
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));
    expect(tiers('apple')).toEqual(['practice', 'elicited']);
  });

  it('keeps a rejected recognition guess out of produced-word evidence', () => {
    practiceApple();
    render(<ReviewChatPage />);
    start();
    hear('apple', 0.1);
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(tiers('apple')).toEqual(['practice']);
    fireEvent.click(screen.getByRole('button', { name: /all done/i }));
    expect(tiers('apple')).toEqual(['practice', 'released']);
  });

  it('keeps an unavailable microphone attempt unverified rather than scoring speech', () => {
    practiceApple();
    voice.micSupported = false;
    render(<ReviewChatPage />);
    start();
    fireEvent.click(screen.getByRole('button', { name: /I tried saying/i }));
    expect(screen.getByText(/self-reported attempt/i)).toBeTruthy();
    expect(tiers('apple')).toEqual(['practice']);
  });

  it('remounts from the correct patient queue and rejects a stale speech callback on profile switch', () => {
    practiceApple();
    setDeviceScope('synthetic-patient-b');
    expect(recordPracticedWord('cup', 'household', true, {
      sessionId: LESSON, sourceGame: 'fix_sentence', responseMode: 'text',
    })).toBe(true);
    setDeviceScope('synthetic-patient-a');

    render(<ReviewChatPage />);
    start();
    expect(screen.getByText(/We practiced apple/i)).toBeTruthy();
    const staleSpeechCallback = voice.onResult;
    expect(staleSpeechCallback).not.toBeNull();

    act(() => setDeviceScope('synthetic-patient-b'));
    expect(screen.getByRole('button', { name: /start the chat/i })).toBeTruthy();
    expect(screen.queryByText(/We practiced apple/i)).toBeNull();
    start();
    expect(screen.getByText(/We practiced cup/i)).toBeTruthy();
    const before = getAllLedgers();
    act(() => staleSpeechCallback?.('apple'));
    expect(getAllLedgers()).toEqual(before);
    expect(tiers('cup')).toEqual(['practice']);
  });

  it('rejects an already-captured recognition callback after leaving the page', () => {
    practiceApple();
    const view = render(<ReviewChatPage />);
    start();
    const staleSpeechCallback = voice.onResult;
    view.unmount();
    act(() => staleSpeechCallback?.('apple'));
    expect(tiers('apple')).toEqual(['practice']);
  });

  it('does not fall back to a different lesson when the explicit URL scope is invalid', () => {
    practiceApple();
    voice.search = '?lesson=';
    render(<ReviewChatPage />);
    expect(screen.getByText('Nothing to review yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /start the chat/i })).toBeNull();
  });
});
