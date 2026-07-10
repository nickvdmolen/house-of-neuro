import { buildScoreTrajectories } from './scoreTrajectory';

describe('buildScoreTrajectories', () => {
  test('reconciles recorded mutations with the current total', () => {
    const now = new Date('2026-01-03T12:00:00Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 100 }],
      [
        {
          id: 'award-1',
          ts: '2026-01-02T12:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: 20,
        },
        {
          id: 'award-2',
          ts: '2026-01-03T12:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: -5,
        },
      ],
      now
    );

    expect(trajectory.baseline).toBe(85);
    expect(trajectory.points.map((point) => point.value)).toEqual([85, 105, 100]);
    expect(trajectory.firstRecorded.value).toBe(105);
    expect(trajectory.highest.value).toBe(105);
    expect(trajectory.steepestIncrease.delta).toBe(20);
    expect(trajectory.steepestDecrease.delta).toBe(-5);
    expect(trajectory.points.at(-1).value).toBe(trajectory.currentPoints);
  });

  test('preserves ordered score mutations that happened on the same day', () => {
    const now = new Date('2026-01-02T12:00:00Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 112 }],
      [
        {
          id: 'award-1',
          ts: '2026-01-02T10:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
        },
        {
          id: 'award-2',
          ts: '2026-01-02T12:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: 7,
        },
      ],
      now
    );

    expect(trajectory.points).toHaveLength(3);
    expect(trajectory.points[1]).toMatchObject({ delta: 5, eventCount: 1, value: 105 });
    expect(trajectory.points[2]).toMatchObject({ delta: 7, eventCount: 1, value: 112 });
    expect(trajectory.firstRecorded.value).toBe(105);
    expect(trajectory.steepestIncrease.delta).toBe(7);
  });

  test('keeps opposite same-day changes visible in the statistics', () => {
    const now = new Date('2026-01-02T12:00:00Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 0 }],
      [
        {
          id: 'award-1',
          ts: '2026-01-02T10:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: 100,
        },
        {
          id: 'award-2',
          ts: '2026-01-02T12:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: -100,
        },
      ],
      now
    );

    expect(trajectory.firstRecorded.value).toBe(100);
    expect(trajectory.highest.value).toBe(100);
    expect(trajectory.steepestIncrease.delta).toBe(100);
    expect(trajectory.steepestDecrease.delta).toBe(-100);
  });

  test('ignores group mutations and malformed award records', () => {
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 10 }],
      [
        {
          id: 'group-award',
          ts: '2026-01-02T12:00:00Z',
          target: 'group',
          target_id: 'student-1',
          amount: 50,
        },
        {
          id: 'invalid-date',
          ts: 'not-a-date',
          target: 'student',
          target_id: 'student-1',
          amount: 5,
        },
        {
          id: 'invalid-amount',
          ts: '2026-01-02T12:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: 'punten',
        },
        {
          id: 'missing-date',
          ts: null,
          target: 'student',
          target_id: 'student-1',
          amount: 5,
        },
        {
          id: 'out-of-range-date',
          ts: 1e20,
          target: 'student',
          target_id: 'student-1',
          amount: 5,
        },
      ]
    );

    expect(trajectory.hasHistory).toBe(false);
    expect(trajectory.points).toHaveLength(1);
    expect(trajectory.points[0].value).toBe(10);
  });

  test('supports legacy award keys and numeric timestamps', () => {
    const timestamp = new Date('2026-01-02T12:00:00Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 15 }],
      [
        {
          id: 'legacy-award',
          ts: timestamp,
          type: 'student',
          targetId: 'student-1',
          amount: 5,
        },
      ]
    );

    expect(trajectory.hasHistory).toBe(true);
    expect(trajectory.baseline).toBe(10);
    expect(trajectory.points.at(-1).value).toBe(15);
  });

  test('uses the current score when a student has no history', () => {
    const now = new Date('2026-02-01T12:00:00Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 42 }],
      [],
      now
    );

    expect(trajectory.hasHistory).toBe(false);
    expect(trajectory.firstRecorded).toBeNull();
    expect(trajectory.highest.value).toBe(42);
    expect(trajectory.highest.timestamp).toBe(now);
    expect(trajectory.steepestIncrease).toBeNull();
    expect(trajectory.steepestDecrease).toBeNull();
  });

  test('anchors the inferred baseline to the semester start', () => {
    const semesterStart = new Date('2026-02-01T00:00:00Z').getTime();
    const semesterEnd = new Date('2026-06-30T23:59:59Z').getTime();
    const now = new Date('2026-03-01T12:00:00Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 20 }],
      [
        {
          id: 'award-1',
          ts: '2026-02-10T12:00:00Z',
          target: 'student',
          target_id: 'student-1',
          amount: 20,
        },
      ],
      now,
      { startTimestamp: semesterStart, endTimestamp: semesterEnd }
    );

    expect(trajectory.points[0]).toMatchObject({
      timestamp: semesterStart,
      value: 0,
      isBaseline: true,
    });
    expect(trajectory.points.at(-1).timestamp).toBe(now);
  });

  test('clamps a snapshot to the configured semester period', () => {
    const semesterStart = new Date('2026-09-01T00:00:00Z').getTime();
    const semesterEnd = new Date('2027-01-31T23:59:59Z').getTime();
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 0 }],
      [],
      new Date('2026-07-01T12:00:00Z').getTime(),
      { startTimestamp: semesterStart, endTimestamp: semesterEnd }
    );

    expect(trajectory.points[0].timestamp).toBe(semesterStart);
  });

  test('does not truncate histories with more than 500 mutations', () => {
    const firstTimestamp = new Date('2026-01-01T09:00:00Z').getTime();
    const awards = Array.from({ length: 501 }, (_, index) => ({
      id: `award-${index}`,
      ts: firstTimestamp + index * 60 * 1000,
      target: 'student',
      target_id: 'student-1',
      amount: 1,
    }));
    const now = awards[awards.length - 1].ts;
    const [trajectory] = buildScoreTrajectories(
      [{ id: 'student-1', name: 'Ada', points: 501 }],
      awards,
      now
    );

    expect(trajectory.points).toHaveLength(502);
    expect(trajectory.firstRecorded.value).toBe(1);
    expect(trajectory.highest.value).toBe(501);
    expect(trajectory.points.at(-1).value).toBe(501);
  });
});
