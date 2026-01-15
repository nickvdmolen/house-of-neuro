import { useCallback, useMemo } from 'react';
import useMeetings from './useMeetings';
import useAttendance from './useAttendance';
import { getWeekKey } from '../utils';

const toDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const MAX_STREAK_FREEZES = 2;

export default function useStreaks(studentId) {
  const [meetings, , { refetch: refetchMeetings }] = useMeetings();
  const [attendance, , { refetch: refetchAttendance }] = useAttendance();

  const refresh = useCallback(() => {
    refetchMeetings();
    refetchAttendance();
  }, [refetchMeetings, refetchAttendance]);

  const studentAttendance = useMemo(
    () => (studentId ? attendance.filter((a) => a.student_id === studentId) : []),
    [attendance, studentId]
  );

  const streaks = useMemo(() => {
    if (!studentId || !meetings.length) {
      return {
        current: 0,
        longest: 0,
        weekStreak: 0,
        weekPresent: 0,
        weekTotal: 0,
        currentWeekKey: getWeekKey(new Date()),
        prevWeekKey: null,
        prevWeekPresent: 0,
        prevWeekTotal: 0,
        prevWeekComplete: false,
        freezeTotal: MAX_STREAK_FREEZES,
        freezeUsed: 0,
        freezeRemaining: MAX_STREAK_FREEZES,
      };
    }

    // Sort meetings by date
    const now = new Date();
    const sortedMeetings = [...meetings]
      .map((m) => ({ ...m, __date: m?.date ? toDate(m.date) : null }))
      .filter((m) => m.__date && m.__date <= now)
      .sort((a, b) => a.__date - b.__date);

    // Get attendance map
    const attendanceMap = new Map(studentAttendance.map(a => [a.meeting_id, a.present]));

    let currentStreak = 0;
    let longestStreak = 0;
    let weekStreak = 0;
    let weekPresent = 0;
    let weekTotal = 0;
    let prevWeekPresent = 0;
    let prevWeekTotal = 0;

    const meetingPresence = sortedMeetings.map((meeting) => ({
      meeting,
      present: attendanceMap.get(meeting.id) === true,
    }));

    const frozenAbsenceIds = new Set();
    for (const entry of meetingPresence) {
      if (!entry.present && frozenAbsenceIds.size < MAX_STREAK_FREEZES) {
        frozenAbsenceIds.add(entry.meeting.id);
      }
    }

    const isEffectivelyPresent = (meetingId, present) =>
      present || frozenAbsenceIds.has(meetingId);

    // Calculate week streak (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekMeetings = sortedMeetings.filter((m) => m.__date >= weekAgo);
    weekTotal = weekMeetings.length;
    weekPresent = weekMeetings.filter((m) =>
      isEffectivelyPresent(m.id, attendanceMap.get(m.id) === true)
    ).length;
    weekStreak = weekTotal > 0 && weekPresent === weekTotal ? 1 : 0; // 1 if full week present

    const currentWeekKey = getWeekKey(now);
    const prevWeekKey = getWeekKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const prevWeekMeetings = sortedMeetings.filter(
      (m) => getWeekKey(m.__date) === prevWeekKey
    );
    prevWeekTotal = prevWeekMeetings.length;
    prevWeekPresent = prevWeekMeetings.filter((m) =>
      isEffectivelyPresent(m.id, attendanceMap.get(m.id) === true)
    ).length;

    const effectiveFlags = meetingPresence.map((entry) =>
      isEffectivelyPresent(entry.meeting.id, entry.present)
    );

    for (let i = effectiveFlags.length - 1; i >= 0; i -= 1) {
      if (effectiveFlags[i]) {
        currentStreak += 1;
      } else {
        break;
      }
    }

    let tempStreak = 0;
    for (const flag of effectiveFlags) {
      if (flag) {
        tempStreak += 1;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      current: currentStreak,
      longest: longestStreak,
      weekStreak,
      weekPresent,
      weekTotal,
      currentWeekKey,
      prevWeekKey,
      prevWeekPresent,
      prevWeekTotal,
      prevWeekComplete: prevWeekTotal > 0 && prevWeekPresent === prevWeekTotal,
      freezeTotal: MAX_STREAK_FREEZES,
      freezeUsed: frozenAbsenceIds.size,
      freezeRemaining: Math.max(MAX_STREAK_FREEZES - frozenAbsenceIds.size, 0),
    };
  }, [studentId, meetings, studentAttendance]);

  return { ...streaks, refresh };
}
