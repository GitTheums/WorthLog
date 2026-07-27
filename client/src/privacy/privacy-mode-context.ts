import { createContext } from 'react';
import type { PrivacyMode } from '../lib/privacy';

export interface PrivacyModeContextValue {
  mode: PrivacyMode;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
}

export const PrivacyModeContext =
  createContext<PrivacyModeContextValue | null>(null);
