import useSupabaseTable from './useSupabaseTable';

const fromDb = (row) => {
  if (!row) return row;
  const { allow_own_group, allow_other_groups, ...rest } = row;
  return {
    ...rest,
    allowOwnGroup: allow_own_group ?? row.allowOwnGroup,
    allowOtherGroups: allow_other_groups ?? row.allowOtherGroups,
  };
};

const toDb = (row) => {
  if (!row) return row;
  const { allowOwnGroup, allowOtherGroups, allow_own_group, allow_other_groups, ...rest } = row;
  return {
    ...rest,
    allow_own_group: allowOwnGroup,
    allow_other_groups: allowOtherGroups,
  };
};

export default function usePeerEvents() {
  return useSupabaseTable('peer_events', { autoSave: false, fromDb, toDb });
}
