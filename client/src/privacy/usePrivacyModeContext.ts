import { useContext } from 'react';
import {
  PrivacyModeContext,
  type PrivacyModeContextValue,
} from './privacy-mode-context';

export function usePrivacyModeContext(): PrivacyModeContextValue {
  const value = useContext(PrivacyModeContext);
  if (!value) {
    throw new Error(
      'usePrivacyModeContext must be used within PrivacyModeProvider',
    );
  }
  return value;
}
