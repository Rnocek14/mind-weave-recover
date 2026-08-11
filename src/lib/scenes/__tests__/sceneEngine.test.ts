import { describe, it, expect } from 'vitest';
import {
  initialSceneState,
  applyCommandUtterance,
  matchCommand,
  feedbackFor,
} from '@/lib/scenes/sceneEngine';
import { FUNCTIONAL_SCENES } from '@/data/functionalSceneBank';

const lamp = FUNCTIONAL_SCENES.find((s) => s.id === 'lamp')!;
const ball = FUNCTIONAL_SCENES.find((s) => s.id === 'ball')!;
const car = FUNCTIONAL_SCENES.find((s) => s.id === 'car')!;

describe('sceneEngine — matching', () => {
  it('matches the canonical word exactly', () => {
    const m = matchCommand(ball, 'bigger');
    expect(m?.command.word).toBe('bigger');
    expect(m?.form).toBe('canonical');
  });

  it('matches inside a longer utterance ("make it bigger")', () => {
    const m = matchCommand(ball, 'make it bigger please');
    expect(m?.command.word).toBe('bigger');
  });

  it('tracks base forms separately (comparative morphology signal)', () => {
    const m = matchCommand(ball, 'big');
    expect(m?.command.word).toBe('bigger');
    expect(m?.form).toBe('base_form');
  });

  it('matches multi-word aliases as token runs ("slow down")', () => {
    const m = matchCommand(car, 'slow down');
    expect(m?.command.word).toBe('slower');
    expect(m?.form).toBe('alias');
  });

  it('the LAST command in an utterance wins ("no wait smaller")', () => {
    const m = matchCommand(ball, 'bigger no wait smaller');
    expect(m?.command.word).toBe('smaller');
  });

  it('returns null for unrelated speech', () => {
    expect(matchCommand(ball, 'hello there')).toBeNull();
  });
});

describe('sceneEngine — transitions', () => {
  it('steps an axis and reports the change', () => {
    const s0 = initialSceneState(lamp);
    const app = applyCommandUtterance(lamp, s0, 'brighter');
    expect(app.changed).toBe(true);
    expect(app.next.brightness).toBe(Number(s0.brightness) + 1);
    expect(feedbackFor(lamp, app)).toBe('The lamp is brighter.');
  });

  it('clamps at the boundary and answers honestly', () => {
    let state = initialSceneState(lamp);
    for (let i = 0; i < 10; i++) {
      state = applyCommandUtterance(lamp, state, 'brighter').next;
    }
    expect(state.brightness).toBe(4);
    const atLimit = applyCommandUtterance(lamp, state, 'brighter');
    expect(atLimit.changed).toBe(false);
    expect(atLimit.atLimit).toBe(true);
    expect(feedbackFor(lamp, atLimit)).toBe("That's as bright as it goes.");
  });

  it('toggle axes: go/stop set state; repeating reports already-there', () => {
    let state = initialSceneState(car);
    expect(state.moving).toBe(false);
    const go = applyCommandUtterance(car, state, 'go');
    expect(go.changed).toBe(true);
    expect(go.next.moving).toBe(true);
    const goAgain = applyCommandUtterance(car, go.next, 'go');
    expect(goAgain.changed).toBe(false);
    expect(feedbackFor(car, goAgain)).toBe('The car is already going.');
  });

  it('unmatched utterances leave state untouched', () => {
    const s0 = initialSceneState(ball);
    const app = applyCommandUtterance(ball, s0, 'xylophone');
    expect(app.matched).toBeNull();
    expect(app.next).toBe(s0);
  });
});

describe('functional scene bank — integrity', () => {
  it('every command references an existing axis', () => {
    for (const scene of FUNCTIONAL_SCENES) {
      const axisKeys = new Set(scene.axes.map((a) => a.key));
      for (const c of scene.commands) {
        expect(axisKeys.has(c.axis), `${scene.id}:${c.word}`).toBe(true);
      }
    }
  });

  it('vocabulary is unique within each scene (no ambiguous matches)', () => {
    for (const scene of FUNCTIONAL_SCENES) {
      const all = scene.commands.flatMap((c) => [
        c.word.toLowerCase(),
        ...(c.aliases ?? []).map((a) => a.toLowerCase()),
        ...(c.baseForms ?? []).map((b) => b.toLowerCase()),
      ]);
      expect(new Set(all).size, scene.id).toBe(all.length);
    }
  });

  it('every scene has an opposing pair and feedback for every command', () => {
    for (const scene of FUNCTIONAL_SCENES) {
      expect(scene.commands.length, scene.id).toBeGreaterThanOrEqual(2);
      for (const c of scene.commands) {
        expect(scene.feedback[c.word], `${scene.id}:${c.word} feedback`).toBeTruthy();
      }
      // Each step axis must have both directions; each toggle both values.
      for (const axis of scene.axes) {
        const cmds = scene.commands.filter((c) => c.axis === axis.key);
        if (axis.type === 'step') {
          expect(cmds.some((c) => (c.delta ?? 0) > 0), `${scene.id}:${axis.key}+`).toBe(true);
          expect(cmds.some((c) => (c.delta ?? 0) < 0), `${scene.id}:${axis.key}-`).toBe(true);
        } else {
          expect(cmds.some((c) => c.set === true), `${scene.id}:${axis.key}=true`).toBe(true);
          expect(cmds.some((c) => c.set === false), `${scene.id}:${axis.key}=false`).toBe(true);
        }
        // Boundary feedback exists in both directions.
        expect(scene.limitFeedback[`${axis.key}_max`], `${scene.id}:${axis.key}_max`).toBeTruthy();
        expect(scene.limitFeedback[`${axis.key}_min`], `${scene.id}:${axis.key}_min`).toBeTruthy();
      }
    }
  });

  it('step axes start strictly inside their range (both directions demonstrable)', () => {
    for (const scene of FUNCTIONAL_SCENES) {
      for (const axis of scene.axes) {
        if (axis.type !== 'step') continue;
        expect(Number(axis.initial), `${scene.id}:${axis.key}`).toBeGreaterThan(axis.min ?? 0);
        expect(Number(axis.initial), `${scene.id}:${axis.key}`).toBeLessThan(axis.max ?? 0);
      }
    }
  });
});
