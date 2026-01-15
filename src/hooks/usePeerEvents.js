import useSupabaseTable from './useSupabaseTable';

export default function usePeerEvents() {
  return useSupabaseTable('peer_events', { autoSave: false });
}
