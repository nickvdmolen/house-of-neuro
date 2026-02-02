import { useCallback } from 'react';

// Singleton cache outside component to persist across renders
const refreshTimestamps = new Map();

export default function useRefreshCache() {
  const shouldRefresh = useCallback((key, maxAgeMs = 10000) => {
    const lastRefresh = refreshTimestamps.get(key);
    if (!lastRefresh) return true;
    return Date.now() - lastRefresh > maxAgeMs;
  }, []);

  const markRefreshed = useCallback((key) => {
    refreshTimestamps.set(key, Date.now());
  }, []);

  return { shouldRefresh, markRefreshed };
}
