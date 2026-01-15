import useSupabaseTable from './useSupabaseTable';

export default function useAwards() {
  return useSupabaseTable('awards', { autoSave: false });
}
