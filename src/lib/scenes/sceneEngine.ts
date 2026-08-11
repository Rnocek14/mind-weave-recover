/**
 * Functional Command Scenes — pure scene engine
 * (docs/functional-command-scenes-spec.md §4).
 *
 * A scene is a set of BOUNDED axes; commands are closed-vocabulary words
 * that transition an axis. No I/O, no React — fully testable.
 */

export type AxisType = 'step' | 'toggle';

export interface SceneAxis {
  key: string;
  type: AxisType;
  /** step axes: integer range + start point. */
  min?: number;
  max?: number;
  initial: number | boolean;
}

export interface SceneCommand {
  /** Canonical display word — what the tap button shows and TTS models. */
  word: string;
  /** Extra accepted spoken forms (lowercase). */
  aliases?: string[];
  /**
   * Base (uninflected) forms accepted for a comparative canonical word,
   * e.g. word 'bigger' with baseForms ['big']. Logged separately so the
   * comparative-morphology signal is visible in telemetry.
   */
  baseForms?: string[];
  axis: string;
  /** step axes: +1 / -1 etc. */
  delta?: number;
  /** toggle axes: the value this command sets. */
  set?: boolean;
}

export interface SceneDefinition {
  id: string;
  /** Adult-presentation title, e.g. "The Lamp". */
  title: string;
  /** Short instruction line. */
  prompt: string;
  photo: string;
  axes: SceneAxis[];
  commands: SceneCommand[];
  /** aria-live / feedback template per command word, e.g. "The lamp is brighter." */
  feedback: Record<string, string>;
  /** Boundary feedback per axis+direction, e.g. brightness_max. */
  limitFeedback: Record<string, string>;
}

export type SceneState = Record<string, number | boolean>;

export type CommandForm = 'canonical' | 'alias' | 'base_form';

export interface CommandApplication {
  matched: SceneCommand | null;
  /** Which surface form the speaker actually used. */
  formUsed: CommandForm | null;
  /** The token that matched. */
  matchedToken: string | null;
  next: SceneState;
  /** False when the command hit an axis boundary (state unchanged). */
  changed: boolean;
  atLimit: boolean;
}

export function initialSceneState(scene: SceneDefinition): SceneState {
  const s: SceneState = {};
  for (const axis of scene.axes) s[axis.key] = axis.initial;
  return s;
}

function normalizeUtterance(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

interface TokenMatch {
  command: SceneCommand;
  form: CommandForm;
  token: string;
  position: number;
}

/**
 * Find every command token in the utterance; the LAST occurrence wins
 * (most recent intent: "no wait — smaller"). Multi-word aliases match as
 * consecutive token runs.
 */
export function matchCommand(
  scene: SceneDefinition,
  utterance: string,
): TokenMatch | null {
  const tokens = normalizeUtterance(utterance);
  if (tokens.length === 0) return null;

  const matches: TokenMatch[] = [];
  for (const command of scene.commands) {
    const surfaces: Array<{ text: string; form: CommandForm }> = [
      { text: command.word.toLowerCase(), form: 'canonical' },
      ...(command.aliases ?? []).map((a) => ({ text: a.toLowerCase(), form: 'alias' as CommandForm })),
      ...(command.baseForms ?? []).map((b) => ({ text: b.toLowerCase(), form: 'base_form' as CommandForm })),
    ];
    for (const surface of surfaces) {
      const parts = surface.text.split(/\s+/);
      for (let i = 0; i <= tokens.length - parts.length; i++) {
        if (parts.every((p, j) => tokens[i + j] === p)) {
          matches.push({ command, form: surface.form, token: surface.text, position: i });
        }
      }
    }
  }
  if (matches.length === 0) return null;
  // Last position wins (most recent intent); at the same position the
  // LONGER surface wins so "slow down" beats its own substring "slow".
  matches.sort((a, b) => a.position - b.position || a.token.length - b.token.length);
  return matches[matches.length - 1];
}

export function applyCommandUtterance(
  scene: SceneDefinition,
  state: SceneState,
  utterance: string,
): CommandApplication {
  const found = matchCommand(scene, utterance);
  if (!found) {
    return { matched: null, formUsed: null, matchedToken: null, next: state, changed: false, atLimit: false };
  }
  const { command, form, token } = found;
  const axis = scene.axes.find((a) => a.key === command.axis);
  if (!axis) {
    return { matched: command, formUsed: form, matchedToken: token, next: state, changed: false, atLimit: false };
  }

  const next: SceneState = { ...state };
  let changed = false;
  let atLimit = false;

  if (axis.type === 'toggle') {
    const target = command.set ?? true;
    if (state[axis.key] !== target) {
      next[axis.key] = target;
      changed = true;
    } else {
      atLimit = true; // already in that state
    }
  } else {
    const current = Number(state[axis.key]);
    const delta = command.delta ?? 0;
    const clamped = Math.max(axis.min ?? 0, Math.min(axis.max ?? 0, current + delta));
    if (clamped !== current) {
      next[axis.key] = clamped;
      changed = true;
      atLimit = clamped === (delta > 0 ? axis.max : axis.min);
    } else {
      atLimit = true;
    }
  }

  return { matched: command, formUsed: form, matchedToken: token, next, changed, atLimit };
}

/** Feedback line for an application (spec §2: honest at the boundary). */
export function feedbackFor(scene: SceneDefinition, app: CommandApplication): string | null {
  if (!app.matched) return null;
  if (!app.changed) {
    const dirKey =
      app.matched.delta != null
        ? `${app.matched.axis}_${app.matched.delta > 0 ? 'max' : 'min'}`
        : `${app.matched.axis}_${app.matched.set ? 'max' : 'min'}`;
    return scene.limitFeedback[dirKey] ?? scene.feedback[app.matched.word] ?? null;
  }
  return scene.feedback[app.matched.word] ?? null;
}
