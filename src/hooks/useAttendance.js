import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    meeting_id: row.meeting_id ?? null,
    student_id: row.student_id ?? null,
    present: row.present ?? false,
    streak_freeze: row.streak_freeze ?? false,
    marked_at: row.marked_at ?? null,
  };
};

export default function useAttendance(options = {}) {
  return useSupabaseTable('attendance', { autoSave: false, toDb, ...options });
}
