import { createContext } from 'react';
import type { AuthStatus } from '../api/types';

export interface AuthContextValue {
  status: AuthStatus | null;
  loading: boolean;
  error: string | null;
  pinEnabled: boolean;
  unlocked: boolean;
  refreshStatus: () => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => Promise<void>;
  markLocked: () => void;
  applyStatus: (status: AuthStatus) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const LOCKED_STATUS: AuthStatus = {
  pinEnabled: true,
  unlocked: false,
  sessionExpiresAt: null,
};
