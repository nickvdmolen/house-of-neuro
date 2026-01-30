import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    ts: row.ts ?? null,
    target: row.target ?? null,
    target_id: row.target_id ?? null,
    semesterId: row.semesterId ?? null,
    amount: row.amount ?? 0,
    reason: row.reason ?? null,
  };
};

export default function useAwards() {
  return useSupabaseTable('awards', { autoSave: false, toDb });
}
