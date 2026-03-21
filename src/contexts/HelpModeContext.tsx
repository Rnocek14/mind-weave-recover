import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface HelpModeContextType {
  helpMode: boolean;
  toggleHelpMode: () => void;
}

const HelpModeContext = createContext<HelpModeContextType>({
  helpMode: false,
  toggleHelpMode: () => {},
});

const STORAGE_KEY = 'neurospark-help-mode';

export function HelpModeProvider({ children }: { children: ReactNode }) {
  const [helpMode, setHelpMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(helpMode));
    } catch {}
  }, [helpMode]);

  const toggleHelpMode = () => setHelpMode(prev => !prev);

  return (
    <HelpModeContext.Provider value={{ helpMode, toggleHelpMode }}>
      {children}
    </HelpModeContext.Provider>
  );
}

export function useHelpMode() {
  return useContext(HelpModeContext);
}
