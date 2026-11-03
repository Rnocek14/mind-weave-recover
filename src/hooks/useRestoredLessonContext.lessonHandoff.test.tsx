import { cleanup, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useRestoredLessonContext } from './useRestoredLessonContext';
import {
  makeLessonConversationNavigation, selectLessonConversationBridge,
} from '@/lib/conversationPractice/lessonHandoff';

const exerciseSlug = 'conversation-coach';
const stale = {
  sessionId: 'previous-patient-session',
  currentBlockIndex: 0,
  lesson: { blocks: [{ exerciseId: 'conversation-coach' }] },
};
const hint = makeLessonConversationNavigation(
  selectLessonConversationBridge(['phrase_practice'])!, 'current-patient',
);

function wrapper(state: unknown) {
  return function Router({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={[{
      pathname: '/exercise/conversation-coach', state,
    }]}>{children}</MemoryRouter>;
  };
}

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe('explicit cross-lesson follow-up never borrows a stale lesson session', () => {
  it('starts standalone even when an old lesson matches the conversation route', () => {
    sessionStorage.setItem('lessonFlowState', JSON.stringify(stale));
    sessionStorage.setItem('smartCoachState', JSON.stringify({
      returningFromGame: true, sessionId: 'previous-patient-smartcoach',
    }));
    const { result } = renderHook(() => useRestoredLessonContext(exerciseSlug), {
      wrapper: wrapper({ lessonConversation: hint }),
    });
    expect(result.current).toEqual({
      fromLesson: false, sessionId: null, adaptations: undefined, returnTo: '/lesson',
    });
  });

  it('still honors an actual lesson-owned session when that is explicitly requested', () => {
    sessionStorage.setItem('lessonFlowState', JSON.stringify(stale));
    const { result } = renderHook(() => useRestoredLessonContext(exerciseSlug), {
      wrapper: wrapper({ fromLesson: true, sessionId: 'active-lesson', returnTo: '/lesson' }),
    });
    expect(result.current.fromLesson).toBe(true);
    expect(result.current.sessionId).toBe('active-lesson');
  });

  it('keeps ordinary recovery of an interrupted lesson when there is no follow-up hint', () => {
    sessionStorage.setItem('lessonFlowState', JSON.stringify(stale));
    const { result } = renderHook(() => useRestoredLessonContext(exerciseSlug), {
      wrapper: wrapper(null),
    });
    expect(result.current.fromLesson).toBe(true);
    expect(result.current.sessionId).toBe('previous-patient-session');
  });
});
