import { describe, expect, it } from 'vitest';
import { getConversationPracticeStage } from './stages';
import {
  selectLessonConversationBridge,
  makeLessonConversationNavigation,
  resolveLessonConversationNavigation,
} from './lessonHandoff';

const cases = [
  ['phrase_practice', 'conversation-coach', 3],
  ['describe_guess', 'conversation-coach', 5],
  ['photo_naming', 'conversation-coach', 5],
  ['two_clues', 'conversation-coach', 5],
  ['fix_sentence', 'conversation-coach', 7],
  ['narrative_retell', 'conversation-partner', 3],
  ['thought_continuation', 'conversation-partner', 4],
] as const;

describe('observed lesson -> optional scripted everyday conversation (no clinical transfer claim)', () => {
  it.each(cases)('%s routes to an existing authored %s Stage %i, not a generic word quiz',
    (slug, kind, stage) => {
      const bridge = selectLessonConversationBridge([slug]);
      expect(bridge).toMatchObject({ sourceGame: slug, kind, stage });
      expect(bridge?.label).toBeTruthy();
      const existing = getConversationPracticeStage(kind, stage);
      expect(existing).not.toBeNull();
      expect(existing?.practiceOnly).toBe(true);
      const navigation = makeLessonConversationNavigation(bridge!, 'profile-a');
      expect(Object.keys(navigation).sort()).toEqual([
        'kind', 'patientProfileId', 'sourceGame', 'stage', 'version',
      ]);
      expect(navigation).not.toHaveProperty('score');
      expect(navigation).not.toHaveProperty('transcript');
      expect(navigation).not.toHaveProperty('sessionId');
      expect(resolveLessonConversationNavigation(
        { lessonConversation: navigation }, 'profile-a', kind,
      )).toEqual(bridge);
    },
  );

  it('offers a bridge only for games observed in saved events, not the entire lesson plan', () => {
    expect(selectLessonConversationBridge(['minimal_pairs', 'pattern_match'])).toBeNull();
    const observed = selectLessonConversationBridge(['reach_tap', 'narrative-retell', 'phrase_practice']);
    expect(observed).toMatchObject({
      sourceGame: 'narrative_retell', kind: 'conversation-partner', stage: 3,
    });
    expect(selectLessonConversationBridge([])).toBeNull();
  });

  it('does not accept navigation from another patient, activity or a made-up stage', () => {
    const bridge = selectLessonConversationBridge(['phrase_practice'])!;
    const navigation = makeLessonConversationNavigation(bridge, 'profile-a');
    const read = (hint: unknown, patient: string | null = 'profile-a') =>
      resolveLessonConversationNavigation({ lessonConversation: hint }, patient, 'conversation-coach');
    expect(read(navigation, 'profile-b')).toBeNull();
    expect(read(navigation, null)).toBeNull();
    expect(resolveLessonConversationNavigation(
      { lessonConversation: navigation }, 'profile-a', 'conversation-partner',
    )).toBeNull();
    expect(read({ ...navigation, stage: 8 })).toBeNull();
    expect(read({ ...navigation, version: 2 })).toBeNull();
    expect(read({ ...navigation, sourceGame: 'photo_naming', stage: 3 })).toBeNull();
    expect(read({ ...navigation, sourceGame: 'PHRASE_PRACTICE' })).toBeNull();
    expect(read({ ...navigation, patientProfileId: 'profile-b' })).toBeNull();
    expect(read('phrase_practice')).toBeNull();
    expect(read(undefined)).toBeNull();
  });
});
