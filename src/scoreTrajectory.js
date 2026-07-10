const DAY_IN_MS = 24 * 60 * 60 * 1000;

const studentNameCollator = new Intl.Collator('nl', {
  sensitivity: 'base',
  numeric: true,
});

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const parseTimestamp = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const normalizedValue =
    typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  const timestamp = new Date(normalizedValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const startOfLocalDay = (timestamp) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const addLocalDays = (timestamp, amount) => {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + amount);
  return startOfLocalDay(date.getTime());
};

const normalizeAward = (award) => {
  const target = award?.target ?? award?.type;
  const targetId = award?.target_id ?? award?.targetId;
  const timestamp = parseTimestamp(award?.ts);
  const amount = Number(award?.amount);

  if (
    target !== 'student' ||
    targetId === null ||
    targetId === undefined ||
    timestamp === null ||
    !Number.isFinite(amount) ||
    amount === 0
  ) {
    return null;
  }

  return {
    id: String(award?.id ?? ''),
    studentId: String(targetId),
    timestamp,
    dayTimestamp: startOfLocalDay(timestamp),
    amount,
  };
};

const findHighestPoint = (points) =>
  points.reduce(
    (highest, point) =>
      !highest ||
      point.value > highest.value ||
      (point.value === highest.value && highest.isBaseline && !point.isBaseline)
        ? point
        : highest,
    null
  );

const findSteepestChange = (points, direction) => {
  let steepest = null;
  points.forEach((point, index) => {
    if (index === 0 || !Number.isFinite(point.delta)) return;
    const isCandidate = direction === 'increase' ? point.delta > 0 : point.delta < 0;
    if (!isCandidate) return;
    const isSteeper =
      !steepest ||
      (direction === 'increase'
        ? point.delta > steepest.delta
        : point.delta < steepest.delta);
    if (!isSteeper) return;
    steepest = {
      delta: point.delta,
      fromTimestamp: points[index - 1].timestamp,
      toTimestamp: point.timestamp,
      fromIsBaseline: Boolean(points[index - 1].isBaseline),
    };
  });
  return steepest;
};

/**
 * Reconstructs an ordered score trajectory from the current student snapshot
 * and timestamped score mutations. The inferred baseline reconciles incomplete
 * or imported history so the final plotted value always equals student.points.
 */
export function buildScoreTrajectories(
  students = [],
  awards = [],
  now = Date.now(),
  timeline = {}
) {
  const eventsByStudent = new Map();

  awards.forEach((award) => {
    const event = normalizeAward(award);
    if (!event) return;
    const events = eventsByStudent.get(event.studentId) || [];
    events.push(event);
    eventsByStudent.set(event.studentId, events);
  });
  const rawSnapshotTimestamp = parseTimestamp(now) ?? Date.now();
  const timelineStart = parseTimestamp(timeline?.startTimestamp);
  const timelineEnd = parseTimestamp(timeline?.endTimestamp);
  const snapshotTimestamp = Math.min(
    Math.max(rawSnapshotTimestamp, timelineStart ?? rawSnapshotTimestamp),
    timelineEnd ?? rawSnapshotTimestamp
  );

  return students
    .map((student, index) => {
      const id = String(student?.id ?? `student-${index}`);
      const name = String(student?.name || 'Onbekende student');
      const currentPoints = toFiniteNumber(student?.points);
      const events = [...(eventsByStudent.get(id) || [])].sort((a, b) => {
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
        return a.id.localeCompare(b.id);
      });

      if (events.length === 0) {
        const point = {
          timestamp: snapshotTimestamp,
          value: currentPoints,
          delta: null,
          eventCount: 0,
          isBaseline: false,
          isSnapshot: true,
        };
        return {
          id,
          name,
          currentPoints,
          baseline: currentPoints,
          hasHistory: false,
          points: [point],
          firstRecorded: null,
          highest: point,
          steepestIncrease: null,
          steepestDecrease: null,
        };
      }

      const recordedDelta = events.reduce((sum, event) => sum + event.amount, 0);
      const baseline = currentPoints - recordedDelta;
      let runningTotal = baseline;
      const baselineTimestamp =
        timelineStart !== null && timelineStart <= events[0].timestamp
          ? timelineStart
          : addLocalDays(events[0].dayTimestamp, -1);
      const points = [
        {
          timestamp: baselineTimestamp,
          value: baseline,
          delta: null,
          eventCount: 0,
          isBaseline: true,
          isSnapshot: false,
        },
      ];

      events.forEach((event) => {
        runningTotal += event.amount;
        points.push({
          timestamp: event.timestamp,
          delta: event.amount,
          eventCount: 1,
          value: runningTotal,
          isBaseline: false,
          isSnapshot: false,
        });
      });

      const recordedPoints = points.slice(1);
      const statisticalPoints = [...points];
      if (snapshotTimestamp > points[points.length - 1].timestamp) {
        points.push({
          timestamp: snapshotTimestamp,
          value: currentPoints,
          delta: null,
          eventCount: 0,
          isBaseline: false,
          isSnapshot: true,
        });
      }
      return {
        id,
        name,
        currentPoints,
        baseline,
        hasHistory: true,
        points,
        firstRecorded: recordedPoints[0],
        highest: findHighestPoint(statisticalPoints),
        steepestIncrease: findSteepestChange(statisticalPoints, 'increase'),
        steepestDecrease: findSteepestChange(statisticalPoints, 'decrease'),
      };
    })
    .sort((a, b) => studentNameCollator.compare(a.name, b.name));
}

export { DAY_IN_MS };
