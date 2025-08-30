import useSupabaseTable from './useSupabaseTable';

export default function useStudents() {
  return useSupabaseTable('students');
}
