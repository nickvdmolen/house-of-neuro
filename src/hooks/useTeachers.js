import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    email: row.email ?? null,
    passwordHash: row.passwordHash ?? null,
    approved: row.approved ?? false,
    resetToken: row.resetToken ?? null,
  };
};

export default function useTeachers() {
  return useSupabaseTable('teachers', { autoSave: false, toDb });
}
