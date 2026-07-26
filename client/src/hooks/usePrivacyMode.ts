import { useCallback, useEffect, useState } from 'react';
import {
  applyPrivacyMode,
  readPrivacyMode,
  writePrivacyMode,
  type PrivacyMode,
} from '../lib/privacy';

export function usePrivacyMode() {
  const [mode, setMode] = useState<PrivacyMode>(() => readPrivacyMode());
  const hidden = mode === 'hidden';

  useEffect(() => {
    applyPrivacyMode(mode);
    writePrivacyMode(mode);
  }, [mode]);

  const setHidden = useCallback((nextHidden: boolean) => {
    setMode(nextHidden ? 'hidden' : 'visible');
  }, []);

  const toggle = useCallback(() => {
    setMode((current) => (current === 'hidden' ? 'visible' : 'hidden'));
  }, []);

  return {
    mode,
    hidden,
    setHidden,
    toggle,
  };
}
