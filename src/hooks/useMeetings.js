import useSupabaseTable from './useSupabaseTable';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toDb = (row) => {
  if (!row) return row;
  const cleaned = { ...row };
  const createdBy = row.created_by ?? row.createdBy ?? null;
  delete cleaned.created_by;
  delete cleaned.createdBy;
  if (typeof createdBy === 'string' && UUID_RE.test(createdBy.trim())) {
    return { ...cleaned, created_by: createdBy.trim() };
  }
  return { ...cleaned, created_by: null };
};

export default function useMeetings() {
  return useSupabaseTable('meetings', { autoSave: false, toDb });
}
