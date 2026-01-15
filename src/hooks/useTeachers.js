import useSupabaseTable from './useSupabaseTable';

export default function useTeachers() {
  return useSupabaseTable('teachers', { autoSave: false });
}
