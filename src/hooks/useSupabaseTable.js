import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, ensureSession } from '../supabase';

const identity = (row) => row;

export default function useSupabaseTable(
  table,
  { autoSave = true, fromDb = identity, toDb = identity, enabled = true } = {}
) {
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const prevIds = useRef(new Set());
  const dataRef = useRef([]);
  const dirtyRef = useRef(false);
  const fromDbRef = useRef(fromDb);
  const toDbRef = useRef(toDb);
  const enabledRef = useRef(enabled);

  fromDbRef.current = fromDb;
  toDbRef.current = toDb;
  enabledRef.current = enabled;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let ignore = false;
    if (!enabled) {
      dataRef.current = [];
      setData([]);
      prevIds.current = new Set();
      setError(null);
      setDirty(false);
      dirtyRef.current = false;
      setLoaded(false);
      return () => {
        ignore = true;
      };
    }
    async function fetchData() {
      try {
        await ensureSession();
        const { data: rows, error: fetchErr } = await supabase.from(table).select('*');
        if (!ignore) {
          if (fetchErr) {
            console.error('Error fetching', table, fetchErr);
            setError(fetchErr);
          } else {
            const safeRows = Array.isArray(rows)
              ? rows.map((row) => fromDbRef.current(row))
              : [];
            dataRef.current = safeRows;
            setData(safeRows);
            prevIds.current = new Set(safeRows.map((r) => r?.id).filter(Boolean));
            setError(null);
            setDirty(false);
            dirtyRef.current = false;
          }
          setLoaded(true);
        }
      } catch (err) {
        console.error('Error loading', table, err);
        if (!ignore) {
          setError(err);
          setLoaded(true);
        }
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [table, enabled]);

  const update = useCallback((updater) => {
    setDirty(true);
    dirtyRef.current = true;
    const base = dataRef.current;
    const next = typeof updater === 'function' ? updater(base) : updater;
    dataRef.current = next;
    setData(next);
  }, []);

  const save = useCallback(async () => {
    if (!enabledRef.current || !loaded || !dirtyRef.current) return { error: null };
    try {
      await ensureSession();
    } catch (err) {
      console.error('Session error saving', table, err);
      return { error: err };
    }
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
      const payload = snapshot.map((row) => toDbRef.current(row));
      const { error: upsertErr } = await supabase.from(table).upsert(payload);
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
    if (!enabledRef.current) return { error: null };
    try {
      await ensureSession();
      const { data: rows, error: fetchErr } = await supabase.from(table).select('*');
      if (fetchErr) {
        console.error('Error refetching', table, fetchErr);
        setError(fetchErr);
      } else {
        const safeRows = Array.isArray(rows)
          ? rows.map((row) => fromDbRef.current(row))
          : [];
        dataRef.current = safeRows;
        setData(safeRows);
        prevIds.current = new Set(safeRows.map((r) => r?.id).filter(Boolean));
        setError(null);
        setDirty(false);
        dirtyRef.current = false;
      }
    } catch (err) {
      console.error('Error refetching', table, err);
      setError(err);
    }
  }, [table]);

  useEffect(() => {
    if (!enabled || !autoSave || !dirty) return;
    save();
  }, [save, enabled, autoSave, dirty]);

  return [data, update, { save, dirty, error, refetch, loaded }];
}
