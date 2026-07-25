import { useEffect, useState } from 'react';
import { ApiError, fetchSettings } from '../api/client';
import type { AppSettings } from '../api/types';

interface UseSettingsResult {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchSettings()
      .then((value) => {
        if (!active) {
          return;
        }
        setSettings(value);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }

        const message =
          caught instanceof ApiError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : 'Failed to load settings';

        setError(message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return {
    settings,
    loading,
    error,
    reload: () => {
      setReloadKey((value) => value + 1);
    },
  };
}
