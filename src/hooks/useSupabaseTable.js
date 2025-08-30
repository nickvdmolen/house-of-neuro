import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export default function useSupabaseTable(table) {
  const [data, setData] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      const { data: rows, error } = await supabase.from(table).select('*');
      if (!ignore) {
        if (error) {
          console.error('Error fetching', table, error);
        } else {
          setData(rows || []);
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
      await supabase.from(table).delete().neq('id', 0);
      if (data.length > 0) {
        await supabase.from(table).insert(data);
      }
    }
    save();
    setDirty(false);
  }, [data, table, loaded, dirty]);

  return [data, update];
}
