export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const EMAIL_RE = /@student\.nhlstenden\.com$/i;
export const emailValid = (email) => EMAIL_RE.test((email || '').trim());

export function getIndividualLeaderboard(students) {
  return [...students]
    .sort((a, b) => b.points - a.points)
    .map((s, i) => ({ rank: i + 1, ...s }));
}

export function getGroupLeaderboard(groups, students) {
  const stats = groups.map((g) => {
    const members = students.filter((s) => s.groupId === g.id);
    const size = members.length;
    const sum = members.reduce((acc, s) => acc + (Number(s.points) || 0), 0);
    const avgIndiv = size ? sum / size : 0;
    const bonus = Number(g.points) || 0;
    const total = avgIndiv + bonus;
    return { ...g, size, avgIndiv, bonus, total };
  });

  return stats
    .sort((a, b) => b.total - a.total)
    .map((g, i) => ({ rank: i + 1, ...g }));
}
