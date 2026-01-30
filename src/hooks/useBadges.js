import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title ?? null,
    image: row.image ?? null,
    requirement: row.requirement ?? null,
  };
};

export default function useBadges() {
  return useSupabaseTable('badge_defs', { autoSave: false, toDb });
}
