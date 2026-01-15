import useSupabaseTable from './useSupabaseTable';

export default function useGroups() {
  return useSupabaseTable('groups');
}
