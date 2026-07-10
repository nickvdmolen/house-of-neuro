export const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const startOfLocalDay = (timestamp) => {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const parseSemesterDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const match = value.trim().match(DATE_ONLY_PATTERN);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date.getTime();
    }
  }
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return startOfLocalDay(parsed);
};

export const getSemesterRange = (semester) => {
  const startTimestamp = parseSemesterDate(
    semester?.startDate ?? semester?.start_date
  );
  const endTimestamp = parseSemesterDate(semester?.endDate ?? semester?.end_date);
  if (
    startTimestamp === null ||
    endTimestamp === null ||
    endTimestamp < startTimestamp
  ) {
    return null;
  }
  return {
    startTimestamp,
    endTimestamp,
    endExclusiveTimestamp: addLocalDays(endTimestamp, 1),
  };
};

const addLocalDays = (timestamp, amount) => {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + amount);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const calendarDayNumber = (timestamp) => {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS;
};

export const selectDisplaySemester = (semesters = [], now = Date.now()) => {
  const today = startOfLocalDay(now);
  const valid = semesters
    .map((semester) => ({ semester, range: getSemesterRange(semester) }))
    .filter((entry) => entry.range);
  if (!valid.length || today === null) return null;

  const current = valid
    .filter(
      ({ range }) =>
        range.startTimestamp <= today && range.endTimestamp >= today
    )
    .sort((a, b) => b.range.startTimestamp - a.range.startTimestamp);
  if (current.length) return current[0].semester;

  const upcoming = valid
    .filter(({ range }) => range.startTimestamp > today)
    .sort((a, b) => a.range.startTimestamp - b.range.startTimestamp);
  if (upcoming.length) return upcoming[0].semester;

  return valid.sort((a, b) => b.range.endTimestamp - a.range.endTimestamp)[0]
    .semester;
};

const pluralize = (value, singular, plural) =>
  `${value} ${value === 1 ? singular : plural}`;

const formatDuration = (days) => {
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  const parts = [];
  if (weeks) parts.push(pluralize(weeks, 'week', 'weken'));
  if (remainingDays || !parts.length) {
    parts.push(pluralize(remainingDays, 'dag', 'dagen'));
  }
  return parts.join(' en ');
};

export const getSemesterTimeStatus = (semester, now = Date.now()) => {
  const range = getSemesterRange(semester);
  const today = startOfLocalDay(now);
  if (!range || today === null) return null;

  if (today < range.startTimestamp) {
    const days = calendarDayNumber(range.startTimestamp) - calendarDayNumber(today);
    return {
      phase: 'upcoming',
      days,
      label: `Start over ${formatDuration(days)}`,
    };
  }
  if (today > range.endTimestamp) {
    return { phase: 'finished', days: 0, label: 'Semester afgerond' };
  }

  const days = calendarDayNumber(range.endTimestamp) - calendarDayNumber(today);
  return {
    phase: 'active',
    days,
    label: days === 0 ? 'Vandaag is de laatste dag' : `Nog ${formatDuration(days)}`,
  };
};

export const belongsToSemester = (row, semester, timestampValue) => {
  if (!semester) return true;
  const semesterId = semester.id == null ? null : String(semester.id);
  const rowSemesterId = row?.semesterId ?? row?.semester_id ?? null;
  if (rowSemesterId !== null && rowSemesterId !== undefined && rowSemesterId !== '') {
    if (semesterId === null || String(rowSemesterId) !== semesterId) return false;
  }

  if (timestampValue === undefined || timestampValue === null || timestampValue === '') {
    return true;
  }
  const range = getSemesterRange(semester);
  const timestamp = new Date(timestampValue).getTime();
  return Boolean(
    range &&
      Number.isFinite(timestamp) &&
      timestamp >= range.startTimestamp &&
      timestamp < range.endExclusiveTimestamp
  );
};
