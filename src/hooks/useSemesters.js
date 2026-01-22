import useSupabaseTable from './useSupabaseTable';

export default function useSemesters() {
  return useSupabaseTable('semesters');
}
