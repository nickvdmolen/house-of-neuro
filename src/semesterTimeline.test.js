import {
  belongsToSemester,
  getSemesterRange,
  getSemesterTimeStatus,
  parseSemesterDate,
  selectDisplaySemester,
} from './semesterTimeline';

describe('semester timeline helpers', () => {
  const semester = {
    id: 'semester-1',
    name: 'Voorjaar 2026',
    startDate: '2026-02-02',
    endDate: '2026-06-19',
  };

  test('parses date-only values in local time and rejects invalid dates', () => {
    const timestamp = parseSemesterDate('2026-02-02');
    const date = new Date(timestamp);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(2);
    expect(parseSemesterDate('2026-02-30')).toBeNull();
  });

  test('selects the current semester, then the nearest upcoming semester', () => {
    const past = {
      id: 'past',
      startDate: '2025-09-01',
      endDate: '2026-01-30',
    };
    const future = {
      id: 'future',
      startDate: '2026-09-01',
      endDate: '2027-01-30',
    };
    expect(
      selectDisplaySemester(
        [past, future, semester],
        new Date(2026, 2, 1).getTime()
      )?.id
    ).toBe('semester-1');
    expect(
      selectDisplaySemester(
        [past, future],
        new Date(2026, 2, 1).getTime()
      )?.id
    ).toBe('future');
  });

  test('describes remaining semester time in weeks and days', () => {
    const status = getSemesterTimeStatus(
      semester,
      new Date(2026, 5, 1, 12).getTime()
    );
    expect(status).toEqual({
      phase: 'active',
      days: 18,
      label: 'Nog 2 weken en 4 dagen',
    });
  });

  test('keeps legacy unscoped rows but date-filters unscoped awards', () => {
    expect(belongsToSemester({ id: 'student-1' }, semester)).toBe(true);
    expect(
      belongsToSemester(
        { semesterId: 'semester-2' },
        semester
      )
    ).toBe(false);
    expect(
      belongsToSemester(
        { id: 'award-1' },
        semester,
        '2026-03-10T10:00:00Z'
      )
    ).toBe(true);
    expect(
      belongsToSemester(
        { id: 'award-old' },
        semester,
        '2025-12-10T10:00:00Z'
      )
    ).toBe(false);
    expect(
      belongsToSemester(
        { id: 'tagged-old', semesterId: 'semester-1' },
        semester,
        '2025-12-10T10:00:00Z'
      )
    ).toBe(false);
  });

  test('returns an inclusive end date and exclusive next-day boundary', () => {
    const range = getSemesterRange(semester);
    expect(range.endExclusiveTimestamp).toBeGreaterThan(range.endTimestamp);
    expect(
      belongsToSemester(
        {},
        semester,
        '2026-06-19T23:59:59'
      )
    ).toBe(true);
  });
});
