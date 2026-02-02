import useSupabaseTable from './useSupabaseTable';

const fromDb = (row) => {
  if (!row) return row;
  const { created_by, created_at, ...rest } = row;
  return {
    ...rest,
    createdBy: created_by ?? row.createdBy ?? null,
    created_at: created_at ?? row.created_at ?? null,
  };
};

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title,
    points: row.points ?? 0,
    description: row.description ?? null,
    active: row.active ?? true,
    created_by: row.createdBy ?? row.created_by ?? null,
    created_at: row.created_at ?? null,
  };
};

export default function useAnnouncements(options = {}) {
  return useSupabaseTable('announcements', { autoSave: false, fromDb, toDb, ...options });
}
