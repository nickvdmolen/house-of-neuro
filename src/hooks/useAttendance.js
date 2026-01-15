import useSupabaseTable from './useSupabaseTable';

export default function useAttendance() {
  return useSupabaseTable('attendance', { autoSave: false });
}
