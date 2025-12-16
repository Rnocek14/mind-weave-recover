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

export function UiModeProvider({ children }: UiModeProviderProps) {
  // Always start in patient mode
  const [uiMode, setUiModeState] = useState<UiMode>('patient');

  useEffect(() => {
    localStorage.setItem(UI_MODE_KEY, uiMode);
  }, [uiMode]);

  const setUiMode = (mode: UiMode) => {
    setUiModeState(mode);
  };

  const toggleMode = () => {
    setUiModeState(prev => prev === 'patient' ? 'caregiver' : 'patient');
  };

  // Check if current mode is at least the specified level
  const isAtLeast = (mode: UiMode) => {
    return MODE_LEVELS[uiMode] >= MODE_LEVELS[mode];
  };

  return (
    <UiModeContext.Provider value={{ uiMode, setUiMode, toggleMode, isAtLeast }}>
      {children}
    </UiModeContext.Provider>
  );
}
