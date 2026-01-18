import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { checkPassword, hashPassword } from './auth';
import { Card, Button, TextInput, Select } from './components/ui';
import BadgeOverview from './components/BadgeOverview';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import { questions as bingoQuestions } from './bingoData';
import {
  genId,
  emailValid,
  getIndividualLeaderboard,
  getGroupLeaderboard,
  nameFromEmail,
} from './utils';
import useBadges from './hooks/useBadges';
import { getImageUrl, uploadImage } from './supabase';
import useStreaks from './hooks/useStreaks';
import usePeerAwards from './hooks/usePeerAwards';
import usePeerEvents from './hooks/usePeerEvents';
import useAppSettings from './hooks/useAppSettings';

const WEEKLY_STREAK_POINTS = 50;
const DATA_POLL_MS = 5000;
const nameCollator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });
const STREAK_FREEZE_AVAILABLE_SRC = `${process.env.PUBLIC_URL}/images/streak-freeze.png`;
const STREAK_FREEZE_USED_SRC = `${process.env.PUBLIC_URL}/images/streak-freeze-used.png`;
const bingoQuestionKeys = Object.keys(bingoQuestions);
const normalizeBingoAnswer = (value) => (value || '').trim().toLowerCase();

const buildBingoAnswerIndex = (students) => {
  const index = {};
  bingoQuestionKeys.forEach((key) => {
    index[key] = new Map();
  });
  for (const student of students) {
    const bingo = student?.bingo || {};
    for (const key of bingoQuestionKeys) {
      const answers = Array.isArray(bingo[key]) ? bingo[key] : [];
      const unique = new Set();
      for (const answer of answers) {
        const normalized = normalizeBingoAnswer(answer);
        if (normalized) unique.add(normalized);
      }
      if (!unique.size) continue;
      const bucket = index[key];
      for (const normalized of unique) {
        const existing = bucket.get(normalized);
        if (existing) {
          existing.add(student.id);
        } else {
          bucket.set(normalized, new Set([student.id]));
        }
      }
    }
  }
  return index;
};

export default function Student({
  selectedStudentId = '',
  setSelectedStudentId = () => {},
  previewStudentId,
  route = '/student',
}) {
  const [
    students,
    setStudents,
    {
      save: saveStudents,
      loaded: studentsLoaded,
      refetch: refetchStudents,
      dirty: studentsDirty,
    },
  ] = useStudents();
  const [groups, setGroups, { save: saveGroups }] = useGroups();
  const [
    awards,
    setAwards,
    {
      save: saveAwards,
      error: awardsError,
      refetch: refetchAwards,
      dirty: awardsDirty,
    },
  ] = useAwards();
  const [badgeDefs, , { refetch: refetchBadges }] = useBadges();
  const [
    peerAwards,
    setPeerAwards,
    { save: savePeerAwards, refetch: refetchPeerAwards, dirty: peerAwardsDirty },
  ] = usePeerAwards();
  const [peerEvents, , { refetch: refetchPeerEvents }] = usePeerEvents();
  const [appSettings, , { refetch: refetchAppSettings }] = useAppSettings();

  const inPreview = previewStudentId !== undefined;
  const activeStudentId = inPreview ? previewStudentId : selectedStudentId;
  const bgPosClass = inPreview ? 'absolute' : 'fixed';

  const myStreaks = useStreaks(activeStudentId);
  const [attendanceRefresh, setAttendanceRefresh] = useState(0);
  const weekPercent = useMemo(() => {
    if (!myStreaks.weekTotal) return 0;
    return Math.round((myStreaks.weekPresent / myStreaks.weekTotal) * 100);
  }, [myStreaks.weekPresent, myStreaks.weekTotal]);
  const freezeTotal = myStreaks.freezeTotal ?? 2;
  const freezeUsed = Math.min(myStreaks.freezeUsed ?? 0, freezeTotal);

  // Listen to global attendance refresh counter
  useEffect(() => {
    const checkRefresh = () => {
      if (window.attendanceRefreshCounter && window.attendanceRefreshCounter.value !== attendanceRefresh) {
        setAttendanceRefresh(window.attendanceRefreshCounter.value);
        myStreaks.refresh();
      }
    };
    
    const interval = setInterval(checkRefresh, 500); // Check every 500ms
    return () => clearInterval(interval);
  }, [attendanceRefresh, myStreaks]);

  // Auto-refresh streaks every 2 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      myStreaks.refresh();
    }, 2000);
    return () => clearInterval(interval);
  }, [myStreaks]);

  useEffect(() => {
    if (!activeStudentId || inPreview) return;
    const refresh = () => {
      if (!studentsDirty) refetchStudents();
      if (!awardsDirty) refetchAwards();
      refetchBadges();
      if (!peerAwardsDirty) refetchPeerAwards();
      refetchPeerEvents();
      refetchAppSettings();
    };
    refresh();
    const interval = setInterval(refresh, DATA_POLL_MS);
    return () => clearInterval(interval);
  }, [
    activeStudentId,
    inPreview,
    refetchStudents,
    refetchAwards,
    refetchBadges,
    refetchPeerAwards,
    refetchPeerEvents,
    refetchAppSettings,
    studentsDirty,
    awardsDirty,
    peerAwardsDirty,
  ]);

  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const individualLeaderboard = useMemo(() => getIndividualLeaderboard(students), [students]);

  const groupLeaderboard = useMemo(
    () => getGroupLeaderboard(groups, students),
    [groups, students]
  );

  const addStudent = useCallback(async (name, email, password = '') => {
    const id = genId();
    const hashedPassword = password ? hashPassword(password) : '';
    setStudents((prev) => [
      ...prev,
      {
        id,
        name,
        email: email || undefined,
        password: hashedPassword,
        groupId: null,
        points: 0,
        badges: [],
        photo: '',
        bingoMatches: {},
        showRankPublic: false,
      }
    ]);
    const { error } = await saveStudents();
    if (error) {
      alert('Kon account niet opslaan: ' + error.message);
      return null;
    }
    return id;
  }, [setStudents, saveStudents]);

  useEffect(() => {
    if (
      !inPreview &&
      studentsLoaded &&
      selectedStudentId &&
      !students.find((s) => s.id === selectedStudentId)
    ) {
      setSelectedStudentId('');
    }
  }, [students, selectedStudentId, setSelectedStudentId, inPreview, studentsLoaded]);

  const me = students.find((s) => s.id === activeStudentId) || null;
  const myGroup = me && me.groupId ? groupById.get(me.groupId) || null : null;
  const myBadges = me?.badges || [];
  const bingoHintsEnabled = Boolean(appSettings?.bingoHintsEnabled);

  useEffect(() => {
    if (inPreview || !activeStudentId || !me) return;
    if (!myStreaks.prevWeekComplete || !myStreaks.prevWeekKey) return;
    if (me.lastWeekRewarded === myStreaks.prevWeekKey) return;

    const award = {
      id: genId(),
      ts: new Date().toISOString(),
      target: 'student',
      target_id: activeStudentId,
      amount: WEEKLY_STREAK_POINTS,
      reason: `Aanwezigheidsstreak ${myStreaks.prevWeekKey}`,
    };

    setStudents((prev) =>
      prev.map((s) =>
        s.id === activeStudentId
          ? {
              ...s,
              points: (Number(s.points) || 0) + WEEKLY_STREAK_POINTS,
              lastWeekRewarded: myStreaks.prevWeekKey,
            }
          : s
      )
    );
    setAwards((prev) => [award, ...prev].slice(0, 500));

    const persistBonus = async () => {
      const { error: studentError } = await saveStudents();
      if (studentError) {
        console.warn('[streak bonus] Failed to save student', studentError);
      }
      const { error: awardError } = await saveAwards();
      if (awardError) {
        console.warn('[streak bonus] Failed to save award', awardError);
      }
    };
    persistBonus();
  }, [
    activeStudentId,
    inPreview,
    me,
    myStreaks.prevWeekComplete,
    myStreaks.prevWeekKey,
    saveAwards,
    saveStudents,
    setAwards,
    setStudents,
  ]);

  const myAwards = useMemo(() => {
    return awards
      .filter(
        (a) =>
          (a.target === 'student' && String(a.target_id) === String(activeStudentId)) ||
          (a.target === 'group' && myGroup && String(a.target_id) === String(myGroup.id))
      )
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 10);
  }, [awards, activeStudentId, myGroup]);

  const recentBadges = useMemo(() => {
    if (!activeStudentId) return [];
    const badgeAwards = awards
      .filter(
        (a) =>
          a.target === 'student' &&
          String(a.target_id) === String(activeStudentId) &&
          a.amount > 0 &&
          (a.reason || '').startsWith('Badge behaald:')
      )
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    const result = [];
    const seen = new Set();
    for (const award of badgeAwards) {
      const rawName = (award.reason || '').replace('Badge behaald:', '').trim();
      if (!rawName) continue;
      const def =
        badgeDefs.find((b) => b.id === rawName) ||
        badgeDefs.find((b) => b.title === rawName);
      const id = def?.id || rawName;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({
        id,
        title: def?.title || rawName,
        image: def?.image || '',
      });
      if (result.length >= 2) break;
    }
    return result;
  }, [awards, activeStudentId, badgeDefs]);

  const badgeSlots = useMemo(() => {
    const slots = [...recentBadges];
    while (slots.length < 2) slots.push(null);
    return slots.slice(0, 2);
  }, [recentBadges]);

  const bingoMatches = me?.bingoMatches || null;
  const bingoAnswerIndex = useMemo(() => buildBingoAnswerIndex(students), [students]);

  const bingoFilled = useMemo(() => {
    if (!bingoMatches) return bingoQuestionKeys.map(() => false);
    return bingoQuestionKeys.map((key) => Boolean(bingoMatches[key]?.answer));
  }, [bingoMatches]);

  const bingoHinted = useMemo(() => {
    if (!bingoHintsEnabled || !me) return bingoQuestionKeys.map(() => false);
    const myBingo = me.bingo || {};
    return bingoQuestionKeys.map((key) => {
      const answers = Array.isArray(myBingo[key]) ? myBingo[key] : [];
      const normalized = new Set();
      for (const answer of answers) {
        const clean = normalizeBingoAnswer(answer);
        if (clean) normalized.add(clean);
      }
      if (!normalized.size) return false;
      const bucket = bingoAnswerIndex[key];
      for (const clean of normalized) {
        const matches = bucket.get(clean);
        if (matches && matches.size > 1) return true;
      }
      return false;
    });
  }, [bingoHintsEnabled, me, bingoAnswerIndex]);

  const myRank = useMemo(
    () => individualLeaderboard.find((r) => r.id === activeStudentId) || null,
    [individualLeaderboard, activeStudentId]
  );

  const myGroupRank = useMemo(
    () => (myGroup ? groupLeaderboard.find((r) => r.id === myGroup.id) || null : null),
    [groupLeaderboard, myGroup]
  );

  const { topLeaderboardRows, extraLeaderboardRows } = useMemo(() => {
    const topRows = individualLeaderboard.slice(0, 3);
    const extraRows = individualLeaderboard.filter(
      (row) => row.rank > 3 && (row.id === activeStudentId || row.showRankPublic)
    );
    return { topLeaderboardRows: topRows, extraLeaderboardRows: extraRows };
  }, [individualLeaderboard, activeStudentId]);

  const [showBadges, setShowBadges] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profilePassword2, setProfilePassword2] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [profileShowRank, setProfileShowRank] = useState(false);

  const [lastSeenBadgeCount, setLastSeenBadgeCount] = useState(0);

  useEffect(() => {
    if (!activeStudentId || !me) {
      setLastSeenBadgeCount(0);
      return;
    }
    setLastSeenBadgeCount(myBadges.length);
  }, [activeStudentId, me?.id]);

  useEffect(() => {
    if (showBadges && activeStudentId) {
      setLastSeenBadgeCount(myBadges.length);
    }
  }, [showBadges, myBadges.length, activeStudentId]);

  const hasUnseenBadges = myBadges.length > lastSeenBadgeCount;

  useEffect(() => {
    setShowProfile(route === '/student/profile');
  }, [route]);

  useEffect(() => {
    if (showProfile && me) {
      setProfileName(me.name || '');
      setProfilePassword('');
      setProfilePassword2('');
      setProfilePhoto(me.photo || '');
      setProfileShowRank(Boolean(me.showRankPublic));
    }
  }, [showProfile, me]);

  const [authMode, setAuthMode] = useState('login');

  const handleLogout = () => {
    setSelectedStudentId('');
    window.location.hash = '/';
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setProfilePhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    const nextPassword = profilePassword ? hashPassword(profilePassword) : null;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === activeStudentId
          ? {
              ...s,
              name: profileName.trim(),
              password: nextPassword || s.password,
              photo: profilePhoto,
              showRankPublic: profileShowRank,
            }
          : s
      )
    );
    const { error } = await saveStudents();
    if (error) {
      alert('Kon profiel niet opslaan: ' + error.message);
      return;
    }
    window.location.hash = '/student';
  };

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetStudent, setResetStudent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const handleLogin = async () => {
    if (!emailValid(loginEmail)) return;
    const normEmail = loginEmail.trim().toLowerCase();
    const existing = students.find((s) => (s.email || '').toLowerCase() === normEmail);
    if (existing) {
      const pass = loginPassword.trim();
      if (existing.tempCode && pass === existing.tempCode) {
        setResetStudent(existing);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
      } else {
        const { ok, needsRehash } = checkPassword(pass, existing.password || '');
        if (ok && needsRehash) {
          setStudents((prev) =>
            prev.map((s) =>
              s.id === existing.id ? { ...s, password: hashPassword(pass) } : s
            )
          );
          const { error } = await saveStudents();
          if (error) {
            console.warn('[login] Failed to upgrade student password hash', error);
          }
        }
        if (ok) {
        setSelectedStudentId(existing.id);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
        } else {
          setLoginError('Onjuist wachtwoord of code.');
        }
      }
    } else {
      setLoginError('Onbekend e-mailadres.');
    }
  };

  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupError, setSignupError] = useState('');

  const [peerEventId, setPeerEventId] = useState('');
  const [peerAllocations, setPeerAllocations] = useState({});
  const [peerFeedback, setPeerFeedback] = useState('');

  const completedPeerEventIds = useMemo(() => {
    if (!activeStudentId) return new Set();
    const ids = peerAwards
      .filter((entry) => entry?.from_student_id === activeStudentId)
      .map((entry) => entry?.event_id || entry?.eventId)
      .filter(Boolean)
      .map((id) => String(id));
    return new Set(ids);
  }, [peerAwards, activeStudentId]);

  const activePeerEvents = useMemo(
    () =>
      peerEvents.filter(
        (event) =>
          event?.active !== false && !completedPeerEventIds.has(String(event.id))
      ),
    [peerEvents, completedPeerEventIds]
  );

  useEffect(() => {
    if (!activePeerEvents.length) {
      if (peerEventId) setPeerEventId('');
      return;
    }
    if (!peerEventId || !activePeerEvents.find((e) => e.id === peerEventId)) {
      setPeerEventId(activePeerEvents[0].id);
    }
  }, [activePeerEvents, peerEventId]);

  const selectedPeerEvent = useMemo(
    () => activePeerEvents.find((event) => event.id === peerEventId) || null,
    [activePeerEvents, peerEventId]
  );

  const recipientScope = useMemo(() => {
    if (!selectedPeerEvent) return null;
    if (selectedPeerEvent.recipientScope) return selectedPeerEvent.recipientScope;
    const allowOwn = selectedPeerEvent.allowOwnGroup ?? false;
    const allowOther = selectedPeerEvent.allowOtherGroups ?? true;
    if (allowOwn && allowOther) return 'all';
    if (allowOwn) return 'own_group';
    if (allowOther) return 'other_groups';
    return 'other_groups';
  }, [selectedPeerEvent]);

  const scopeLabel = useMemo(() => {
    if (!recipientScope) return '';
    if (recipientScope === 'all') return 'Alle studenten';
    if (recipientScope === 'own_group') return 'Je eigen groep';
    return 'Andere groepen dan je eigen';
  }, [recipientScope]);

  const peerTarget = useMemo(() => {
    if (!recipientScope) return '';
    return recipientScope === 'other_groups' ? 'group' : 'student';
  }, [recipientScope]);

  useEffect(() => {
    setPeerAllocations({});
    setPeerFeedback('');
  }, [peerEventId, recipientScope]);

  const eligibleStudents = useMemo(() => {
    if (!recipientScope) return [];
    const myGroupId = me?.groupId ?? null;
    return students
      .filter((s) => {
        if (s.id === activeStudentId) return false;
        if (recipientScope === 'all') return true;
        if (!myGroupId) {
          return recipientScope === 'other_groups';
        }
        const isOwn = s.groupId === myGroupId;
        return recipientScope === 'own_group' ? isOwn : !isOwn;
      })
      .sort((a, b) => nameCollator.compare(a.name || '', b.name || ''));
  }, [students, me?.groupId, activeStudentId, recipientScope]);

  const eligibleAwardGroups = useMemo(() => {
    if (recipientScope !== 'other_groups') return [];
    const myGroupId = me?.groupId ?? null;
    return groups
      .filter((g) => g.id !== myGroupId)
      .sort((a, b) => nameCollator.compare(a.name || '', b.name || ''));
  }, [groups, me?.groupId, recipientScope]);

  const groupMemberCounts = useMemo(() => {
    const counts = new Map();
    students.forEach((s) => {
      if (s.groupId) {
        counts.set(s.groupId, (counts.get(s.groupId) || 0) + 1);
      }
    });
    return counts;
  }, [students]);

  const eligibleAwardGroupsWithMembers = useMemo(
    () =>
      eligibleAwardGroups.filter((g) => (groupMemberCounts.get(g.id) || 0) > 0),
    [eligibleAwardGroups, groupMemberCounts]
  );

  const allocationItems = useMemo(() => {
    if (peerTarget === 'group') {
      return eligibleAwardGroupsWithMembers.map((g) => ({
        id: g.id,
        label: g.name || 'Groep',
        size: groupMemberCounts.get(g.id) || 0,
        type: 'group',
      }));
    }
    if (peerTarget === 'student') {
      return eligibleStudents.map((s) => ({
        id: s.id,
        label: s.name || 'Student',
        groupName: s.groupId ? groupById.get(s.groupId)?.name || 'Groep' : null,
        type: 'student',
      }));
    }
    return [];
  }, [peerTarget, eligibleAwardGroupsWithMembers, eligibleStudents, groupMemberCounts, groupById]);

  const allocationTotalCost = useMemo(() => {
    return allocationItems.reduce((sum, item) => {
      const amount = Number(peerAllocations[item.id]?.amount) || 0;
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      if (peerTarget === 'group') {
        return sum + amount * (item.size || 0);
      }
      return sum + amount;
    }, 0);
  }, [allocationItems, peerAllocations, peerTarget]);

  const peerEventBudget = Number(selectedPeerEvent?.budget) || 0;
  const peerEventSpent = useMemo(() => {
    if (!peerEventId) return 0;
    return peerAwards
      .filter((entry) => {
        if (entry?.from_student_id !== activeStudentId) return false;
        const eventId = entry?.event_id || entry?.eventId;
        return String(eventId) === String(peerEventId);
      })
      .reduce((sum, entry) => {
        const total =
          Number(entry.total_amount) ||
          (Number(entry.amount) || 0) * (entry.recipients?.length || 1);
        return sum + total;
      }, 0);
  }, [peerAwards, peerEventId, activeStudentId]);
  const peerBudgetRemaining = Math.max(peerEventBudget - peerEventSpent, 0);
  const peerEventLocked = useMemo(() => {
    if (!peerEventId || !activeStudentId) return false;
    const currentId = String(peerEventId);
    return peerAwards.some(
      (entry) =>
        entry?.from_student_id === activeStudentId &&
        String(entry?.event_id || entry?.eventId) === currentId
    );
  }, [peerAwards, peerEventId, activeStudentId]);
  const allocationRemaining = useMemo(() => {
    if (peerEventLocked) return 0;
    return peerBudgetRemaining - allocationTotalCost;
  }, [peerEventLocked, peerBudgetRemaining, allocationTotalCost]);

  const displayAllocated = peerEventLocked ? peerEventSpent : allocationTotalCost;

  const hasAllocations = useMemo(
    () =>
      allocationItems.some(
        (item) => (Number(peerAllocations[item.id]?.amount) || 0) > 0
      ),
    [allocationItems, peerAllocations]
  );

  const updateAllocationAmount = useCallback((id, rawValue) => {
    const parsed = Math.floor(Number(rawValue) || 0);
    const value = Math.max(0, parsed);
    setPeerAllocations((prev) => {
      const next = { ...prev };
      const reason = (next[id]?.reason || '').trim();
      if (!value && !reason) {
        delete next[id];
        return next;
      }
      next[id] = {
        amount: value,
        reason: next[id]?.reason || '',
      };
      return next;
    });
  }, []);
  const updateAllocationReason = useCallback((id, rawValue) => {
    const value = rawValue ?? '';
    setPeerAllocations((prev) => {
      const next = { ...prev };
      const amount = Number(next[id]?.amount) || 0;
      const reason = String(value);
      if (!amount && !reason.trim()) {
        delete next[id];
        return next;
      }
      next[id] = {
        amount,
        reason,
      };
      return next;
    });
  }, []);
  const handleSignup = async () => {
    if (
      !signupEmail.trim() ||
      !signupName.trim() ||
      !emailValid(signupEmail) ||
      !signupPassword.trim()
    )
      return;

    if (signupPassword !== signupPassword2) {
      setSignupError('Wachtwoorden komen niet overeen.');
      return;
    }

    const normEmail = signupEmail.trim().toLowerCase();
    const existing = students.find((s) => (s.email || '').toLowerCase() === normEmail);
    if (existing) {
      setSignupError('E-mailadres bestaat al.');
    } else {
      const newId = await addStudent(signupName.trim(), normEmail, signupPassword);
      if (!newId) return;
      setSelectedStudentId(newId);
      setSignupEmail('');
      setSignupName('');
      setSignupPassword('');
      setSignupPassword2('');
      setSignupError('');
    }
  };

  const handlePeerAward = async () => {
    if (!me) return;
    if (!selectedPeerEvent) {
      setPeerFeedback('Er is geen open puntenevent.');
      return;
    }
    if (peerEventLocked) {
      setPeerFeedback('Dit event is al ingevuld.');
      return;
    }
    if (!recipientScope) {
      setPeerFeedback('Dit event heeft geen doelgroep.');
      return;
    }
    if (peerBudgetRemaining <= 0) {
      setPeerFeedback('Dit event heeft geen budget.');
      return;
    }
    if (!hasAllocations) {
      setPeerFeedback('Vul bij minimaal één ontvanger punten in.');
      return;
    }
    if (hasMissingReasons) {
      setPeerFeedback('Vul bij elke toekenning een reden in.');
      return;
    }

    const allocations = allocationItems
      .map((item) => {
        const entry = peerAllocations[item.id] || {};
        const amount = Number(entry.amount) || 0;
        const reason = (entry.reason || '').trim();
        if (!Number.isFinite(amount) || amount <= 0) return null;
        const recipientsCount = peerTarget === 'group' ? item.size || 0 : 1;
        const totalAmount = peerTarget === 'group' ? amount * recipientsCount : amount;
        if (!totalAmount || !reason) return null;
        return { ...item, amount, totalAmount, recipientsCount, reason };
      })
      .filter(Boolean);
    if (allocationTotalCost !== peerBudgetRemaining) {
      if (allocationRemaining > 0) {
        setPeerFeedback(`Je moet nog ${allocationRemaining} punten verdelen.`);
      } else {
        setPeerFeedback(`Je hebt ${Math.abs(allocationRemaining)} punten te veel verdeeld.`);
      }
      return;
    }

    const ts = new Date().toISOString();
    const eventLabel = selectedPeerEvent.title
      ? ` (${selectedPeerEvent.title})`
      : ' (puntenevent)';
    const peerAwardEntries = [];
    const newAwards = [];

    if (peerTarget === 'group') {
      const groupBonus = new Map();
      allocations.forEach((item) => {
        const awardReason = `Peer punten${eventLabel} (groep) van ${me.name}: ${item.reason}`;
        newAwards.push({
          id: genId(),
          ts,
          target: 'group',
          target_id: item.id,
          amount: item.totalAmount,
          reason: awardReason,
        });
        groupBonus.set(item.id, (groupBonus.get(item.id) || 0) + item.totalAmount);
        const recipients = students
          .filter((s) => s.groupId === item.id)
          .map((s) => s.id);
        peerAwardEntries.push({
          id: genId(),
          ts,
          from_student_id: activeStudentId,
          event_id: selectedPeerEvent.id,
          event_title: selectedPeerEvent.title,
          target: 'group',
          target_id: item.id,
          amount: item.amount,
          total_amount: item.totalAmount,
          reason: item.reason,
          recipients,
        });
      });
      setGroups((prev) =>
        prev.map((g) =>
          groupBonus.has(g.id)
            ? { ...g, points: (Number(g.points) || 0) + groupBonus.get(g.id) }
            : g
        )
      );
    } else {
      const studentBonus = new Map();
      allocations.forEach((item) => {
        const awardReason = `Peer punten${eventLabel} van ${me.name}: ${item.reason}`;
        newAwards.push({
          id: genId(),
          ts,
          target: 'student',
          target_id: item.id,
          amount: item.amount,
          reason: awardReason,
        });
        studentBonus.set(item.id, (studentBonus.get(item.id) || 0) + item.amount);
        peerAwardEntries.push({
          id: genId(),
          ts,
          from_student_id: activeStudentId,
          event_id: selectedPeerEvent.id,
          event_title: selectedPeerEvent.title,
          target: 'student',
          target_id: item.id,
          amount: item.amount,
          total_amount: item.amount,
          reason: item.reason,
          recipients: [item.id],
        });
      });
      setStudents((prev) =>
        prev.map((s) =>
          studentBonus.has(s.id)
            ? { ...s, points: (Number(s.points) || 0) + studentBonus.get(s.id) }
            : s
        )
      );
    }

    setAwards((prev) => [...newAwards, ...prev].slice(0, 500));
    setPeerAwards((prev) => [...peerAwardEntries, ...prev].slice(0, 1000));

    if (peerTarget === 'group') {
      const { error: groupsError } = await saveGroups();
      if (groupsError) {
        setPeerFeedback('Opslaan punten mislukt.');
        return;
      }
    } else {
      const { error: studentsError } = await saveStudents();
      if (studentsError) {
        setPeerFeedback('Opslaan punten mislukt.');
        return;
      }
    }
    const { error: awardsError } = await saveAwards();
    if (awardsError) {
      setPeerFeedback('Opslaan awards mislukt.');
      return;
    }
    const { error: peerError } = await savePeerAwards();
    if (peerError) {
      setPeerFeedback('Opslaan peer-actie mislukt.');
      return;
    }

    setPeerFeedback('Punten toegekend! Dit event is nu vergrendeld.');
  };

  const handleSetNewPassword = async () => {
    if (!resetStudent) return;
    if (!newPassword.trim() || newPassword !== newPassword2) return;
    const id = resetStudent.id;
    const pass = newPassword.trim();
    const hash = hashPassword(pass);
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, password: hash, tempCode: undefined } : s
      )
    );
    const { error } = await saveStudents();
    if (error) {
      alert('Kon wachtwoord niet opslaan: ' + error.message);
      return;
    }
    setResetStudent(null);
    setSelectedStudentId(id);
    setNewPassword('');
    setNewPassword2('');
  };
  
  if (resetStudent) {
    return (
      <div className="max-w-md mx-auto">
        <Card title="Nieuw wachtwoord instellen">
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Nieuw wachtwoord"
            />
            <TextInput
              type="password"
              value={newPassword2}
              onChange={setNewPassword2}
              placeholder="Bevestig wachtwoord"
            />
            <Button
              className="bg-indigo-600 text-white"
              disabled={!newPassword.trim() || newPassword !== newPassword2}
              onClick={handleSetNewPassword}
            >
              Opslaan
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Background image */}
      <div className={`${bgPosClass} inset-0 z-0 pointer-events-none`}>
        <img
          src={process.env.PUBLIC_URL + '/images/voorpagina.png'}
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {activeStudentId && me && (
          inPreview ? (
            <div className="flex items-center justify-between mb-4">
              <span className="bg-white/90 px-2 py-1 rounded text-xs">
                Preview: {me.name}
              </span>
            </div>
          ) : (
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="bg-indigo-600 text-white"
                  onClick={() => {
                    setShowBadges(false);
                    window.location.hash = '/student';
                  }}
                >
                  Overzicht
                </Button>
                <Button
                  className="bg-indigo-600 text-white relative"
                  onClick={() => {
                    setShowBadges(true);
                    window.location.hash = '/student';
                  }}
                  disabled={showBadges}
                >
                  Bekijk badges
                  {hasUnseenBadges && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500" />
                  )}
                </Button>
                <Button
                  className="bg-indigo-600 text-white"
                  onClick={() => (window.location.hash = '/student/profile')}
                >
                  Mijn profiel
                </Button>
                <Button
                  className="bg-emerald-600 text-white"
                  onClick={() => (window.location.hash = '/bingo')}
                >
                  Bingo
                </Button>
                <Button className="bg-indigo-600 text-white" onClick={handleLogout}>
                  Uitloggen
                </Button>
              </div>
              <span className="bg-white/80 px-2 py-1 rounded text-xs">
                Ingelogd als {me.name}
              </span>
            </div>
          )
        )}

        {!activeStudentId ? (
          inPreview ? (
            <div className="max-w-md mx-auto">
              <Card title="Geen student geselecteerd">
                <p className="text-sm text-neutral-700">
                  Selecteer een student om de preview te zien.
                </p>
              </Card>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              {authMode === 'login' ? (
                <Card title="Log in">
                  <div className="grid grid-cols-1 gap-4">
                    <TextInput value={loginEmail} onChange={setLoginEmail} placeholder="E-mail (@student.nhlstenden.com)" />
                    <TextInput
                      type="password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="Wachtwoord of code"
                    />
                    {loginEmail && !emailValid(loginEmail) && (
                      <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
                    )}
                    {loginError && <div className="text-sm text-rose-600">{loginError}</div>}
                    <Button
                      className="bg-indigo-600 text-white"
                      disabled={!loginEmail.trim() || !emailValid(loginEmail) || !loginPassword.trim()}
                      onClick={handleLogin}
                    >
                      Log in
                    </Button>
                    <button
                      className="text-sm text-indigo-600 text-left"
                      onClick={() => {
                        setSignupEmail('');
                        setSignupName('');
                        setSignupPassword('');
                        setSignupPassword2('');
                        setSignupError('');
                        setAuthMode('signup');
                      }}
                    >
                      Account aanmaken
                    </button>
                  </div>
                </Card>
              ) : (
                <Card title="Account aanmaken">
                  <div className="grid grid-cols-1 gap-4">
                    <TextInput
                      value={signupEmail}
                      onChange={(v) => {
                        setSignupEmail(v);
                        setSignupName(nameFromEmail(v));
                      }}
                      placeholder="E-mail (@student.nhlstenden.com)"
                    />
                    {signupEmail && !emailValid(signupEmail) && (
                      <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
                    )}
                    <TextInput value={signupName} onChange={setSignupName} placeholder="Volledige naam" />
                    <TextInput
                      type="password"
                      value={signupPassword}
                      onChange={setSignupPassword}
                      placeholder="Wachtwoord"
                    />
                    <TextInput
                      type="password"
                      value={signupPassword2}
                      onChange={setSignupPassword2}
                      placeholder="Bevestig wachtwoord"
                    />
                    {signupError && <div className="text-sm text-rose-600">{signupError}</div>}
                    <Button
                      className="bg-indigo-600 text-white"
                      disabled={
                        !signupEmail.trim() ||
                        !signupName.trim() ||
                        !emailValid(signupEmail) ||
                        !signupPassword.trim() ||
                        signupPassword !== signupPassword2
                      }
                      onClick={handleSignup}
                    >
                      Account aanmaken
                    </Button>
                    <button
                      className="text-sm text-indigo-600 text-left"
                      onClick={() => {
                        setLoginEmail('');
                        setLoginPassword('');
                        setLoginError('');
                        setSignupPassword('');
                        setSignupPassword2('');
                        setSignupError('');
                        setAuthMode('login');
                      }}
                    >
                      Terug naar inloggen
                    </button>
                  </div>
                </Card>
              )}
            </div>
          )
        ) : showProfile ? (
          <div className="max-w-md mx-auto">
            {me ? (
              <Card title="Mijn profiel">
                <div className="grid grid-cols-1 gap-4">
                  <TextInput value={profileName} onChange={setProfileName} placeholder="Naam" />
                  <div>
                    <label className="block text-sm font-medium mb-1">E-mail</label>
                    <div className="text-sm">{me?.email || '-'}</div>
                  </div>
                  <TextInput
                    type="password"
                    value={profilePassword}
                    onChange={setProfilePassword}
                    placeholder="Nieuw wachtwoord"
                  />
                  <TextInput
                    type="password"
                    value={profilePassword2}
                    onChange={setProfilePassword2}
                    placeholder="Bevestig wachtwoord"
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">Profielfoto</label>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} />
                    {profilePhoto && (
                      <img
                        src={profilePhoto}
                        alt="Profielfoto"
                        className="mt-2 w-32 h-32 object-cover rounded-full"
                      />
                    )}
                  </div>
                  <label className="flex items-start gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={profileShowRank}
                      onChange={(e) => setProfileShowRank(e.target.checked)}
                    />
                    <span>Ik vind het prima dat anderen mijn positie zien op het leaderboard.</span>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      className="bg-indigo-600 text-white"
                      onClick={handleSaveProfile}
                      disabled={!profileName.trim() || (profilePassword && profilePassword !== profilePassword2)}
                    >
                      Opslaan
                    </Button>
                    <Button onClick={() => (window.location.hash = '/student')}>Annuleren</Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card title="Mijn profiel">
                <p className="text-sm text-neutral-600">Selecteer een student om je profiel te bekijken.</p>
              </Card>
            )}
          </div>
        ) : showBadges ? (
          <div className="max-w-3xl mx-auto">
            <Card title="Verdiende badges">
              <p className="text-sm text-gray-600 mb-4">
                Klik op een badge om te zien wat je moet doen om hem te verkrijgen.
              </p>
              <BadgeOverview badgeDefs={badgeDefs} earnedBadges={myBadges} />
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            <Card title="Aanwezigheidsstreak" className="lg:col-span-2">
              {me ? (
                <div className="text-center">
                  <div className="flex items-stretch justify-center gap-4">
                    <div className="flex flex-col self-stretch w-10">
                      {Array.from({ length: freezeTotal }).map((_, index) => {
                        const used = index < freezeUsed;
                        return (
                          <div key={`freeze-${index}`} className="flex-1 flex items-center justify-center">
                            <img
                              src={used ? STREAK_FREEZE_USED_SRC : STREAK_FREEZE_AVAILABLE_SRC}
                              alt={used ? 'Streak freeze gebruikt' : 'Streak freeze beschikbaar'}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold text-indigo-600 mb-2">
                          {myStreaks.current}
                        </div>
                        <div className="text-sm text-gray-600">Huidige streak</div>
                      </div>
                      <div>
                        <div className="text-2xl font-semibold text-green-600">
                          {myStreaks.longest}
                        </div>
                        <div className="text-xs text-gray-500">Langste streak</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    {myStreaks.weekTotal > 0 ? (
                      <>
                        <div>
                          Week {myStreaks.currentWeekKey}: {myStreaks.weekPresent}/
                          {myStreaks.weekTotal} aanwezig
                        </div>
                        <div className="mt-2 h-2 rounded bg-gray-200">
                          <div
                            className="h-2 rounded bg-emerald-500"
                            style={{ width: `${weekPercent}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div>Deze week nog geen bijeenkomsten.</div>
                    )}
                  </div>
                  {myStreaks.prevWeekComplete && myStreaks.prevWeekKey && (
                    <div className="mt-4 p-2 bg-yellow-100 rounded">
                      <div className="text-lg font-bold text-yellow-800">
                        🏆 Bonus toegekend voor week {myStreaks.prevWeekKey}
                      </div>
                      <div className="text-sm text-yellow-700">
                        +{WEEKLY_STREAK_POINTS} punten verdiend
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Selecteer een student om streak te bekijken.</p>
              )}
            </Card>
            <Card title="Nieuwste Badges" className="lg:col-span-2">
              {me ? (
                <div className="grid grid-cols-2 gap-3">
                  {badgeSlots.map((badge, index) => (
                    <div
                      key={badge?.id || `badge-slot-${index}`}
                      className="w-full aspect-square rounded-2xl border bg-white/70 overflow-hidden flex items-center justify-center"
                    >
                      {badge?.image ? (
                        <img
                          src={badge.image}
                          alt={badge.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="sr-only">{badge?.title || 'Lege badge'}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Selecteer een student om badges te bekijken.</p>
              )}
            </Card>

            <Card title="Bingo" className="lg:col-span-2">
              {me ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="grid grid-cols-5 gap-1 w-full max-w-[260px]">
                    {bingoQuestionKeys.map((key, index) => {
                      const filled = bingoFilled[index];
                      const hinted = !filled && bingoHintsEnabled && bingoHinted[index];
                      return (
                        <div
                          key={key}
                          className={`aspect-square rounded-sm border ${
                            filled ? 'bg-emerald-500' : hinted ? 'bg-sky-400' : 'bg-white/70'
                          }`}
                        />
                      );
                    })}
                  </div>
                  {bingoHintsEnabled && (
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-600">
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-3 w-3 rounded-sm border bg-emerald-500" />
                        Match gevonden
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-3 w-3 rounded-sm border bg-sky-400" />
                        Match mogelijk
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Selecteer een student om bingo te bekijken.</p>
              )}
            </Card>

            <Card title="Geef punten" className="lg:col-span-2">
              {!me ? (
                <p className="text-sm text-neutral-600">Selecteer een student om punten te geven.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  {activePeerEvents.length === 0 ? (
                    <div className="text-xs text-rose-600">
                      Er is momenteel geen open puntenevent.
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">
                        Puntenevent (docent)
                      </label>
                      {activePeerEvents.length > 1 ? (
                        <Select value={peerEventId} onChange={setPeerEventId}>
                          {activePeerEvents.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.title}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <div className="text-sm font-medium">
                          {activePeerEvents[0]?.title || '—'}
                        </div>
                      )}
                      {selectedPeerEvent?.description && (
                        <p className="text-xs text-neutral-500 mt-1">
                          {selectedPeerEvent.description}
                        </p>
                      )}
                      {scopeLabel && (
                        <p className="text-xs text-neutral-500 mt-1">
                          Doelgroep: {scopeLabel}
                        </p>
                      )}
                      {selectedPeerEvent && peerEventBudget <= 0 && (
                        <p className="text-xs text-rose-600 mt-1">
                          Dit event heeft nog geen budget.
                        </p>
                      )}
                      {selectedPeerEvent && recipientScope === 'own_group' && !me?.groupId && (
                        <p className="text-xs text-rose-600 mt-1">
                          Je zit nog niet in een groep. Vraag je docent om je in te delen.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-600">
                      Budget: {peerBudgetRemaining}/{peerEventBudget}
                    </span>
                    <span className="text-xs text-neutral-500">Besteed: {peerEventSpent}</span>
                    <span className="text-xs text-neutral-500">
                      Verdeeld: {displayAllocated}
                    </span>
                    <span
                      className={`text-xs ${
                        allocationRemaining === 0
                          ? 'text-emerald-600'
                          : allocationRemaining < 0
                          ? 'text-rose-600'
                          : 'text-neutral-500'
                      }`}
                    >
                      {allocationRemaining === 0
                        ? 'Alle punten verdeeld.'
                        : allocationRemaining < 0
                        ? `Te veel verdeeld: ${Math.abs(allocationRemaining)}`
                        : `Nog te verdelen: ${allocationRemaining}`}
                    </span>
                    <span className="text-xs text-neutral-500">
                      Totaal = punten × aantal ontvangers (groep = aantal studenten).
                    </span>
                  </div>
                  {peerEventLocked && (
                    <div className="text-xs text-rose-600">
                      Je hebt dit event al ingevuld. Aanpassen is niet mogelijk.
                    </div>
                  )}
                  {peerTarget === 'group' && (
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Groepen</label>
                      {eligibleAwardGroupsWithMembers.length === 0 ? (
                        <div className="text-xs text-neutral-500">
                          Er zijn geen andere groepen beschikbaar voor dit event.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 text-xs max-h-52 overflow-auto border rounded p-2 bg-white/70">
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                            <span className="flex-1">Groep</span>
                            <span className="w-20 text-right">Punten p.p.</span>
                            <span className="flex-1">Reden</span>
                            <span className="w-20 text-right">Totaal</span>
                          </div>
                          {eligibleAwardGroupsWithMembers.map((g) => {
                            const count = groupMemberCounts.get(g.id) || 0;
                            const amount = peerAllocations[g.id]?.amount ?? '';
                            const reason = peerAllocations[g.id]?.reason ?? '';
                            const total = (Number(amount) || 0) * count;
                            return (
                              <div key={g.id} className="flex items-center gap-2">
                                <span className="flex-1">
                                  {g.name} ({count})
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  className="w-20 text-right text-sm"
                                  value={amount}
                                  disabled={peerEventLocked}
                                  onChange={(e) => updateAllocationAmount(g.id, e.target.value)}
                                />
                                <input
                                  type="text"
                                  className="flex-1 text-sm"
                                  value={reason}
                                  disabled={peerEventLocked}
                                  placeholder="Waarom?"
                                  onChange={(e) => updateAllocationReason(g.id, e.target.value)}
                                />
                                <span className="w-20 text-right text-neutral-500">
                                  {total}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {peerTarget === 'student' && (
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">
                        Studenten
                      </label>
                      {eligibleStudents.length === 0 ? (
                        <div className="text-xs text-neutral-500">
                          Er zijn geen studenten beschikbaar voor dit event.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 text-xs max-h-52 overflow-auto border rounded p-2 bg-white/70">
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                            <span className="flex-1">Student</span>
                            <span className="w-20 text-right">Punten</span>
                            <span className="flex-1">Reden</span>
                          </div>
                          {eligibleStudents.map((s) => {
                            const groupName = s.groupId
                              ? groupById.get(s.groupId)?.name || 'Groep'
                              : null;
                            const amount = peerAllocations[s.id]?.amount ?? '';
                            const reason = peerAllocations[s.id]?.reason ?? '';
                            return (
                              <div key={s.id} className="flex items-center gap-2">
                                <span className="flex-1">
                                  {s.name}
                                  {groupName ? ` (${groupName})` : ''}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  className="w-20 text-right text-sm"
                                  value={amount}
                                  disabled={peerEventLocked}
                                  onChange={(e) => updateAllocationAmount(s.id, e.target.value)}
                                />
                                <input
                                  type="text"
                                  className="flex-1 text-sm"
                                  value={reason}
                                  disabled={peerEventLocked}
                                  placeholder="Waarom?"
                                  onChange={(e) => updateAllocationReason(s.id, e.target.value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {peerFeedback && (
                    <div className="text-xs text-neutral-600">{peerFeedback}</div>
                  )}
                  <Button
                    className="bg-indigo-600 text-white"
                    onClick={handlePeerAward}
                    disabled={
                      !selectedPeerEvent ||
                      peerEventLocked ||
                      !peerTarget ||
                      peerBudgetRemaining <= 0 ||
                      allocationTotalCost <= 0 ||
                      allocationItems.length === 0 ||
                      allocationTotalCost !== peerBudgetRemaining ||
                      !hasAllocations
                    }
                  >
                    Punten geven
                  </Button>
                </div>
              )}
            </Card>

            <Card title="Jouw recente activiteiten" className="lg:col-span-2 max-h-[320px] overflow-auto">
              <ul className="space-y-2 text-sm">
                {myAwards.length === 0 && !awardsError && <li>Geen recente items.</li>}
                {myAwards.map((a) => {
                  const isNewBadge = a.reason?.startsWith('Badge behaald:') && a.amount > 0;
                  const badgeId = isNewBadge ? a.reason.replace('Badge behaald: ', '') : null;
                  const badgeTitle = badgeId ? badgeDefs.find(b => b.id === badgeId)?.title || badgeId : null;
                  return (
                    <li key={a.id} className="flex flex-col gap-1">
                      <div className="flex justify-between gap-2">
                        <span>
                          {new Date(a.ts).toLocaleDateString('nl-NL')} · {a.target === 'student' ? 'Individueel' : `Groep (${myGroup?.name || '-'})`}{' '}
                          {a.reason ? `— ${a.reason}` : ''}
                        </span>
                        <span className={`font-semibold ${a.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{a.amount >= 0 ? '+' : ''}{a.amount}</span>
                      </div>
                      {isNewBadge && badgeTitle && (
                        <span className="text-xs text-indigo-700">🏅 Gefeliciteerd met je nieuwe badge: {badgeTitle}!</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Leaderboard – Individueel" className="lg:col-span-2">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Student</th>
                    <th className="py-1 pr-2 text-right">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  <>
                    {topLeaderboardRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b last:border-0 ${
                          row.id === activeStudentId ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <td className="py-1 pr-2">{row.rank}</td>
                        <td className="py-1 pr-2">{row.name}</td>
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
                    {extraLeaderboardRows.length > 0 && (
                      <>
                        <tr className="border-b">
                          <td colSpan="3" className="py-1"></td>
                        </tr>
                        {extraLeaderboardRows.map((row) => (
                          <tr
                            key={row.id}
                            className={row.id === activeStudentId ? 'bg-indigo-50' : ''}
                          >
                            <td className="py-1 pr-2">{row.rank}</td>
                            <td className="py-1 pr-2">{row.name}</td>
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
                      </>
                    )}
                  </>
                </tbody>
              </table>
            </Card>

            <Card title="Leaderboard – Groepen" className="lg:col-span-2">
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
                    <tr key={row.id} className={row.id === myGroup?.id ? 'bg-indigo-50' : ''}>
                      <td className="py-1 pr-2">{row.rank}</td>
                      <td className="py-1 pr-2">{row.name}</td>
                      <td className={`py-1 pr-2 text-right font-semibold ${row.total > 0 ? 'text-emerald-700' : row.total < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{Math.round(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}
