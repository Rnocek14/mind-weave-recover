import { createContext, ReactNode, useState, useEffect } from "react";

export type UiMode = 'patient' | 'caregiver';

export interface UiModeContextValue {
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
  toggleMode: () => void;
}

export const UiModeContext = createContext<UiModeContextValue | null>(null);

interface UiModeProviderProps {
  children: ReactNode;
}

const UI_MODE_KEY = 'therapyPlatform_uiMode';

export function UiModeProvider({ children }: UiModeProviderProps) {
  // Always start in patient mode - caregiver can toggle when needed
  const [uiMode, setUiModeState] = useState<UiMode>('patient');

  useEffect(() => {
    // Persist to localStorage whenever mode changes
    localStorage.setItem(UI_MODE_KEY, uiMode);
  }, [uiMode]);

  const setUiMode = (mode: UiMode) => {
    setUiModeState(mode);
  };

  const toggleMode = () => {
    setUiModeState(prev => prev === 'patient' ? 'caregiver' : 'patient');
  };

  return (
    <UiModeContext.Provider value={{ uiMode, setUiMode, toggleMode }}>
      {children}
    </UiModeContext.Provider>
  );
}
