import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, ensureSession } from '../supabase';
import fetchTableRows from './fetchTableRows';

const identity = (row) => row;

const mergeProtectedInsertRows = (fetchedRows, protectedRows) => {
  const merged = [...fetchedRows];
  const ids = new Set(merged.map((row) => row?.id).filter(Boolean));
  protectedRows.forEach((row) => {
    if (row?.id && ids.has(row.id)) {
      protectedRows.delete(row);
      return;
    }
    if (row?.id) ids.add(row.id);
    merged.push(row);
  });
  return merged;
};

export default function useSupabaseTable(
  table,
  {
    autoSave = true,
    fromDb = identity,
    toDb = identity,
    enabled = true,
    allowDeletes = true,
    fetchPageSize = null,
    fetchOrderBy = 'id',
    preserveLocalRowsOnFetch = false,
  } = {}
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
  const fetchRequestIdRef = useRef(0);
  const protectedInsertRowsRef = useRef(new Set());

  fromDbRef.current = fromDb;
  toDbRef.current = toDb;
  enabledRef.current = enabled;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    protectedInsertRowsRef.current.clear();
  }, [table]);

  useEffect(() => {
    if (!preserveLocalRowsOnFetch) {
      protectedInsertRowsRef.current.clear();
    }
  }, [preserveLocalRowsOnFetch]);

  useEffect(() => {
    let ignore = false;
    const requestId = ++fetchRequestIdRef.current;
    if (!enabled) {
      dataRef.current = [];
      setData([]);
      prevIds.current = new Set();
      setError(null);
      setDirty(false);
      dirtyRef.current = false;
      protectedInsertRowsRef.current.clear();
      setLoaded(false);
      return () => {
        ignore = true;
      };
    }
    async function fetchData() {
      try {
        await ensureSession();
        const { data: rows, error: fetchErr } = await fetchTableRows(
          supabase,
          table,
          fetchPageSize,
          fetchOrderBy
        );
        if (!ignore && requestId === fetchRequestIdRef.current) {
          if (fetchErr) {
            console.error('Error fetching', table, fetchErr);
            setError(fetchErr);
          } else {
            const fetchedRows = Array.isArray(rows)
              ? rows.map((row) => fromDbRef.current(row)).filter(Boolean)
              : [];
            const safeRows = preserveLocalRowsOnFetch
              ? mergeProtectedInsertRows(
                  fetchedRows,
                  protectedInsertRowsRef.current
                )
              : fetchedRows;
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
        if (!ignore && requestId === fetchRequestIdRef.current) {
          setError(err);
          setLoaded(true);
        }
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [
    table,
    enabled,
    fetchPageSize,
    fetchOrderBy,
    preserveLocalRowsOnFetch,
  ]);

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
    if (allowDeletes && toDelete.length) {
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

  const patchRow = useCallback(async (id, changesOrUpdater) => {
    if (!enabledRef.current || !id) return { error: null };
    const currentRow = dataRef.current.find((r) => r.id === id);
    if (!currentRow) return { error: new Error(`Row ${id} not found`) };
    const changes =
      typeof changesOrUpdater === 'function'
        ? changesOrUpdater(currentRow)
        : changesOrUpdater;
    if (!changes || Object.keys(changes).length === 0) return { error: null };

    // Update local state immediately (without marking dirty)
    const next = dataRef.current.map((row) =>
      row.id === id ? { ...row, ...changes } : row
    );
    dataRef.current = next;
    setData(next);

    // Persist only the changed fields to the database
    try {
      await ensureSession();
      const { error } = await supabase.from(table).update(changes).eq('id', id);
      if (error) {
        console.error('Error patching', table, id, error);
        return { error };
      }
      return { error: null };
    } catch (err) {
      console.error('Error patching', table, id, err);
      return { error: err };
    }
  }, [table]);

  const insertRows = useCallback(async (rows) => {
    const entries = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!enabledRef.current || entries.length === 0) return { error: null };

    // Update local state immediately (without marking dirty)
    if (preserveLocalRowsOnFetch) {
      entries.forEach((row) => protectedInsertRowsRef.current.add(row));
    }
    const insertedIds = new Set(entries.map((row) => row?.id).filter(Boolean));
    const insertedEntries = new Set(entries);
    const next = [...dataRef.current, ...entries];
    dataRef.current = next;
    setData(next);

    const rollback = () => {
      entries.forEach((row) => protectedInsertRowsRef.current.delete(row));
      const rolledBack = dataRef.current.filter((row) => !insertedEntries.has(row));
      dataRef.current = rolledBack;
      insertedIds.forEach((id) => {
        if (!rolledBack.some((row) => row?.id === id)) {
          prevIds.current.delete(id);
        }
      });
      setData(rolledBack);
    };

    // Insert only these rows into the database
    try {
      await ensureSession();
      const payload = entries.map((row) => toDbRef.current(row));
      const { error } = await supabase.from(table).insert(payload);
      if (error) {
        console.error('Error inserting into', table, error);
        rollback();
        return { error };
      }
      insertedIds.forEach((id) => prevIds.current.add(id));
      return { error: null };
    } catch (err) {
      console.error('Error inserting into', table, err);
      rollback();
      return { error: err };
    }
  }, [table, preserveLocalRowsOnFetch]);

  const insertRow = useCallback(
    async (row) => insertRows(row ? [row] : []),
    [insertRows]
  );

  const deleteRow = useCallback(async (id) => {
    if (!enabledRef.current || !id) return { error: null };

    // Update local state immediately (without marking dirty)
    const next = dataRef.current.filter((row) => row.id !== id);
    dataRef.current = next;
    prevIds.current.delete(id);
    setData(next);

    // Delete only this row from the database
    try {
      await ensureSession();
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        console.error('Error deleting from', table, id, error);
        return { error };
      }
      return { error: null };
    } catch (err) {
      console.error('Error deleting from', table, id, err);
      return { error: err };
    }
  }, [table]);

  const refetch = useCallback(async () => {
    if (!enabledRef.current) return { error: null };
    const requestId = ++fetchRequestIdRef.current;
    try {
      await ensureSession();
      const { data: rows, error: fetchErr } = await fetchTableRows(
        supabase,
        table,
        fetchPageSize,
        fetchOrderBy
      );
      if (requestId !== fetchRequestIdRef.current) {
        return { error: null, stale: true };
      }
      if (fetchErr) {
        console.error('Error refetching', table, fetchErr);
        setError(fetchErr);
      } else {
        const fetchedRows = Array.isArray(rows)
          ? rows.map((row) => fromDbRef.current(row)).filter(Boolean)
          : [];
        const safeRows = preserveLocalRowsOnFetch
          ? mergeProtectedInsertRows(
              fetchedRows,
              protectedInsertRowsRef.current
            )
          : fetchedRows;
        dataRef.current = safeRows;
        setData(safeRows);
        prevIds.current = new Set(safeRows.map((r) => r?.id).filter(Boolean));
        setError(null);
        setDirty(false);
        dirtyRef.current = false;
      }
      setLoaded(true);
      return { error: fetchErr || null };
    } catch (err) {
      if (requestId === fetchRequestIdRef.current) {
        console.error('Error refetching', table, err);
        setError(err);
        setLoaded(true);
      }
      return { error: err };
    }
  }, [table, fetchPageSize, fetchOrderBy, preserveLocalRowsOnFetch]);

  useEffect(() => {
    if (!enabled || !autoSave || !dirty) return;
    save();
  }, [save, enabled, autoSave, dirty]);

  return [
    data,
    update,
    {
      save,
      dirty,
      error,
      refetch,
      loaded,
      patchRow,
      insertRow,
      insertRows,
      deleteRow,
    },
  ];
}
