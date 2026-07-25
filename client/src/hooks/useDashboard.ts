import { useEffect, useRef, useState } from 'react';
import { ApiError, fetchDashboard } from '../api/client';
import type { DashboardData, DashboardRange } from '../api/types';

interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboard(range: DashboardRange | null): UseDashboardResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const dataRef = useRef<DashboardData | null>(null);
  dataRef.current = data;

  useEffect(() => {
    if (!range) {
      setLoading(true);
      return;
    }

    let active = true;
    const hasExisting = dataRef.current !== null;

    if (hasExisting) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    void fetchDashboard(range)
      .then((dashboard) => {
        if (!active) {
          return;
        }
        setData(dashboard);
        setLoading(false);
        setRefreshing(false);
        setError(null);
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
              : 'Failed to load dashboard';

        setError(message);
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [range, reloadKey]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => {
      setReloadKey((value) => value + 1);
    },
  };
}
