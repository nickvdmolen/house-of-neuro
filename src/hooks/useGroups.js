import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name ?? null,
    semesterId: row.semesterId ?? null,
    points: row.points ?? 0,
  };
};

export default function useGroups(options = {}) {
  return useSupabaseTable('groups', { autoSave: false, toDb, ...options });
}
