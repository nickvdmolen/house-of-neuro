import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, ensureSession } from '../supabase';

export default function useSupabaseTable(table, { autoSave = true } = {}) {
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const prevIds = useRef(new Set());
  const dataRef = useRef([]);
  const dirtyRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      await ensureSession();
      const { data: rows, error: fetchErr } = await supabase
        .from(table)
        .select('*');
      if (!ignore) {
        if (fetchErr) {
          console.error('Error fetching', table, fetchErr);
          setError(fetchErr);
        } else {
          const safeRows = Array.isArray(rows) ? rows : [];
          dataRef.current = safeRows;
          setData(safeRows);
          prevIds.current = new Set(safeRows.map((r) => r?.id).filter(Boolean));
          setError(null);
          setDirty(false);
          dirtyRef.current = false;
        }
        setLoaded(true);
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [table]);

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
    await ensureSession();
    const snapshot = Array.isArray(dataRef.current) ? dataRef.current : [];
    const ids = new Set(snapshot.map((r) => r?.id).filter(Boolean));
    const toDelete = [...prevIds.current].filter((id) => !ids.has(id));
    let err = null;
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from(table)
        .delete()
        .in('id', toDelete);
      if (delErr) {
        console.error('Error deleting from', table, delErr);
        err = delErr;
      }
    }
    if (snapshot.length > 0) {
      const { error: upsertErr } = await supabase.from(table).upsert(snapshot);
      if (upsertErr) {
        console.error('Error saving', table, upsertErr);
        if (!err) err = upsertErr;
      }
    }
    if (!err) {
      prevIds.current = ids;
      setDirty(false);
      dirtyRef.current = false;
    }
    return { error: err };
  }, [table, loaded]);

  const refetch = useCallback(async () => {
    await ensureSession();
    const { data: rows, error: fetchErr } = await supabase
      .from(table)
      .select('*');
    if (fetchErr) {
      console.error('Error refetching', table, fetchErr);
      setError(fetchErr);
    } else {
      const safeRows = Array.isArray(rows) ? rows : [];
      dataRef.current = safeRows;
      setData(safeRows);
      prevIds.current = new Set(safeRows.map((r) => r?.id).filter(Boolean));
      setError(null);
      setDirty(false);
      dirtyRef.current = false;
    }
  }, [table]);

  useEffect(() => {
    if (!autoSave || !dirty) return;
    save();
  }, [save, autoSave, dirty]);

  return [data, update, { save, dirty, error, refetch, loaded }];
}
