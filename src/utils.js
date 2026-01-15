export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const EMAIL_RE = /@student\.nhlstenden\.com$/i;
export const emailValid = (email) => EMAIL_RE.test((email || '').trim());

const TEACHER_EMAIL_RE = /@nhlstenden\.com$/i;
export const teacherEmailValid = (email) => TEACHER_EMAIL_RE.test((email || '').trim());

export function nameFromEmail(email) {
  const prefix = (email || '').split('@')[0];
  const parts = prefix.split('.').filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase();
      if (i === 0 || i === parts.length - 1) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(' ');
}

export function getWeekKey(date = new Date()) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

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
