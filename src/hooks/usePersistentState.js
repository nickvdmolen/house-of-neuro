import { useState, useCallback } from 'react';

export default function usePersistentState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch { /* ignore */ }
    return initial;
  });

  const setPersistent = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  return [state, setPersistent];
}
