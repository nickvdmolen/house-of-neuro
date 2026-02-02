import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    date: row.date,
    time: row.time ?? null,
    title: row.title,
    semesterId: row.semesterId ?? null,
    created_by: null,
    created_at: row.created_at ?? null,
  };
};

export default function useMeetings(options = {}) {
  return useSupabaseTable('meetings', { autoSave: false, toDb, ...options });
}
