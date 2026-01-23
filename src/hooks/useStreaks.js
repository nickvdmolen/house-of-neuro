import { useCallback, useMemo } from 'react';
import { getWeekKey, DEFAULT_STREAK_FREEZES } from '../utils';

const toDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export default function useStreaks(
  studentId,
  semesterId,
  freezeTotalOverride,
  meetings = [],
  attendance = [],
  { refetchMeetings, refetchAttendance } = {}
) {
  const refresh = useCallback(() => {
    if (refetchMeetings) refetchMeetings();
    if (refetchAttendance) refetchAttendance();
  }, [refetchMeetings, refetchAttendance]);

  const freezeTotal = Number.isFinite(freezeTotalOverride)
    ? Math.max(Math.floor(freezeTotalOverride), 0)
    : DEFAULT_STREAK_FREEZES;

  const studentAttendance = useMemo(
    () =>
      studentId && Array.isArray(attendance)
        ? attendance.filter((a) => a.student_id === studentId)
        : [],
    [attendance, studentId]
  );

  const streaks = useMemo(() => {
    const meetingList = Array.isArray(meetings) ? meetings : [];
    const scopedMeetings = semesterId
      ? meetingList.filter((m) => String(m?.semesterId || '') === String(semesterId))
      : meetingList;
    if (!studentId || !scopedMeetings.length) {
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
        freezeTotal,
        freezeUsed: 0,
        freezeRemaining: freezeTotal,
      };
    }

    // Sort meetings by date
    const now = new Date();
    const sortedMeetings = [...scopedMeetings]
      .map((m) => ({ ...m, __date: m?.date ? toDate(m.date) : null }))
      .filter((m) => m.__date && m.__date <= now)
      .sort((a, b) => a.__date - b.__date);

    // Get attendance map
    const attendanceMap = new Map(
      studentAttendance.map((a) => [a.meeting_id, a.present === true])
    );
    const freezeMap = new Map(
      studentAttendance.map((a) => [a.meeting_id, a.streak_freeze === true])
    );

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
      frozen: freezeMap.get(meeting.id) === true,
    }));

    const frozenAbsenceIds = new Set();
    for (let i = meetingPresence.length - 1; i >= 0; i -= 1) {
      const entry = meetingPresence[i];
      if (!entry.present && entry.frozen && frozenAbsenceIds.size < freezeTotal) {
        frozenAbsenceIds.add(entry.meeting.id);
      }
    }

    const frozenAbsenceCount = meetingPresence.reduce((count, entry) => {
      if (entry.frozen && !entry.present) return count + 1;
      return count;
    }, 0);
    const freezeUsed = Math.min(frozenAbsenceCount, freezeTotal);
    const freezeRemaining = Math.max(freezeTotal - freezeUsed, 0);

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
      freezeTotal,
      freezeUsed,
      freezeRemaining,
    };
  }, [studentId, meetings, studentAttendance, semesterId, freezeTotal]);

  return { ...streaks, refresh };
}
