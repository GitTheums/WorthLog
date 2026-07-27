import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  fetchAuthStatus,
  lockPortfolio,
  setPortfolioLockedHandler,
  unlockPortfolio,
} from '../api/client';
import type { AuthStatus } from '../api/types';
import { AuthContext, LOCKED_STATUS } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAuthStatus();
      setStatus(next);
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Could not check lock status';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const markLocked = useCallback(() => {
    setStatus((current) => {
      if (current && !current.pinEnabled) {
        return current;
      }
      return {
        ...(current ?? LOCKED_STATUS),
        pinEnabled: true,
        unlocked: false,
        sessionExpiresAt: null,
      };
    });
  }, []);

  useEffect(() => {
    setPortfolioLockedHandler(() => {
      markLocked();
    });
    return () => {
      setPortfolioLockedHandler(null);
    };
  }, [markLocked]);

  const unlock = useCallback(async (pin: string) => {
    const next = await unlockPortfolio(pin);
    setStatus(next);
  }, []);

  const lock = useCallback(async () => {
    await lockPortfolio();
    markLocked();
  }, [markLocked]);

  const applyStatus = useCallback((next: AuthStatus) => {
    setStatus(next);
  }, []);

  const value = useMemo(
    () => ({
      status,
      loading,
      error,
      pinEnabled: status?.pinEnabled ?? false,
      unlocked: status ? !status.pinEnabled || status.unlocked : false,
      refreshStatus,
      unlock,
      lock,
      markLocked,
      applyStatus,
    }),
    [
      status,
      loading,
      error,
      refreshStatus,
      unlock,
      lock,
      markLocked,
      applyStatus,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
