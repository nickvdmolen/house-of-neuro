import {
  getWeeklyStreakAwardId,
  getWeeklyStreakReason,
  isWeeklyStreakAward,
} from './streakAward';

describe('weekly streak award identity', () => {
  test('creates a stable UUID for one student and week', () => {
    const first = getWeeklyStreakAwardId('student-1', '2026-W27');
    const second = getWeeklyStreakAwardId('student-1', '2026-W27');

    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  test('uses different IDs for different students or weeks', () => {
    const base = getWeeklyStreakAwardId('student-1', '2026-W27');

    expect(getWeeklyStreakAwardId('student-2', '2026-W27')).not.toBe(base);
    expect(getWeeklyStreakAwardId('student-1', '2026-W28')).not.toBe(base);
  });

  test('recognizes both legacy and deterministic weekly award rows by content', () => {
    const award = {
      id: 'legacy-random-id',
      target: 'student',
      target_id: 'student-1',
      reason: getWeeklyStreakReason('2026-W27'),
    };

    expect(isWeeklyStreakAward(award, 'student-1', '2026-W27')).toBe(true);
    expect(isWeeklyStreakAward(award, 'student-2', '2026-W27')).toBe(false);
  });
});
