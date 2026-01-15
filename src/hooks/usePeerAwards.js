import useSupabaseTable from './useSupabaseTable';

export default function usePeerAwards() {
  return useSupabaseTable('peer_awards', { autoSave: false });
}
