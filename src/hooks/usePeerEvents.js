import useSupabaseTable from './useSupabaseTable';

export const peerEventFromDb = (row) => {
  if (!row) return row;
  const { allow_own_group, allow_other_groups, ...rest } = row;
  const legacyScope = ['all', 'own_group', 'other_groups'].includes(
    row.recipientScope
  )
    ? row.recipientScope
    : null;
  return {
    ...rest,
    allowOwnGroup: legacyScope
      ? legacyScope === 'all' || legacyScope === 'own_group'
      : allow_own_group ?? row.allowOwnGroup ?? false,
    allowOtherGroups: legacyScope
      ? legacyScope === 'all' || legacyScope === 'other_groups'
      : allow_other_groups ?? row.allowOtherGroups ?? true,
  };
};

export const peerEventToDb = (row) => {
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

export default function usePeerEvents(options = {}) {
  return useSupabaseTable('peer_events', {
    autoSave: false,
    fromDb: peerEventFromDb,
    toDb: peerEventToDb,
    ...options,
  });
}
