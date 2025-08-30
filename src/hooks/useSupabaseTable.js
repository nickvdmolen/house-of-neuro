import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';

export default function useSupabaseTable(table) {
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const prevIds = useRef(new Set());

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      const { data: rows, error } = await supabase.from(table).select('*');
      if (!ignore) {
        if (error) {
          console.error('Error fetching', table, error);
        } else {
          setData(rows || []);
          prevIds.current = new Set((rows || []).map((r) => r.id));
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

  useEffect(() => {
    if (!loaded || !dirty) return;
    async function save() {
      const ids = new Set(data.map((r) => r.id));
      const toDelete = [...prevIds.current].filter((id) => !ids.has(id));
      if (toDelete.length) {
        const { error } = await supabase.from(table).delete().in('id', toDelete);
        if (error) console.error('Error deleting from', table, error);
      }
      if (data.length > 0) {
        const { error } = await supabase.from(table).upsert(data);
        if (error) console.error('Error saving', table, error);
      }
      prevIds.current = ids;
    }
    save();
    setDirty(false);
  }, [data, table, loaded, dirty]);

  return [data, update];
}
