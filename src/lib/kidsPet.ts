/**
 * Kids practice pet — the dose engine.
 *
 * A creature the child owns that grows with practice. Every correct answer
 * across Kids Mode games feeds it XP; consecutive practice days build a
 * streak. Evolution stages give long-horizon progression that per-trial
 * rewards can't sustain.
 *
 * Deliberately DEVICE-LOCAL (localStorage, no Supabase, no telemetry):
 * child data must not leave the device until the pediatric consent story
 * (COPPA/FERPA) is resolved. Pure functions + a thin storage wrapper so the
 * logic is unit-testable.
 *
 * The pet never punishes: a missed day pauses the streak, it never drains
 * XP or makes the pet sick. Pediatric SLP guidance is consistent that
 * reward withdrawal backfires with this population.
 */

export interface KidsPetState {
  name: string;
  xp: number;
  /** ISO date (YYYY-MM-DD, local) of the last day practice fed the pet. */
  lastFedDay: string | null;
  /** Consecutive practice days including lastFedDay. */
  streakDays: number;
}

export interface KidsPetStage {
  stage: number;
  label: string;
  emoji: string;
  /** XP needed to reach this stage. */
  minXp: number;
}

/** Evolution ladder. XP thresholds assume ~8-15 XP per short session. */
export const PET_STAGES: readonly KidsPetStage[] = [
  { stage: 0, label: "Mystery Egg", emoji: "🥚", minXp: 0 },
  { stage: 1, label: "Hatchling", emoji: "🐣", minXp: 20 },
  { stage: 2, label: "Chatterbug", emoji: "🐛", minXp: 60 },
  { stage: 3, label: "Wordwing", emoji: "🦋", minXp: 140 },
  { stage: 4, label: "Talkasaurus", emoji: "🦖", minXp: 280 },
  { stage: 5, label: "Star Dragon", emoji: "🐉", minXp: 500 },
];

export function getPetStage(xp: number): KidsPetStage {
  let current = PET_STAGES[0];
  for (const s of PET_STAGES) {
    if (xp >= s.minXp) current = s;
  }
  return current;
}

export function getNextPetStage(xp: number): KidsPetStage | null {
  for (const s of PET_STAGES) {
    if (xp < s.minXp) return s;
  }
  return null;
}

/** 0..1 progress from the current stage toward the next (1 when maxed). */
export function getPetStageProgress(xp: number): number {
  const current = getPetStage(xp);
  const next = getNextPetStage(xp);
  if (!next) return 1;
  const span = next.minXp - current.minXp;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (xp - current.minXp) / span));
}

/**
 * Apply earned XP for a practice moment on `day` (local YYYY-MM-DD).
 * Pure — returns the next state. Streak: +1 when the previous fed day was
 * yesterday, unchanged when it's the same day, reset to 1 after a gap
 * (pause, not punishment — XP is never reduced).
 */
export function feedPet(prev: KidsPetState, earnedXp: number, day: string): KidsPetState {
  const xp = prev.xp + Math.max(0, Math.round(earnedXp));
  if (prev.lastFedDay === day) {
    return { ...prev, xp };
  }
  const streakDays = prev.lastFedDay === previousDay(day) ? prev.streakDays + 1 : 1;
  return { ...prev, xp, lastFedDay: day, streakDays };
}

export function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function localDayString(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

// ─── Storage (thin, guarded) ───────────────────────────────────────────────

const PET_KEY = "kidsMode_pet";

export const DEFAULT_PET: KidsPetState = {
  name: "Momo",
  xp: 0,
  lastFedDay: null,
  streakDays: 0,
};

export function loadPet(): KidsPetState {
  try {
    const raw = localStorage.getItem(PET_KEY);
    if (!raw) return { ...DEFAULT_PET };
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : DEFAULT_PET.name,
      xp: Number.isFinite(parsed.xp) && parsed.xp >= 0 ? parsed.xp : 0,
      lastFedDay: typeof parsed.lastFedDay === "string" ? parsed.lastFedDay : null,
      streakDays: Number.isFinite(parsed.streakDays) && parsed.streakDays >= 0 ? parsed.streakDays : 0,
    };
  } catch {
    return { ...DEFAULT_PET };
  }
}

export function savePet(pet: KidsPetState): void {
  try {
    localStorage.setItem(PET_KEY, JSON.stringify(pet));
  } catch {
    /* storage unavailable — pet lives for the tab only */
  }
}

/** Convenience: load → feed → save → return {next, leveledUp}. */
export function awardPetXp(earnedXp: number, now: Date = new Date()): {
  pet: KidsPetState;
  leveledUp: boolean;
  stage: KidsPetStage;
} {
  const prev = loadPet();
  const prevStage = getPetStage(prev.xp).stage;
  const pet = feedPet(prev, earnedXp, localDayString(now));
  savePet(pet);
  const stage = getPetStage(pet.xp);
  return { pet, leveledUp: stage.stage > prevStage, stage };
}
