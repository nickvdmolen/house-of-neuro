import useSupabaseTable from './useSupabaseTable';

export default function useBadges() {
  return useSupabaseTable('badge_defs', { autoSave: false });
}
