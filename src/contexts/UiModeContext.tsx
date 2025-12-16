import { createContext, ReactNode, useState, useEffect } from "react";

export type UiMode = 'patient' | 'caregiver' | 'clinician' | 'admin';

export interface UiModeContextValue {
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
  toggleMode: () => void;
  isAtLeast: (mode: UiMode) => boolean;
}

export const UiModeContext = createContext<UiModeContextValue | null>(null);

interface UiModeProviderProps {
  children: ReactNode;
}

const UI_MODE_KEY = 'therapyPlatform_uiMode';

// Mode hierarchy: patient < caregiver < clinician < admin
const MODE_LEVELS: Record<UiMode, number> = {
  patient: 0,
  caregiver: 1,
  clinician: 2,
  admin: 3,
};

// Read from localStorage on init, validate, default to patient
const getInitialMode = (): UiMode => {
  if (typeof window === 'undefined') return 'patient';
  const stored = localStorage.getItem(UI_MODE_KEY) as UiMode | null;
  if (stored && stored in MODE_LEVELS) return stored;
  return 'patient';
};

export function UiModeProvider({ children }: UiModeProviderProps) {
  const [uiMode, setUiModeState] = useState<UiMode>(getInitialMode);

  // Persist to localStorage when mode changes
  useEffect(() => {
    localStorage.setItem(UI_MODE_KEY, uiMode);
  }, [uiMode]);

  const setUiMode = (mode: UiMode) => {
    setUiModeState(mode);
  };

  const toggleMode = () => {
    setUiModeState(prev => prev === 'patient' ? 'caregiver' : 'patient');
  };

  // Check if current mode is at least the specified level (for UI gating only)
  const isAtLeast = (mode: UiMode) => {
    return MODE_LEVELS[uiMode] >= MODE_LEVELS[mode];
  };

  return (
    <UiModeContext.Provider value={{ uiMode, setUiMode, toggleMode, isAtLeast }}>
      {children}
    </UiModeContext.Provider>
  );
}
