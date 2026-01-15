import useSupabaseTable from './useSupabaseTable';

export default function useMeetings() {
  return useSupabaseTable('meetings', { autoSave: false });
}
