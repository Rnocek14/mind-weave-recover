import { describe, expect, it } from 'vitest';
import { getPauseReorientation } from './pauseReorientation';

describe('pause reorientation', () => {
  it('gives a short same-game reminder for a brief pause', () => {
    const guide = getPauseReorientation('photo-naming', 9_999);
    expect(guide.detail).toBe('brief');
    expect(guide.text).toContain('Photo Naming');
    expect(guide.text).toContain('picture');
  });

  it('re-explains the task after a medium pause', () => {
    const guide = getPauseReorientation('two-clues', 10_000);
    expect(guide.detail).toBe('instruction');
    expect(guide.text).toContain('both clues');
    expect(guide.text).toContain('same question');
  });

  it('includes a relevant example after a long pause', () => {
    const guide = getPauseReorientation('describe-guess', 60_000);
    expect(guide.detail).toBe('example');
    expect(guide.text).toContain('what it is used for');
    expect(guide.text).toContain('cup');
    expect(guide.text).toContain('same question');
  });

  it('does not break on unfamiliar routes', () => {
    const guide = getPauseReorientation('new-exercise', 90_000);
    expect(guide.name).toBe('Your game');
    expect(guide.text).toContain('question on the screen');
  });
});
