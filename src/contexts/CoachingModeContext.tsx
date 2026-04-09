/**
 * CoachingMode Context
 * 
 * Controls how much guidance the session provides:
 * - off: pure adaptive games, no narration/reflections/transfer
 * - light: purpose text on preview, micro-reflections via toast, transfer suggestion on summary
 * - full: continuity opener, richer reflections, transfer suggestion, progress insights
 * 
 * Default: light. Persisted in localStorage.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type CoachingMode = 'off' | 'light' | 'full';

interface CoachingModeContextValue {
  mode: CoachingMode;
  setMode: (mode: CoachingMode) => void;
  /** Whether purpose/reflections should show */
  showPurpose: boolean;
  /** Whether continuity opener should show */
  showContinuity: boolean;
  /** Whether transfer suggestion should appear on summary */
  showTransferOnSummary: boolean;
  /** Whether Maya should auto-speak intros, instructions, transitions */
  shouldAutoSpeak: boolean;
  /** Whether Maya should auto-read stories/questions/stimuli */
  shouldAutoReadContent: boolean;
  /** Whether voice is the primary interface (UI simplification) */
  isVoiceLed: boolean;
}

const CoachingModeContext = createContext<CoachingModeContextValue | null>(null);

const STORAGE_KEY = 'coaching-mode';

export function CoachingModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<CoachingMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'off' || saved === 'light' || saved === 'full') return saved;
    } catch {}
    return 'light';
  });

  const setMode = useCallback((m: CoachingMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  }, []);

  const value: CoachingModeContextValue = {
    mode,
    setMode,
    showPurpose: mode === 'light' || mode === 'full',
    showContinuity: mode === 'full',
    showTransferOnSummary: mode === 'light' || mode === 'full',
  };

  return (
    <CoachingModeContext.Provider value={value}>
      {children}
    </CoachingModeContext.Provider>
  );
}

export function useCoachingMode(): CoachingModeContextValue {
  const ctx = useContext(CoachingModeContext);
  if (!ctx) throw new Error('useCoachingMode must be used within CoachingModeProvider');
  return ctx;
}
