export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const DEFAULT_STREAK_FREEZES = 2;

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

const parseSemesterDate = (value, isEnd = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

export function getActiveSemesterId(semesters, now = new Date()) {
  if (!Array.isArray(semesters) || semesters.length === 0) return null;
  const nowTime = now.getTime();
  const candidates = semesters
    .map((semester) => {
      const start = parseSemesterDate(semester?.startDate);
      const end = parseSemesterDate(semester?.endDate, true);
      if (!start && !end) return null;
      if (start && nowTime < start.getTime()) return null;
      if (end && nowTime > end.getTime()) return null;
      return {
        id: semester.id,
        startTime: start ? start.getTime() : Number.NEGATIVE_INFINITY,
        endTime: end ? end.getTime() : Number.POSITIVE_INFINITY,
      };
    })
    .filter(Boolean);
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (a.startTime !== b.startTime) return b.startTime - a.startTime;
    return a.endTime - b.endTime;
  });
  return candidates[0].id;
}

export function formatSemesterRange(semester) {
  if (!semester) return '';
  const start = semester.startDate || '';
  const end = semester.endDate || '';
  if (start && end) return `${start} t/m ${end}`;
  if (start) return `Vanaf ${start}`;
  if (end) return `Tot ${end}`;
  return '';
}
