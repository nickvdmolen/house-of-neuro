import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, TextInput, Select } from './components/ui';
import BadgeChecklist from './components/BadgeChecklist';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import {
  genId,
  emailValid,
  getIndividualLeaderboard,
  getGroupLeaderboard,
  teacherEmailValid,
  DEFAULT_STREAK_FREEZES,
} from './utils';
import Student from './Student';
import useBadges from './hooks/useBadges';
import useTeachers from './hooks/useTeachers';
import useMeetings from './hooks/useMeetings';
import useAttendance from './hooks/useAttendance';
import { hashPassword } from './auth';
import { uploadImage } from './supabase';
import usePersistentState from './hooks/usePersistentState';
import usePeerAwards from './hooks/usePeerAwards';
import usePeerEvents from './hooks/usePeerEvents';
import useAppSettings from './hooks/useAppSettings';

const BADGE_POINTS = 50;
const nameCollator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });
const normalizeSortValue = (value) => (value ? String(value).trim() : '');
const compareBadgeTitles = (a, b) =>
  nameCollator.compare(
    normalizeSortValue(a?.title || a?.id),
    normalizeSortValue(b?.title || b?.id)
  );

export default function Admin({ onLogout = () => {}, currentTeacherId = null }) {
  const [students, setStudents, { save: saveStudents }] = useStudents();
  const [groups, setGroups, { save: saveGroups }] = useGroups();
  const [awards, setAwards, { save: saveAwards }] = useAwards();
  const [badgeDefs, setBadgeDefs, { save: saveBadges, dirty: badgesDirty }] = useBadges();
  const [teachers, setTeachers, { save: saveTeachers }] = useTeachers();
  const [meetings, setMeetings, { save: saveMeetings }] = useMeetings();
  const [attendance, setAttendance, { save: saveAttendance }] = useAttendance();
  const [peerAwards, setPeerAwards, { save: savePeerAwards }] = usePeerAwards();
  const [peerEvents, setPeerEvents, { save: savePeerEvents, dirty: peerEventsDirty }] = usePeerEvents();
  const [appSettings, setAppSettings, { save: saveAppSettings }] = useAppSettings();
  const [restoreFile, setRestoreFile] = useState(null);

  // Meeting state
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTime, setNewMeetingTime] = useState('');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const attendanceForMeeting = useMemo(() => {
    if (!selectedMeeting) return [];
    return attendance.filter((a) => a.meeting_id === selectedMeeting);
  }, [attendance, selectedMeeting]);

  const semesterStudents = useMemo(() => students, [students]);

  const semesterGroups = useMemo(() => groups, [groups]);

  const semesterMeetings = useMemo(() => meetings, [meetings]);

  useEffect(() => {
    if (selectedMeeting && !semesterMeetings.find((m) => m.id === selectedMeeting)) {
      setSelectedMeeting(null);
    }
  }, [selectedMeeting, semesterMeetings]);

  const semesterPeerEvents = useMemo(() => peerEvents, [peerEvents]);
  const sortedBadgeDefs = useMemo(() => [...badgeDefs].sort(compareBadgeTitles), [badgeDefs]);

  const studentById = useMemo(() => {
    const m = new Map();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const individualLeaderboard = useMemo(
    () => getIndividualLeaderboard(semesterStudents),
    [semesterStudents]
  );

  const groupLeaderboard = useMemo(
    () => getGroupLeaderboard(semesterGroups, semesterStudents),
    [semesterGroups, semesterStudents]
  );

  const individualStats = useMemo(() => {
    const m = new Map();
    individualLeaderboard.forEach((s) => m.set(s.id, s));
    return m;
  }, [individualLeaderboard]);

  const groupStats = useMemo(() => {
    const m = new Map();
    groupLeaderboard.forEach((g) => m.set(g.id, g));
    return m;
  }, [groupLeaderboard]);

  const addStudent = useCallback(async (name, email, password = '') => {
    const id = genId();
    setStudents((prev) => [
      ...prev,
      {
        id,
        name,
        email: email || undefined,
        password,
        semesterId: null,
        groupId: null,
        points: 0,
        streakFreezeTotal: DEFAULT_STREAK_FREEZES,
        badges: [],
        showRankPublic: true,
      }
    ]);
    const { error } = await saveStudents();
    if (error) alert('Kon student niet toevoegen: ' + error.message);
    return id;
  }, [setStudents, saveStudents]);

  const removeStudent = useCallback(async (id) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    const { error } = await saveStudents();
    if (error) alert('Kon student niet verwijderen: ' + error.message);
  }, [setStudents, saveStudents]);

  const resetStudentPassword = useCallback(
    async (id) => {
      const pwd = window.prompt('Nieuw wachtwoord:');
      if (!pwd?.trim()) return;
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, password: hashPassword(pwd.trim()), tempCode: undefined }
            : s
        )
      );
      const { error } = await saveStudents();
      if (error) alert('Kon wachtwoord niet resetten: ' + error.message);
    },
    [setStudents, saveStudents]
  );

  const updateStudentStreakFreezes = useCallback(
    async (studentId, nextTotal) => {
      const total = Number.isFinite(nextTotal)
        ? Math.max(Math.floor(nextTotal), 0)
        : DEFAULT_STREAK_FREEZES;
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, streakFreezeTotal: total } : s
        )
      );
      const { error } = await saveStudents();
      if (error) alert('Kon streak freezes niet bijwerken: ' + error.message);
    },
    [setStudents, saveStudents]
  );

  const promptStudentStreakFreezes = useCallback(
    async (student) => {
      if (!student?.id) return;
      const current = Number.isFinite(student.streakFreezeTotal)
        ? Math.max(Math.floor(student.streakFreezeTotal), 0)
        : DEFAULT_STREAK_FREEZES;
      const raw = window.prompt(
        `Totaal aantal streak freezes voor ${student.name || 'student'}:`,
        String(current)
      );
      if (raw === null) return;
      const next = Number.parseInt(raw, 10);
      if (!Number.isFinite(next) || next < 0) {
        alert('Voer een geldig geheel getal in (0 of hoger).');
        return;
      }
      await updateStudentStreakFreezes(student.id, next);
    },
    [updateStudentStreakFreezes]
  );
  const promptExtraStreakFreezes = useCallback(
    async (student) => {
      if (!student?.id) return;
      const current = Number.isFinite(student.streakFreezeTotal)
        ? Math.max(Math.floor(student.streakFreezeTotal), 0)
        : DEFAULT_STREAK_FREEZES;
      const raw = window.prompt(
        `Streak freezes aanpassen voor ${student.name || 'student'} (positief of negatief):`,
        '1'
      );
      if (raw === null) return;
      const extra = Number.parseInt(raw, 10);
      if (!Number.isFinite(extra) || extra === 0) {
        alert('Voer een geldig geheel getal in (positief of negatief, niet 0).');
        return;
      }
      await updateStudentStreakFreezes(student.id, Math.max(current + extra, 0));
    },
    [updateStudentStreakFreezes]
  );

  const addGroup = useCallback(async (name) => {
    const id = genId();
    setGroups((prev) => [
      ...prev,
      { id, name, semesterId: null, points: 0 },
    ]);
    const { error } = await saveGroups();
    if (error) alert('Kon groep niet toevoegen: ' + error.message);
    return id;
  }, [setGroups, saveGroups]);

  const renameGroup = useCallback(async (id, newName) => {
    if (!newName.trim()) return;
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name: newName.trim() } : g))
    );
    const { error } = await saveGroups();
    if (error) alert('Kon groep niet hernoemen: ' + error.message);
  }, [setGroups, saveGroups]);

  const updateStudentGroup = useCallback(
    async (studentId, groupId) => {
      const nextGroupId = groupId || null;
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, groupId: nextGroupId } : s))
      );
      const { error } = await saveStudents();
      if (error) alert('Kon student niet aan groep koppelen: ' + error.message);
    },
    [setStudents, saveStudents]
  );

  const addStudentToGroup = useCallback(
    async (studentId, groupId) => {
      await updateStudentGroup(studentId, groupId);
    },
    [updateStudentGroup]
  );

  const removeStudentFromGroup = useCallback(
    async (studentId) => {
      await updateStudentGroup(studentId, null);
    },
    [updateStudentGroup]
  );

  const removeGroup = useCallback(
    async (groupId) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setStudents((prev) =>
        prev.map((s) => (s.groupId === groupId ? { ...s, groupId: null } : s))
      );
      const { error: groupError } = await saveGroups();
      if (groupError) {
        alert('Kon groep niet verwijderen: ' + groupError.message);
      }
      const { error: studentError } = await saveStudents();
      if (studentError) {
        alert('Kon studenten niet bijwerken: ' + studentError.message);
      }
    },
    [setGroups, setStudents, saveGroups, saveStudents]
  );

  const toggleBingoHints = useCallback(
    async (enabled) => {
      setAppSettings((prev) => ({ ...prev, bingoHintsEnabled: enabled }));
      const { error } = await saveAppSettings();
      if (error) {
        alert('Kon bingo-hints niet opslaan: ' + error.message);
      }
    },
    [setAppSettings, saveAppSettings]
  );

  const toggleStudentBadge = useCallback(
    async (studentId, badgeId, hasBadge) => {
      if (!studentId || !badgeId) return;
      let delta = 0;
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          const current = new Set(s.badges || []);
          const hadBadge = current.has(badgeId);
          if (hasBadge && !hadBadge) {
            current.add(badgeId);
            delta = BADGE_POINTS;
            return { ...s, badges: Array.from(current), points: s.points + BADGE_POINTS };
          } else if (!hasBadge && hadBadge) {
            current.delete(badgeId);
            delta = -BADGE_POINTS;
            return { ...s, badges: Array.from(current), points: s.points - BADGE_POINTS };
          }
          return s;
        })
      );
      // Save the updated students data
      const { error: saveError } = await saveStudents();
      if (saveError) {
        alert('Kon student data niet opslaan: ' + saveError.message);
        return;
      }
      if (delta !== 0) {
        const student = students.find((s) => s.id === studentId);
        const badgeTitle = badgeDefs.find((b) => b.id === badgeId)?.title || badgeId;
        const award = {
          id: genId(),
          ts: new Date().toISOString(),
          target: 'student',
          target_id: studentId,
          semesterId: null,
          amount: delta,
          reason: delta > 0 ? `Badge behaald: ${badgeTitle}` : `Badge ingetrokken: ${badgeTitle}`,
        };
        setAwards((prev) => [award, ...prev].slice(0, 500));
        const { error } = await saveAwards();
        if (error) alert('Kon award niet opslaan: ' + error.message);
      }
    },
    [setStudents, setAwards, badgeDefs, saveStudents, saveAwards, students]
  );

  const awardToStudent = useCallback(async (studentId, amount, reason) => {
    if (!studentId || !Number.isFinite(amount)) return false;
    const delta = Number(amount);
    const targetStudent = students.find((s) => s.id === studentId);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const currentPoints = Number(s.points) || 0;
        return { ...s, points: currentPoints + delta };
      })
    );
    // Save the updated students data
    const { error: saveError } = await saveStudents();
    if (saveError) {
      alert('Kon student data niet opslaan: ' + saveError.message);
      return false;
    }
    const award = {
      id: genId(),
      ts: new Date().toISOString(),
      target: 'student',
      target_id: studentId,
      semesterId: null,
      amount,
      reason,
    };
    setAwards((prev) => [award, ...prev].slice(0, 500));
    const { error } = await saveAwards();
    if (error) {
      alert('Kon award niet opslaan: ' + error.message);
      return false;
    }
    return true;
  }, [setStudents, setAwards, saveStudents, saveAwards, students]);

  const awardToGroup = useCallback(async (groupId, amount, reason) => {
    if (!groupId || !Number.isFinite(amount)) return false;
    const delta = Number(amount);
    const targetGroup = groups.find((g) => g.id === groupId);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, points: (Number(g.points) || 0) + delta }
          : g
      )
    );
    const { error: saveError } = await saveGroups();
    if (saveError) {
      alert('Kon groepspunten niet opslaan: ' + saveError.message);
      return false;
    }
    const award = {
      id: genId(),
      ts: new Date().toISOString(),
      target: 'group',
      target_id: groupId,
      semesterId: null,
      amount: delta,
      reason,
    };
    setAwards((prev) => [award, ...prev].slice(0, 500));
    const { error } = await saveAwards();
    if (error) {
      alert('Kon award niet opslaan: ' + error.message);
      return false;
    }
    return true;
  }, [setGroups, setAwards, saveGroups, saveAwards, groups]);

  const addExtraStreakFreezes = useCallback(
    async (studentIds, extra) => {
      const extraCount = Number.parseInt(extra, 10);
      if (!Number.isFinite(extraCount) || extraCount === 0) {
        alert('Voer een geldig geheel getal in (positief of negatief, niet 0).');
        return false;
      }
      const idSet = new Set(studentIds.map((id) => String(id)));
      setStudents((prev) =>
        prev.map((s) => {
          if (!idSet.has(String(s.id))) return s;
          const current = Number.isFinite(s.streakFreezeTotal)
            ? Math.max(Math.floor(s.streakFreezeTotal), 0)
            : DEFAULT_STREAK_FREEZES;
          return { ...s, streakFreezeTotal: Math.max(current + extraCount, 0) };
        })
      );
      const { error } = await saveStudents();
      if (error) {
        alert('Kon extra streak freezes niet opslaan: ' + error.message);
        return false;
      }
      return true;
    },
    [setStudents, saveStudents]
  );

  const [peerEventTitle, setPeerEventTitle] = useState('');
  const [peerEventBudget, setPeerEventBudget] = useState('');
  const [peerEventDescription, setPeerEventDescription] = useState('');
  const [peerEventMessage, setPeerEventMessage] = useState('');
  const [peerEventScope, setPeerEventScope] = useState('all');

  const getPeerEventScope = useCallback((event) => {
    if (event?.recipientScope) return event.recipientScope;
    const allowOwn = event?.allowOwnGroup ?? false;
    const allowOther = event?.allowOtherGroups ?? true;
    if (allowOwn && allowOther) return 'all';
    if (allowOwn) return 'own_group';
    if (allowOther) return 'other_groups';
    return 'other_groups';
  }, []);

  const scopeToFlags = useCallback((scope) => {
    const allowOwn = scope === 'all' || scope === 'own_group';
    const allowOther = scope === 'all' || scope === 'other_groups';
    return { allowOwnGroup: allowOwn, allowOtherGroups: allowOther };
  }, []);

  const addPeerEvent = useCallback(async () => {
    const title = peerEventTitle.trim();
    const budget = Number(peerEventBudget);
    if (!title || !Number.isFinite(budget) || budget < 0) {
      alert('Vul een titel en geldig budget in.');
      return;
    }
    const flags = scopeToFlags(peerEventScope);
    const event = {
      id: genId(),
      title,
      description: peerEventDescription.trim(),
      budget,
      active: true,
      allowOwnGroup: flags.allowOwnGroup,
      allowOtherGroups: flags.allowOtherGroups,
      semesterId: null,
      created_at: new Date().toISOString(),
    };
    setPeerEvents((prev) => [event, ...prev]);
    const { error } = await savePeerEvents();
    if (error) {
      alert('Kon event niet opslaan: ' + error.message);
      return;
    }
    setPeerEventTitle('');
    setPeerEventBudget('');
    setPeerEventDescription('');
    setPeerEventScope('all');
  }, [
    peerEventTitle,
    peerEventBudget,
    peerEventDescription,
    peerEventScope,
    scopeToFlags,
    setPeerEvents,
    savePeerEvents,
  ]);

  const updatePeerEvent = useCallback(
    (id, changes) => {
      setPeerEvents((prev) =>
        prev.map((event) => (event.id === id ? { ...event, ...changes } : event))
      );
    },
    [setPeerEvents]
  );

  const persistPeerEvents = useCallback(async () => {
    const { error } = await savePeerEvents();
    if (error) {
      alert('Kon events niet opslaan: ' + error.message);
      return;
    }
    setPeerEventMessage('Events opgeslagen.');
    setTimeout(() => setPeerEventMessage(''), 2000);
  }, [savePeerEvents]);

  const removePeerEvent = useCallback(
    async (id) => {
      if (!window.confirm('Event verwijderen?')) return;
      setPeerEvents((prev) => prev.filter((event) => event.id !== id));
      const { error } = await savePeerEvents();
      if (error) {
        alert('Kon event niet verwijderen: ' + error.message);
        return;
      }
    },
    [setPeerEvents, savePeerEvents]
  );

  const peerAwardsSorted = useMemo(
    () =>
      [...peerAwards].sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
      ),
    [peerAwards]
  );

  const peerEventById = useMemo(() => {
    const map = new Map();
    semesterPeerEvents.forEach((event) => map.set(event.id, event));
    return map;
  }, [semesterPeerEvents]);

  const previewStudents = useMemo(
    () => [...semesterStudents].sort((a, b) => nameCollator.compare(a?.name || '', b?.name || '')),
    [semesterStudents]
  );
  const sortedAwardStudents = useMemo(
    () => [...semesterStudents].sort((a, b) => nameCollator.compare(a?.name || '', b?.name || '')),
    [semesterStudents]
  );
  const attendanceStudents = useMemo(
    () => [...semesterStudents].sort((a, b) => nameCollator.compare(a?.name || '', b?.name || '')),
    [semesterStudents]
  );


  const [newStudent, setNewStudent] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [studentSort, setStudentSort] = useState('name');
  const [newGroup, setNewGroup] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const resetTeacherPassword = useCallback(async (id) => {
    const pwd = window.prompt('Nieuw wachtwoord:');
    if (!pwd?.trim()) return;
    const hash = hashPassword(pwd.trim());
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, passwordHash: hash } : t))
    );
    const { error } = await saveTeachers();
    if (error) alert('Kon docent niet opslaan: ' + error.message);
  }, [setTeachers, saveTeachers]);
  const removeTeacher = useCallback(async (id) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    const { error } = await saveTeachers();
    if (error) alert('Kon docent niet verwijderen: ' + error.message);
  }, [setTeachers, saveTeachers]);
  const approveTeacher = useCallback(async (id) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, approved: true } : t))
    );
    const { error } = await saveTeachers();
    if (error) alert('Kon docent niet goedkeuren: ' + error.message);
  }, [setTeachers, saveTeachers]);
  const [badgeStudentId, setBadgeStudentId] = useState('');
  const [awardType, setAwardType] = useState('student');
  const [awardStudentIds, setAwardStudentIds] = useState([]);
  const [awardGroupId, setAwardGroupId] = useState('');
  const [awardAmount, setAwardAmount] = useState('5');
  const [awardReason, setAwardReason] = useState('');
  const [extraFreezeAmount, setExtraFreezeAmount] = useState('1');
  const [awardMessage, setAwardMessage] = useState('');
  const [freezeMessage, setFreezeMessage] = useState('');

  const [newBadgeTitle, setNewBadgeTitle] = useState('');
  const [newBadgeImage, setNewBadgeImage] = useState('');
  const [newBadgeImagePreview, setNewBadgeImagePreview] = useState('');
  const [badgeImagePreviews, setBadgeImagePreviews] = useState({});
  const [newBadgeRequirement, setNewBadgeRequirement] = useState('');
  const [badgesSaveMessage, setBadgesSaveMessage] = useState('');

  const handleSaveBadges = useCallback(async () => {
    const { error } = await saveBadges();
    if (error) {
      alert('Kon badges niet opslaan: ' + error.message);
      return;
    }
    setBadgesSaveMessage('Opgeslagen!');
    setTimeout(() => setBadgesSaveMessage(''), 2000);
  }, [saveBadges]);

  const addBadge = useCallback(() => {
    const title = newBadgeTitle.trim();
    if (!title || !newBadgeImage) return;
    const id = genId();
    setBadgeDefs((prev) => [
      ...prev,
      { id, title, image: newBadgeImage, requirement: newBadgeRequirement.trim() },
    ]);
    setNewBadgeTitle('');
    setNewBadgeImage('');
    setNewBadgeImagePreview('');
    setNewBadgeRequirement('');
    return id;
  }, [newBadgeTitle, newBadgeImage, newBadgeRequirement, setBadgeDefs]);

  const handleAddBadge = useCallback(async () => {
    const createdId = addBadge();
    if (!createdId) return;
    const { error } = await saveBadges();
    if (error) {
      alert('Kon badges niet opslaan: ' + error.message);
      return;
    }
    setBadgesSaveMessage('Opgeslagen!');
    setTimeout(() => setBadgesSaveMessage(''), 2000);
  }, [addBadge, saveBadges]);

  const removeBadge = useCallback((badgeId) => {
    setBadgeDefs((prev) => prev.filter((b) => b.id !== badgeId));
  }, [setBadgeDefs]);

  const handleBackup = useCallback(() => {
    const data = {
      students,
      groups,
      awards,
      badges: badgeDefs,
      teachers,
      meetings,
      attendance,
      peerAwards,
      peerEvents,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [students, groups, awards, badgeDefs, teachers, meetings, attendance, peerAwards, peerEvents]);

  const handleRestore = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const errors = [];
        if (Array.isArray(data.students)) {
          setStudents(data.students);
          const { error } = await saveStudents();
          if (error) errors.push('studenten');
        }
        if (Array.isArray(data.groups)) {
          setGroups(data.groups);
          const { error } = await saveGroups();
          if (error) errors.push('groepen');
        }
        if (Array.isArray(data.awards)) {
          setAwards(data.awards);
          const { error } = await saveAwards();
          if (error) errors.push('awards');
        }
        if (Array.isArray(data.badges)) {
          setBadgeDefs(data.badges);
          const { error } = await saveBadges();
          if (error) errors.push('badges');
        }
        if (Array.isArray(data.teachers)) {
          setTeachers(data.teachers);
          const { error } = await saveTeachers();
          if (error) errors.push('docenten');
        }
        if (Array.isArray(data.meetings)) {
          setMeetings(data.meetings);
          const { error } = await saveMeetings();
          if (error) errors.push('bijeenkomsten');
        }
        if (Array.isArray(data.attendance)) {
          setAttendance(data.attendance);
          const { error } = await saveAttendance();
          if (error) errors.push('aanwezigheid');
        }
        const restoredPeerAwards = Array.isArray(data.peerAwards)
          ? data.peerAwards
          : Array.isArray(data.peer_awards)
          ? data.peer_awards
          : null;
        if (restoredPeerAwards) {
          setPeerAwards(restoredPeerAwards);
          const { error } = await savePeerAwards();
          if (error) errors.push('peer awards');
        }
        const restoredPeerEvents = Array.isArray(data.peerEvents)
          ? data.peerEvents
          : Array.isArray(data.peer_events)
          ? data.peer_events
          : null;
        if (restoredPeerEvents) {
          setPeerEvents(restoredPeerEvents);
          const { error } = await savePeerEvents();
          if (error) errors.push('peer events');
        }
        if (errors.length) {
          alert(`Herstel gedeeltelijk mislukt: ${errors.join(', ')}`);
        }
      } catch {
        alert('Ongeldige backup');
      }
    };
    reader.readAsText(file);
  }, [
    setStudents,
    setGroups,
    setAwards,
    setBadgeDefs,
    setTeachers,
    setMeetings,
    setAttendance,
    setPeerAwards,
    setPeerEvents,
    saveStudents,
    saveGroups,
    saveAwards,
    saveBadges,
    saveTeachers,
    saveMeetings,
    saveAttendance,
    savePeerAwards,
    savePeerEvents,
  ]);

  // Meeting functions
  const addMeeting = async () => {
    const newMeeting = {
      id: genId(),
      date: newMeetingDate,
      time: newMeetingTime,
      title: newMeetingTitle,
      semesterId: null,
      created_by: currentTeacherId || null,
    };
    setMeetings((prev) => [...prev, newMeeting]);
    const { error } = await saveMeetings();
    if (error) {
      alert('Kon bijeenkomst niet opslaan: ' + error.message);
      return;
    }
    setNewMeetingDate('');
    setNewMeetingTime('');
    setNewMeetingTitle('');
  };

  const removeMeeting = async (id) => {
    if (window.confirm('Bijeenkomst verwijderen?')) {
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setAttendance((prev) => prev.filter((a) => a.meeting_id !== id));
      const { error: meetingError } = await saveMeetings();
      if (meetingError) {
        alert('Kon bijeenkomst niet verwijderen: ' + meetingError.message);
      }
      const { error: attendanceError } = await saveAttendance();
      if (attendanceError) {
        alert('Kon aanwezigheid niet bijwerken: ' + attendanceError.message);
      }
    }
  };

  const markAttendance = async (meetingId, studentId, present) => {
    const timestamp = new Date().toISOString();
    setAttendance((prev) => {
      const next = [...prev];
      const index = next.findIndex(
        (a) => a.meeting_id === meetingId && a.student_id === studentId
      );
      if (index >= 0) {
        const existing = next[index];
        next[index] = {
          ...existing,
          id: existing.id || genId(),
          present,
          streak_freeze: present ? false : existing.streak_freeze === true,
          marked_at: timestamp,
        };
      } else {
        next.push({
          id: genId(),
          meeting_id: meetingId,
          student_id: studentId,
          present,
          streak_freeze: false,
          marked_at: timestamp,
        });
      }
      return next;
    });
    const { error } = await saveAttendance();
    if (error) {
      alert('Kon aanwezigheid niet opslaan: ' + error.message);
      return;
    }

  };

  const [page, setPage] = useState('points');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  

  // Preview state (gedeeld met Student-weergave)
  const [previewId, setPreviewId] = usePersistentState('nm_preview_student', '');

  useEffect(() => {
    if (semesterStudents.length === 0) {
      setAwardStudentIds([]);
    } else {
      setAwardStudentIds((prev) => {
        const valid = prev.filter((id) => semesterStudents.some((s) => s.id === id));
        return valid.length ? valid : [semesterStudents[0].id];
      });
    }
  }, [semesterStudents]);

  useEffect(() => {
    if (semesterGroups.length && !semesterGroups.find((g) => g.id === awardGroupId)) {
      setAwardGroupId(semesterGroups[0]?.id || '');
    }
  }, [semesterGroups, awardGroupId]);

  

  // Houd preview-selectie geldig als de lijst verandert
  useEffect(() => {
    if (previewId && !previewStudents.find((s) => s.id === previewId)) {
      setPreviewId(previewStudents[0]?.id || '');
    }
  }, [previewStudents, previewId]);

  const menuItems = [
    { value: 'scores', label: 'Scores' },
    { value: 'points', label: 'Punten invoeren' },
    { value: 'streak-freezes', label: 'Streak freezes' },
    { value: 'peer-points', label: 'Peer punten' },
    { value: 'badges', label: 'Badges toekennen' },
    { value: 'manage-groups', label: 'Groepen beheren' },
    { value: 'manage-students', label: 'Studenten beheren' },
    { value: 'manage-teachers', label: 'Docenten beheren' },
    { value: 'manage-badges', label: 'Badges beheren' },
    { value: 'manage-meetings', label: 'Bijeenkomsten beheren' },
    { value: 'bingo', label: 'Bingo beheer' },
    { value: 'backup', label: 'Backup & herstel' },
    { value: 'preview', label: 'Preview student' }
  ];
  return (
    <div className="relative min-h-screen pl-0 lg:pl-60">
      <div className="fixed inset-y-0 left-0 right-0 z-0 pointer-events-none lg:left-60">
        <img
          src={process.env.PUBLIC_URL + '/images/voorpagina.png'}
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Sluit menu"
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <nav
        id="admin-sidebar"
        className={`fixed left-0 top-0 z-30 h-screen w-60 overflow-y-auto border-r bg-white p-4 space-y-2 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {menuItems.map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setPage(item.value);
              setSidebarOpen(false);
            }}
            className={`block w-full text-left px-2 py-1 rounded ${page === item.value ? 'bg-neutral-200' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              aria-controls="admin-sidebar"
              aria-expanded={sidebarOpen}
              className="lg:hidden inline-flex items-center rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              Menu
            </button>
            <span className="bg-white/80 px-2 py-1 rounded">Ingelogd als beheerder</span>
          </div>
          <Button className="bg-indigo-600 text-white" onClick={onLogout}>
            Uitloggen
          </Button>
        </div>

      {page === 'scores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Leaderboard – Individueel">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Student</th>
                  <th className="py-1 pr-2">Groep</th>
                  <th className="py-1 pr-2 text-right">Punten</th>
                </tr>
              </thead>
              <tbody>
                {individualLeaderboard.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">{row.rank}</td>
                    <td className="py-1 pr-2">{row.name}</td>
                    <td className="py-1 pr-2">
                      {row.groupId ? groupById.get(row.groupId)?.name || '-' : '-'}
                    </td>
                    <td
                      className={`py-1 pr-2 text-right font-semibold ${
                        row.points > 0
                          ? 'text-emerald-700'
                          : row.points < 0
                          ? 'text-rose-700'
                          : 'text-neutral-700'
                      }`}
                    >
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Leaderboard – Groepen">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Groep</th>
                  <th className="py-1 pr-2 text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {groupLeaderboard.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">{row.rank}</td>
                    <td className="py-1 pr-2">{row.name}</td>
                    <td
                      className={`py-1 pr-2 text-right font-semibold ${
                        row.total > 0
                          ? 'text-emerald-700'
                          : row.total < 0
                          ? 'text-rose-700'
                          : 'text-neutral-700'
                      }`}
                    >
                      {Math.round(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {page === 'manage-students' && (
        <Card title="Studenten beheren">
          <div className="grid grid-cols-1 gap-2">
            <TextInput value={newStudent} onChange={setNewStudent} placeholder="Naam" />
            <TextInput
              value={newStudentEmail}
              onChange={setNewStudentEmail}
              placeholder="E-mail (@student.nhlstenden.com)"
            />
            {newStudentEmail && !emailValid(newStudentEmail) && (
              <div className="text-sm text-rose-600">
                Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.
              </div>
            )}
            <Button
              className="bg-indigo-600 text-white"
              disabled={
                !newStudent.trim() ||
                (newStudentEmail.trim() !== '' && !emailValid(newStudentEmail))
              }
              onClick={() => {
                const name = newStudent.trim();
                const email = newStudentEmail.trim();
                addStudent(name, email || undefined);
                setNewStudent('');
                setNewStudentEmail('');
              }}
            >
              Voeg student toe
            </Button>
            <Select
              value={studentSort}
              onChange={setStudentSort}
              className="mt-2 w-60"
            >
              <option value="name">Sorteer op naam</option>
              <option value="individual">Sorteer op individuele punten</option>
              <option value="group">Sorteer op groepspunten</option>
            </Select>
            <ul className="mt-4 space-y-2">
              {semesterStudents
                .slice()
                .sort((a, b) => {
                  if (studentSort === 'individual') {
                    return (individualStats.get(b.id)?.points || 0) - (individualStats.get(a.id)?.points || 0);
                  }
                  if (studentSort === 'group') {
                    return (groupStats.get(b.groupId)?.total || 0) - (groupStats.get(a.groupId)?.total || 0);
                  }
                  return a.name.localeCompare(b.name);
                })
                .map((s) => {
                  const ind = individualStats.get(s.id);
                  const grp = groupStats.get(s.groupId);
                  const freezeTotalValue = Number.isFinite(s.streakFreezeTotal)
                    ? Math.max(Math.floor(s.streakFreezeTotal), 0)
                    : DEFAULT_STREAK_FREEZES;
                  const groupsForStudent = semesterGroups;
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="flex-1">{s.name}</span>
                      <span className="w-28 text-right">
                        {s.points} ({ind?.rank})
                      </span>
                      <span className="w-28 text-right">
                        {grp ? `${Math.round(grp.total)} (${grp.rank})` : '—'}
                      </span>
                      
                      <Select
                        value={s.groupId || ''}
                        onChange={(val) => updateStudentGroup(s.id, val)}
                        className="w-40"
                      >
                        <option value="">Geen</option>
                        {groupsForStudent.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        className="border"
                        onClick={() => promptStudentStreakFreezes(s)}
                      >
                        Streak freezes: {freezeTotalValue}
                      </Button>
                      <Button
                        className="border"
                        onClick={() => promptExtraStreakFreezes(s)}
                      >
                        Streak freezes aanpassen
                      </Button>
                      <Button
                        className="bg-indigo-600 text-white"
                        onClick={() => resetStudentPassword(s.id)}
                      >
                        Reset wachtwoord
                      </Button>
                      <Button
                        className="bg-rose-600 text-white"
                        onClick={() => {
                          if (window.confirm(`Verwijder ${s.name}?`)) {
                            removeStudent(s.id);
                          }
                        }}
                      >
                        Verwijder
                      </Button>
                    </li>
                  );
                })}
            </ul>
          </div>
        </Card>
      )}

      {page === 'manage-groups' && (
        <Card title="Groepen beheren">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-2">
              <TextInput
                value={newGroup}
                onChange={setNewGroup}
                placeholder="Nieuwe groepsnaam"
              />
              <Button
                className="bg-indigo-600 text-white"
                disabled={!newGroup.trim()}
                onClick={() => {
                  addGroup(newGroup.trim());
                  setNewGroup('');
                }}
              >
                Voeg toe
              </Button>
            </div>
            <ul className="space-y-4">
              {semesterGroups.map((g) => {
                const members = semesterStudents.filter((s) => s.groupId === g.id);
                const eligibleStudents = semesterStudents.filter((s) => s.groupId !== g.id);
                return (
                  <li key={g.id} className="border rounded p-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-semibold truncate">{g.name}</span>
                        <Button
                          className="bg-gray-500 text-white text-xs px-2 py-1"
                          onClick={() => {
                            const newName = window.prompt('Nieuwe groepsnaam:', g.name);
                            if (newName && newName.trim() && newName.trim() !== g.name) {
                              renameGroup(g.id, newName);
                            }
                          }}
                        >
                          ✏️
                        </Button>
                      </div>
                      <Button
                        className="bg-rose-600 text-white"
                        onClick={() => {
                          if (window.confirm('Groep verwijderen?')) {
                            removeGroup(g.id);
                          }
                        }}
                      >
                        Verwijder groep
                      </Button>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {members.map((m) => (
                        <li key={m.id} className="flex items-center gap-2">
                          <span className="flex-1">{m.name}</span>
                          <Button
                            className="bg-rose-600 text-white"
                            onClick={() => removeStudentFromGroup(m.id)}
                          >
                            Verwijder
                          </Button>
                        </li>
                      ))}
                      {members.length === 0 && (
                        <li className="text-sm text-neutral-500">Geen studenten</li>
                      )}
                    </ul>
                    <Select
                      value=""
                      onChange={(val) => {
                        if (val) addStudentToGroup(val, g.id);
                      }}
                      className="mt-2"
                    >
                      <option value="">Voeg student toe…</option>
                      {eligibleStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      )}

      {page === 'badges' && (
        <Card title="Badges toekennen">
          <div className="grid grid-cols-1 gap-2">
            <Select value={badgeStudentId} onChange={setBadgeStudentId} className="max-w-xs">
              <option value="">Kies student…</option>
              {previewStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {badgeStudentId && (
              <BadgeChecklist
                badgeDefs={badgeDefs}
                studentBadges={studentById.get(badgeStudentId)?.badges || []}
                onToggle={(badgeId, checked) => toggleStudentBadge(badgeStudentId, badgeId, checked)}
              />
            )}
          </div>
        </Card>
      )}

      {page === 'manage-badges' && (
        <Card title="Badges beheren">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-3">
              <Button
                className="bg-indigo-600 text-white"
                disabled={!badgesDirty}
                onClick={handleSaveBadges}
              >
                Badges opslaan
              </Button>
              {badgesSaveMessage && (
                <span className="text-sm text-emerald-600">{badgesSaveMessage}</span>
              )}
              {badgesDirty && !badgesSaveMessage && (
                <span className="text-sm text-amber-600">Niet opgeslagen</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 p-4">
              {sortedBadgeDefs.map((b) => {
                const previewImage = badgeImagePreviews[b.id];
                const displayImage = previewImage || b.image;
                return (
                <div key={b.id} className="flex flex-col text-sm min-h-[120px] border rounded-lg p-4">
                  <div className="flex items-center justify-center mb-3">
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt={b.title}
                        className="w-16 h-16 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full border bg-neutral-100" />
                    )}
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">{b.title}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800 text-lg"
                        onClick={() =>
                          document.getElementById(`edit-badge-image-${b.id}`).click()
                        }
                        title="Afbeelding bewerken"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800 text-lg"
                        onClick={() => {
                          if (window.confirm('Badge verwijderen?')) removeBadge(b.id);
                        }}
                        title="Badge verwijderen"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <TextInput
                    value={b.requirement || ''}
                    onChange={(val) =>
                      setBadgeDefs((prev) =>
                        prev.map((bd) =>
                          bd.id === b.id ? { ...bd, requirement: val } : bd
                        )
                      )
                    }
                    placeholder="Wat moet student doen?"
                    className="flex-1"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    id={`edit-badge-image-${b.id}`}
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.target;
                      const file = input.files?.[0];
                      if (!file) return;
                      const previewUrl = URL.createObjectURL(file);
                      setBadgeImagePreviews((prev) => ({ ...prev, [b.id]: previewUrl }));
                      const uploadedUrl = await uploadImage(file);
                      if (uploadedUrl) {
                        setBadgeDefs((prev) =>
                          prev.map((bd) =>
                            bd.id === b.id ? { ...bd, image: uploadedUrl } : bd
                          )
                        );
                      }
                      setBadgeImagePreviews((prev) => {
                        const next = { ...prev };
                        delete next[b.id];
                        return next;
                      });
                      URL.revokeObjectURL(previewUrl);
                      input.value = '';
                    }}
                  />
                </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <TextInput value={newBadgeTitle} onChange={setNewBadgeTitle} placeholder="Titel" />
              <TextInput
                value={newBadgeRequirement}
                onChange={setNewBadgeRequirement}
                placeholder="Wat moet student doen?"
              />
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const input = e.target;
                  const file = input.files?.[0];
                  if (!file) return;
                  const previewUrl = URL.createObjectURL(file);
                  setNewBadgeImage('');
                  setNewBadgeImagePreview(previewUrl);
                  const uploadedUrl = await uploadImage(file);
                  if (uploadedUrl) {
                    setNewBadgeImage(uploadedUrl);
                    setNewBadgeImagePreview('');
                    URL.revokeObjectURL(previewUrl);
                  }
                  input.value = '';
                }}
              />
              {(newBadgeImagePreview || newBadgeImage) && (
                <img
                  src={newBadgeImagePreview || newBadgeImage}
                  alt="Preview"
                  className="badge-box rounded-full border object-cover"
                />
              )}
              <Button
                className="bg-indigo-600 text-white"
                disabled={!newBadgeTitle.trim() || !newBadgeImage}
                onClick={handleAddBadge}
              >
                Maak badge
              </Button>
            </div>
          </div>
        </Card>
      )}

      {page === 'manage-teachers' && (
        <Card title="Docenten beheren">
          <div className="grid grid-cols-1 gap-2">
            <TextInput
              value={newTeacherEmail}
              onChange={setNewTeacherEmail}
              placeholder="E-mail (@nhlstenden.com)"
            />
            <TextInput
              type="password"
              value={newTeacherPassword}
              onChange={setNewTeacherPassword}
              placeholder="Wachtwoord"
            />
            {newTeacherEmail && !teacherEmailValid(newTeacherEmail) && (
              <div className="text-sm text-rose-600">
                Alleen adressen eindigend op @nhlstenden.com zijn toegestaan.
              </div>
            )}
            <Button
              className="bg-indigo-600 text-white"
              disabled={
                !newTeacherEmail.trim() ||
                !newTeacherPassword.trim() ||
                !teacherEmailValid(newTeacherEmail)
              }
              onClick={async () => {
                const email = newTeacherEmail.trim().toLowerCase();
                if (teachers.some((t) => t.email.toLowerCase() === email)) return;
                const hash = hashPassword(newTeacherPassword.trim());
                setTeachers((prev) => [
                  ...prev,
                  { id: genId(), email, passwordHash: hash, approved: true },
                ]);
                const { error } = await saveTeachers();
                if (error) {
                  alert('Kon docent niet opslaan: ' + error.message);
                  return;
                }
                setNewTeacherEmail('');
                setNewTeacherPassword('');
              }}
            >
              Voeg docent toe
            </Button>
            <ul className="mt-4 space-y-2">
              {teachers.map((t) => {
                const approved = t.approved !== false;
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="flex-1">
                      {t.email}
                      {!approved && (
                        <span className="text-sm text-rose-600 ml-2">In afwachting</span>
                      )}
                    </span>
                    {!approved && (
                      <Button
                        className="bg-emerald-600 text-white"
                        onClick={() => approveTeacher(t.id)}
                      >
                        Keur goed
                      </Button>
                    )}
                    <Button
                      className="bg-indigo-600 text-white"
                      onClick={() => resetTeacherPassword(t.id)}
                    >
                      Reset wachtwoord
                    </Button>
                    <Button
                      className="bg-rose-600 text-white"
                      onClick={() => {
                        if (window.confirm(`Verwijder ${t.email}?`)) {
                          removeTeacher(t.id);
                        }
                      }}
                    >
                      Verwijder
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      )}

      {page === 'points' && (
        <Card title="Punten invoeren">
          <div className="grid md:grid-cols-5 gap-2 items-end">
            <div className="md:col-span-1">
              <label className="text-sm">Type</label>
              <Select value={awardType} onChange={setAwardType}>
                <option value="student">Individu</option>
                <option value="group">Groep</option>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm">Doel</label>
              {awardType === 'student' ? (
                <Select multiple value={awardStudentIds} onChange={setAwardStudentIds} className="h-32">
                  {sortedAwardStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select value={awardGroupId} onChange={setAwardGroupId}>
                  {semesterGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div>
              <label className="text-sm">Punten</label>
              <TextInput value={awardAmount} onChange={setAwardAmount} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">Reden</label>
              <TextInput value={awardReason} onChange={setAwardReason} />
            </div>
            <Button
              className="bg-indigo-600 text-white md:col-span-5"
              disabled={awardType === 'student' ? awardStudentIds.length === 0 : !awardGroupId}
              onClick={async () => {
                if (!awardAmount.trim()) {
                  alert('Voer een geldig getal in.');
                  return;
                }
                const amountValue = Number(awardAmount);
                if (!Number.isFinite(amountValue)) {
                  alert('Voer een geldig getal in.');
                  return;
                }
                const reason = awardReason.trim();
                let success = false;
                if (awardType === 'student') {
                  const results = await Promise.all(
                    awardStudentIds.map((id) => awardToStudent(id, amountValue, reason))
                  );
                  success = results.length > 0 && results.every(Boolean);
                } else {
                  success = await awardToGroup(awardGroupId, amountValue, reason);
                }
                if (success) {
                  setAwardReason('');
                  setAwardAmount('5');
                  setAwardMessage('Succesvol ingevoerd.');
                  setTimeout(() => setAwardMessage(''), 2000);
                }
              }}
            >
              Toekennen
            </Button>
            {awardMessage && (
              <div className="md:col-span-5 text-sm text-emerald-600">
                {awardMessage}
              </div>
            )}
          </div>
        </Card>
      )}

      {page === 'streak-freezes' && (
        <Card title="Streak freezes">
          <div className="grid md:grid-cols-5 gap-2 items-end">
            <div className="md:col-span-2">
              <label className="text-sm">Studenten</label>
              <Select multiple value={awardStudentIds} onChange={setAwardStudentIds} className="h-32">
                {sortedAwardStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm">Aantal</label>
              <TextInput
                value={extraFreezeAmount}
                onChange={setExtraFreezeAmount}
                className="w-24"
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex flex-wrap gap-2 items-end">
                <Button
                  className="border"
                  disabled={
                    awardStudentIds.length === 0 ||
                    !Number.isFinite(Number(extraFreezeAmount)) ||
                    Number(extraFreezeAmount) === 0
                  }
                  onClick={async () => {
                    const success = await addExtraStreakFreezes(awardStudentIds, extraFreezeAmount);
                    if (success) {
                      setExtraFreezeAmount('1');
                      setFreezeMessage('Succesvol ingevoerd.');
                      setTimeout(() => setFreezeMessage(''), 2000);
                    }
                  }}
                >
                  Streak freezes aanpassen
                </Button>
                <span className="text-xs text-neutral-500">
                  Bijv. 2 om toe te voegen, -1 om af te pakken.
                </span>
              </div>
            </div>
            {freezeMessage && (
              <div className="md:col-span-5 text-sm text-emerald-600">
                {freezeMessage}
              </div>
            )}
          </div>
        </Card>
      )}

      {page === 'peer-points' && (
        <Card title="Peer punten">
          <div className="space-y-6">
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <label className="text-sm">Event titel</label>
                <TextInput value={peerEventTitle} onChange={setPeerEventTitle} />
              </div>
              <div>
                <label className="text-sm">Budget per student</label>
                <TextInput
                  type="number"
                  value={peerEventBudget}
                  onChange={setPeerEventBudget}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm">Omschrijving</label>
                <TextInput
                  value={peerEventDescription}
                  onChange={setPeerEventDescription}
                  placeholder="Waarom bestaat dit event?"
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm">Doelgroep</label>
                <Select value={peerEventScope} onChange={setPeerEventScope} className="mt-1">
                  <option value="all">Alle studenten</option>
                  <option value="own_group">Studenten uit eigen groep</option>
                  <option value="other_groups">Andere groepen dan eigen</option>
                </Select>
                <p className="text-xs text-neutral-500 mt-1">
                  Studenten kunnen nooit punten aan zichzelf geven.
                </p>
              </div>
              <div className="flex gap-2 md:col-span-3">
                <Button
                  className="bg-indigo-600 text-white"
                  onClick={addPeerEvent}
                >
                  Event aanmaken
                </Button>
                <Button
                  className="bg-gray-600 text-white"
                  disabled={!peerEventsDirty}
                  onClick={persistPeerEvents}
                >
                  Wijzigingen opslaan
                </Button>
                {peerEventMessage && (
                  <span className="text-sm text-emerald-600 self-center">{peerEventMessage}</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Events</h3>
              {semesterPeerEvents.length === 0 ? (
                <p className="text-sm text-neutral-500">Nog geen events.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">Titel</th>
                      <th className="py-1 pr-2">Budget</th>
                      <th className="py-1 pr-2">Actief</th>
                      <th className="py-1 pr-2">Doelgroep</th>
                      <th className="py-1 pr-2">Omschrijving</th>
                      <th className="py-1 pr-2">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesterPeerEvents.map((event) => (
                      <tr key={event.id} className="border-b last:border-0">
                        <td className="py-1 pr-2">
                          <input
                            className="w-full text-base"
                            value={event.title || ''}
                            onChange={(e) =>
                              updatePeerEvent(event.id, { title: e.target.value })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            className="w-24 text-base"
                            value={event.budget ?? 0}
                            onChange={(e) =>
                              updatePeerEvent(event.id, { budget: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="checkbox"
                            checked={event.active !== false}
                            onChange={(e) =>
                              updatePeerEvent(event.id, { active: e.target.checked })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Select
                            value={getPeerEventScope(event)}
                            onChange={(val) =>
                              updatePeerEvent(event.id, scopeToFlags(val))
                            }
                            className="text-sm"
                          >
                            <option value="all">Alle studenten</option>
                            <option value="own_group">Eigen groep</option>
                            <option value="other_groups">Andere groepen dan eigen</option>
                          </Select>
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            className="w-full text-base"
                            value={event.description || ''}
                            onChange={(e) =>
                              updatePeerEvent(event.id, { description: e.target.value })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Button
                            className="bg-rose-600 text-white"
                            onClick={() => removePeerEvent(event.id)}
                          >
                            Verwijder
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Peer awards log</h3>
              {peerAwardsSorted.length === 0 ? (
                <p className="text-sm text-neutral-500">Nog geen peer awards.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">Datum</th>
                      <th className="py-1 pr-2">Van</th>
                      <th className="py-1 pr-2">Event</th>
                      <th className="py-1 pr-2">Doel</th>
                      <th className="py-1 pr-2 text-right">Punten</th>
                      <th className="py-1 pr-2 text-right">Totaal</th>
                      <th className="py-1 pr-2">Reden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peerAwardsSorted.slice(0, 100).map((entry) => {
                      const fromName = studentById.get(entry.from_student_id)?.name || entry.from_student_id;
                      const eventLabel =
                        entry.event_title ||
                        peerEventById.get(entry.event_id)?.title ||
                        entry.event_id ||
                        '-';
                      const targetLabel =
                        entry.target === 'class'
                          ? `Hele klas (${entry.recipients?.length || 0})`
                          : entry.target === 'group'
                          ? groupById.get(entry.target_id)?.name || entry.target_id
                          : studentById.get(entry.target_id)?.name || entry.target_id;
                      return (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-1 pr-2">{new Date(entry.ts).toLocaleString()}</td>
                          <td className="py-1 pr-2">{fromName}</td>
                          <td className="py-1 pr-2">{eventLabel}</td>
                          <td className="py-1 pr-2">{targetLabel}</td>
                          <td className="py-1 pr-2 text-right">{entry.amount}</td>
                          <td className="py-1 pr-2 text-right">{entry.total_amount}</td>
                          <td className="py-1 pr-2">{entry.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Card>
      )}

      {page === 'backup' && (
        <Card title="Backup & herstel">
          <div className="space-y-4">
            <Button className="bg-indigo-600 text-white" onClick={handleBackup}>
              Backup downloaden
            </Button>
            <div>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => setRestoreFile(e.target.files[0] || null)}
              />
              <Button
                className="bg-indigo-600 text-white mt-2"
                disabled={!restoreFile}
                onClick={() => {
                  handleRestore(restoreFile);
                  setRestoreFile(null);
                }}
              >
                Herstel backup
              </Button>
            </div>
          </div>
        </Card>
      )}

      {page === 'manage-meetings' && (
        <Card title="Bijeenkomsten beheren">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                label="Datum"
                type="date"
                value={newMeetingDate}
                onChange={setNewMeetingDate}
              />
              <TextInput
                label="Tijd"
                type="time"
                value={newMeetingTime}
                onChange={setNewMeetingTime}
              />
              <TextInput
                label="Titel"
                value={newMeetingTitle}
                onChange={setNewMeetingTitle}
                placeholder="Bijv. College Neuromarketing"
              />
            </div>
            <Button
              className="bg-indigo-600 text-white"
              onClick={addMeeting}
              disabled={!newMeetingDate || !newMeetingTitle}
            >
              Bijeenkomst toevoegen
            </Button>
            <div className="space-y-2">
              {semesterMeetings.map((m) => (
                <div key={m.id} className="border rounded p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <strong>{m.title}</strong> - {new Date(m.date).toLocaleDateString()} {m.time}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setSelectedMeeting(m.id)}>Aanwezigheid markeren</Button>
                      <Button className="bg-red-600 text-white" onClick={() => removeMeeting(m.id)}>Verwijderen</Button>
                    </div>
                  </div>
                  {selectedMeeting === m.id && (
                    <div className="mt-4">
                      <h4 className="font-semibold">Aanwezigheid voor {m.title}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {attendanceStudents.map((s) => {
                          const att = attendanceForMeeting.find((a) => a.student_id === s.id);
                          return (
                            <label key={s.id} className="grid grid-cols-[1.25rem_1fr] items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={att?.present || false}
                                onChange={(e) => markAttendance(m.id, s.id, e.target.checked)}
                              />
                              <span className="truncate">{s.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {page === 'bingo' && (
        <Card title="Bingo beheer">
          <p className="text-sm text-gray-600 mb-4">
            Bekijk en bewerk de bingo-antwoorden van studenten. Handig om schrijfwijzes te harmoniseren.
          </p>
          <a 
            href="#/admin/bingo" 
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Open Bingo beheer
          </a>
          <div className="mt-6 border-t pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(appSettings?.bingoHintsEnabled)}
                onChange={(e) => toggleBingoHints(e.target.checked)}
              />
              Toon hints voor mogelijke bingo matches op de student-homepage
            </label>
            <p className="text-xs text-neutral-500 mt-1">
              Blauwe vakjes betekenen dat er ergens een match mogelijk is, maar nog niet gevonden.
            </p>
          </div>
        </Card>
      )}

      {page === 'preview' && (
        <Card title="Preview student">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-end">
            <div>
              <label className="text-sm">Student</label>
              <Select value={previewId} onChange={setPreviewId}>
                <option value="">— Kies student —</option>
                {previewStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email || s.id})
                  </option>
                ))}
              </Select>
              <p className="text-xs text-neutral-500 mt-2">
                Laat leeg om te zien wat een student zonder selectie ziet.
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="border" onClick={() => setPreviewId('')}>Leegmaken</Button>
              <a href="#/admin/preview" className="px-4 py-2 rounded-2xl border">Open als losse pagina</a>
            </div>
          </div>

          <div className="mt-4">
            <Student previewStudentId={previewId} />
          </div>
        </Card>
      )}
    </div>
  </div>
  );
}
