import useSupabaseTable from './useSupabaseTable';

const fromDb = (row) => {
  if (!row) return row;
  const { allow_own_group, allow_other_groups, ...rest } = row;
  return {
    ...rest,
    allowOwnGroup: allow_own_group ?? row.allowOwnGroup ?? false,
    allowOtherGroups: allow_other_groups ?? row.allowOtherGroups ?? true,
  };
};

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    budget: row.budget ?? 0,
    active: row.active ?? true,
    allow_own_group: row.allowOwnGroup ?? row.allow_own_group ?? false,
    allow_other_groups: row.allowOtherGroups ?? row.allow_other_groups ?? true,
    semesterId: row.semesterId ?? null,
    created_at: row.created_at ?? null,
  };
};

export default function usePeerEvents() {
  return useSupabaseTable('peer_events', { autoSave: false, fromDb, toDb });
}
