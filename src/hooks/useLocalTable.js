import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../config';

export default function useLocalTable(table) {
  const apiBase = API_BASE;
  const teacherToken = process.env.REACT_APP_TEACHER_TOKEN || '';
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const dataRef = useRef([]);
  const dirtyRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${apiBase}/${table}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const rows = await response.json();
        const safeRows = Array.isArray(rows) ? rows : [];
        dataRef.current = safeRows;
        setData(safeRows);
        setError(null);
        setDirty(false);
        dirtyRef.current = false;
      } catch (err) {
        console.error('Error fetching', table, err);
        setError(err);
      }
      setLoaded(true);
    }
    fetchData();
  }, [table, apiBase]);

  const update = useCallback((updater) => {
    setDirty(true);
    dirtyRef.current = true;
    const base = dataRef.current;
    const next = typeof updater === 'function' ? updater(base) : updater;
    dataRef.current = next;
    setData(next);
  }, []);

  const save = useCallback(async () => {
    if (!loaded || !dirtyRef.current) return { error: null };
    try {
      const snapshot = Array.isArray(dataRef.current) ? dataRef.current : [];
      const response = await fetch(`${apiBase}/${table}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(teacherToken ? { 'x-teacher-token': teacherToken } : {})
        },
        body: JSON.stringify(snapshot)
      });
      if (!response.ok) throw new Error('Failed to save');
      setDirty(false);
      dirtyRef.current = false;
      return { error: null };
    } catch (err) {
      console.error('Error saving', table, err);
      return { error: err };
    }
  }, [loaded, table, apiBase, teacherToken]);

  return [data, update, { save, loaded, error, dirty }];
}
