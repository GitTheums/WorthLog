import type { ReactNode } from 'react';
import { usePrivacyMode } from '../hooks/usePrivacyMode';
import { PrivacyModeContext } from './privacy-mode-context';

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const value = usePrivacyMode();
  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
}
