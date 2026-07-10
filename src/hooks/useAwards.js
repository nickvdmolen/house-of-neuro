import useSupabaseTable from './useSupabaseTable';

export const awardFromDb = (row) => (row?.mutation_meta?.noop ? null : row);

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

export default function useAwards(options = {}) {
  return useSupabaseTable('awards', {
    autoSave: false,
    fromDb: awardFromDb,
    toDb,
    allowDeletes: false,
    ...options,
    fetchPageSize: 500,
    fetchOrderBy: 'ts,id',
    preserveLocalRowsOnFetch: true,
  });
}
