import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../config';

export default function useServerState(resource, initial) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    fetch(apiUrl(resource))
      .then((res) => res.json())
      .then((data) => setState(data))
      .catch(() => {
        // ignore fetch errors
      });
  }, [resource]);

  const update = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        fetch(apiUrl(resource), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {
          // ignore network errors
        });
        return next;
      });
    },
    [resource]
  );

  return [state, update];
}
