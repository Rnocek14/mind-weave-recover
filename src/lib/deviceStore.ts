/**
 * Device-store scoping — profile isolation for device-local data.
 *
 * The app supports multiple patient profiles per account (siblings, a
 * caregiver managing two survivors). Device-local stores that hold
 * per-patient data MUST be keyed by the active profile, or a profile
 * switch silently mixes one patient's practice/health history into
 * another's (audit finding, P0).
 *
 * Design:
 *  - ProfileContext calls setDeviceScope(profileId) whenever the active
 *    profile changes; the scope is mirrored to localStorage so reads that
 *    happen before React hydrates (module init, context initializers)
 *    still resolve the correct scope after a reload.
 *  - scopedKey(base) appends the scope: `base::<profileId>`.
 *  - One-time migration: legacy unscoped keys are adopted by the FIRST
 *    scope that reads them (correct for the single-profile installs that
 *    produced all legacy data) and the legacy key is removed.
 *  - clearSensitiveDeviceData() wipes every scoped + legacy sensitive key
 *    across ALL profiles — called on logout so shared/public computers
 *    don't leak the prior patient's data to the next user.
 */

const SCOPE_KEY = "deviceStore_activeScope";

let activeScope: string | null = null;

export function setDeviceScope(profileId: string | null): void {
  activeScope = profileId;
  try {
    if (profileId) localStorage.setItem(SCOPE_KEY, profileId);
    else localStorage.removeItem(SCOPE_KEY);
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new CustomEvent("device-scope-changed", { detail: { profileId } }));
  } catch {
    /* non-browser */
  }
}

export function getDeviceScope(): string {
  if (activeScope) return activeScope;
  try {
    const stored = localStorage.getItem(SCOPE_KEY);
    if (stored) {
      activeScope = stored;
      return stored;
    }
  } catch {
    /* storage unavailable */
  }
  return "default";
}

/**
 * Profile-scoped storage key with one-time legacy adoption: if the scoped
 * key doesn't exist yet but the legacy unscoped key does, the legacy value
 * is moved into the current scope (single-profile installs keep their data).
 */
export function scopedKey(base: string): string {
  const key = `${base}::${getDeviceScope()}`;
  try {
    if (localStorage.getItem(key) === null) {
      const legacy = localStorage.getItem(base);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(base);
      }
    }
  } catch {
    /* storage unavailable */
  }
  return key;
}

/** Base names of every sensitive device-local store (scoped or legacy). */
const SENSITIVE_KEY_PREFIXES = [
  "transferLedger_v1",
  "reviewQueue_practicedWords",
  "kidsMode_pet",
  "kidsMode_totalStars",
  "therapyPlatform_kidsMode",
  "sessionSignalHistory",
  "game_history_",
  "recoveryGoals",
  "lessonFlowState_resume",
  SCOPE_KEY,
];

/**
 * Wipe sensitive per-patient device data for ALL profiles. Called on
 * logout: on a shared computer, the next user must not inherit the prior
 * patient's practiced words, struggle flags, or health history.
 * (Deliberately does NOT touch `local_sessions`/`local_events` — those are
 * pre-account guest data owned by the account-upgrade migration flow.)
 */
export function clearSensitiveDeviceData(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (SENSITIVE_KEY_PREFIXES.some((p) => key === p || key.startsWith(`${p}::`) || key.startsWith(p))) {
        doomed.push(key);
      }
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
  activeScope = null;
}
