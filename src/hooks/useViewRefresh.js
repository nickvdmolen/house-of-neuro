import { useCallback } from 'react';
import useRefreshCache from './useRefreshCache';

export default function useViewRefresh() {
  const { shouldRefresh, markRefreshed } = useRefreshCache();

  const refreshOnViewChange = useCallback(
    async (viewKey, refetchFns, { maxAgeMs = 10000 } = {}) => {
      if (!viewKey) return;

      const cacheKey = `view:${viewKey}`;
      if (!shouldRefresh(cacheKey, maxAgeMs)) return;

      try {
        await Promise.all(
          Object.values(refetchFns)
            .filter((fn) => typeof fn === 'function')
            .map((fn) => fn())
        );
        markRefreshed(cacheKey);
      } catch (error) {
        console.error(`[refresh] Error refreshing ${viewKey}:`, error);
      }
    },
    [shouldRefresh, markRefreshed]
  );

  return { refreshOnViewChange };
}
