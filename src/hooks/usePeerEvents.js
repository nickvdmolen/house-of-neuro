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
  const cleaned = { ...row };
  const allowOwnGroup = row.allowOwnGroup ?? row.allow_own_group ?? false;
  const allowOtherGroups = row.allowOtherGroups ?? row.allow_other_groups ?? true;
  delete cleaned.allowOwnGroup;
  delete cleaned.allowOtherGroups;
  delete cleaned.allow_own_group;
  delete cleaned.allow_other_groups;
  return {
    ...cleaned,
    allow_own_group: allowOwnGroup,
    allow_other_groups: allowOtherGroups,
  };
};

export default function usePeerEvents() {
  return useSupabaseTable('peer_events', { autoSave: false, fromDb, toDb });
}
