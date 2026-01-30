import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    ts: row.ts ?? null,
    from_student_id: row.from_student_id ?? null,
    event_id: row.event_id ?? null,
    target: row.target ?? null,
    target_id: row.target_id ?? null,
    semesterId: row.semesterId ?? null,
    amount: row.amount ?? 0,
    total_amount: row.total_amount ?? 0,
    reason: row.reason ?? null,
    recipients: row.recipients ?? null,
    weekKey: row.weekKey ?? null,
  };
};

export default function usePeerAwards(options = {}) {
  return useSupabaseTable('peer_awards', { autoSave: false, toDb, ...options });
}
