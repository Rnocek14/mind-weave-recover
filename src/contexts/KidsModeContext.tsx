import { createContext, ReactNode, useContext, useEffect, useState } from "react";

/**
 * Kids Mode — an opt-in presentation layer for pediatric users.
 *
 * When enabled it:
 *   1. Adds a `kids-mode` class to <html>, which swaps the CSS design tokens
 *      (colors, radius, animations) defined in index.css. No component
 *      styles change, so turning it off restores the adult UI exactly.
 *   2. Signals games to pull kid-appropriate content packs (see
 *      src/data/kidsContent.ts). Clinician-targeted practice (focus
 *      phonemes / focus words) always wins over the kids pack.
 *
 * The flag is device-local (localStorage) and intentionally NOT written to
 * the patient profile or any telemetry: pediatric use has its own consent
 * story (COPPA/FERPA) that must be resolved before child data flows into
 * research export. Keeping it presentation-only keeps that boundary clean.
 */

export interface KidsModeContextValue {
  kidsMode: boolean;
  setKidsMode: (on: boolean) => void;
  toggleKidsMode: () => void;
}

export const KidsModeContext = createContext<KidsModeContextValue | null>(null);

const KIDS_MODE_KEY = "therapyPlatform_kidsMode";

const getInitialKidsMode = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KIDS_MODE_KEY) === "1";
  } catch {
    return false;
  }
};

export function KidsModeProvider({ children }: { children: ReactNode }) {
  const [kidsMode, setKidsModeState] = useState<boolean>(getInitialKidsMode);

  useEffect(() => {
    try {
      localStorage.setItem(KIDS_MODE_KEY, kidsMode ? "1" : "0");
    } catch {
      /* storage unavailable — mode still works for this tab */
    }
    const root = document.documentElement;
    root.classList.toggle("kids-mode", kidsMode);
    return () => {
      root.classList.remove("kids-mode");
    };
  }, [kidsMode]);

  const setKidsMode = (on: boolean) => setKidsModeState(on);
  const toggleKidsMode = () => setKidsModeState((prev) => !prev);

  return (
    <KidsModeContext.Provider value={{ kidsMode, setKidsMode, toggleKidsMode }}>
      {children}
    </KidsModeContext.Provider>
  );
}

/**
 * Non-throwing accessor: components and hooks rendered outside the provider
 * (unit tests, dev harnesses) get the adult default instead of crashing.
 */
export function useKidsMode(): KidsModeContextValue {
  const ctx = useContext(KidsModeContext);
  if (ctx) return ctx;
  return {
    kidsMode: false,
    setKidsMode: () => {},
    toggleKidsMode: () => {},
  };
}
