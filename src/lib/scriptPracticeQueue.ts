/**
 * Strictly session- and profile-scoped device-only handoff from Phrase Practice.
 * Records a phrase SHOWN during a session (not an utterance, correct answer,
 * verified speech attempt, or clinical outcome). No transcript/audio stored.
 */
import { scopedKey } from "./deviceStore";
import { isFunctionalScriptId, type FunctionalScriptId } from "./functionalTransfer";

export interface PresentedFunctionalScript {
  sessionId: string;
  scriptId: FunctionalScriptId;
  day: string;
}

const KEY = "functionalScriptPractice_v1";
const MAX_ENTRIES = 40;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function load(): PresentedFunctionalScript[] {
  try {
    const raw = localStorage.getItem(scopedKey(KEY));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PresentedFunctionalScript =>
      !!item && typeof item === "object" &&
      validSessionId(item.sessionId) &&
      isFunctionalScriptId(item.scriptId) &&
      typeof item.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.day),
    ).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function recordPresentedFunctionalScript(scriptId: unknown, sessionId: unknown): boolean {
  if (!validSessionId(sessionId) || !isFunctionalScriptId(scriptId)) return false;
  try {
    const day = today();
    const existing = load().filter(item => item.day === day);
    if (!existing.some(item => item.sessionId === sessionId && item.scriptId === scriptId)) {
      existing.push({ sessionId, scriptId, day });
    }
    localStorage.setItem(scopedKey(KEY), JSON.stringify(existing.slice(-MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

/** No daily fallback: absent or invalid lesson identity MUST return no candidates. */
export function getPresentedFunctionalScripts(sessionId: unknown): PresentedFunctionalScript[] {
  if (!validSessionId(sessionId)) return [];
  return load().filter(item => item.day === today() && item.sessionId === sessionId);
}
