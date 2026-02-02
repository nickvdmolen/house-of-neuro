import useSupabaseTable from './useSupabaseTable';

const toDb = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name ?? null,
    email: row.email ?? null,
    password: row.password ?? null,
    semesterId: row.semesterId ?? null,
    groupId: row.groupId ?? null,
    points: row.points ?? 0,
    streakFreezeTotal: row.streakFreezeTotal ?? 2,
    badges: row.badges ?? [],
    photo: row.photo ?? null,
    bingo: row.bingo ?? {},
    bingoMatches: row.bingoMatches ?? {},
    lastWeekRewarded: row.lastWeekRewarded ?? null,
    showRankPublic: row.showRankPublic ?? true,
    tempCode: row.tempCode ?? null,
    resetToken: row.resetToken ?? null,
  };
};

export default function useStudents(options = {}) {
  return useSupabaseTable('students', { toDb, ...options });
}
