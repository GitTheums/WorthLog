import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { usePrivacyMode } from '../hooks/usePrivacyMode';
import type { PrivacyMode } from '../lib/privacy';

interface PrivacyModeContextValue {
  mode: PrivacyMode;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const value = usePrivacyMode();
  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyModeContext(): PrivacyModeContextValue {
  const value = useContext(PrivacyModeContext);
  if (!value) {
    throw new Error('usePrivacyModeContext must be used within PrivacyModeProvider');
  }
  return value;
}
