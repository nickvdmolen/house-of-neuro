import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, ensureSession } from '../supabase';

export default function useSupabaseTable(table, { autoSave = true } = {}) {
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const prevIds = useRef(new Set());

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
          setData(rows || []);
          prevIds.current = new Set((rows || []).map((r) => r.id));
          setError(null);
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
    setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const save = useCallback(async () => {
    if (!loaded || !dirty) return { error: null };
    await ensureSession();
    const ids = new Set(data.map((r) => r.id));
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
    if (data.length > 0) {
      const { error: upsertErr } = await supabase.from(table).upsert(data);
      if (upsertErr) {
        console.error('Error saving', table, upsertErr);
        if (!err) err = upsertErr;
      }
    }
    if (!err) {
      prevIds.current = ids;
      setDirty(false);
    }
    return { error: err };
  }, [data, table, loaded, dirty]);

  useEffect(() => {
    if (!autoSave || !dirty) return;
    save();
  }, [save, autoSave, dirty]);

  return [data, update, { save, dirty, error }];
}

