import { useState, useEffect, useCallback } from 'react';

export default function useServerState(key, seed = []) {
  const [state, setState] = useState(seed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/${key}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setState(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const persist = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const headers = { 'Content-Type': 'application/json' };
        try {
          const token = localStorage.getItem('nm_teacher_token');
          if (token) headers['x-teacher-token'] = token;
        } catch {
          // ignore
        }

        const prevMap = new Map(prev.map((item) => [item.id, item]));
        const added = next.filter((item) => !prevMap.has(item.id));
        if (added.length) {
          fetch(`/api/${key}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(added),
          });
        }
        fetch(`/api/${key}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(next),
        });
        return next;
      });
    },
    [key]
  );

  return [state, persist, loading, error];
}
