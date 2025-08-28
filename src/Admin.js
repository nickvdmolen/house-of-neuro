import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, TextInput, Select } from './components/ui';
import BadgeChecklist from './components/BadgeChecklist';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import { genId, emailValid, getIndividualLeaderboard, getGroupLeaderboard, teacherEmailValid } from './utils';
import Student from './Student';
import useBadges from './hooks/useBadges';
import useTeachers from './hooks/useTeachers';
import bcrypt from 'bcryptjs';
import usePersistentState from './hooks/usePersistentState';

const BADGE_POINTS = 50;

export default function Admin({ onLogout = () => {} }) {
  const [students, setStudents] = useStudents();
  const [groups, setGroups] = useGroups();
  const [awards, setAwards] = useAwards();
  const [badgeDefs, setBadgeDefs] = useBadges();
  const [teachers, setTeachers] = useTeachers();
  const [restoreFile, setRestoreFile] = useState(null);

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

  const individualLeaderboard = useMemo(() => getIndividualLeaderboard(students), [students]);

  const groupLeaderboard = useMemo(
    () => getGroupLeaderboard(groups, students),
    [groups, students]
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

  const addStudent = useCallback((name, email, password = '') => {
    const id = genId();
    setStudents((prev) => [
      ...prev,
      { id, name, email: email || undefined, password, groupId: null, points: 0, badges: [] }
    ]);
    return id;
  }, [setStudents]);

  const removeStudent = useCallback((id) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }, [setStudents]);

  const resetStudentPassword = useCallback(
    (id) => {
      const pwd = window.prompt('Nieuw wachtwoord:');
      if (!pwd?.trim()) return;
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, password: pwd.trim(), tempCode: undefined }
            : s
        )
      );
    },
    [setStudents]
  );

  const addGroup = useCallback((name) => {
    const id = genId();
    setGroups((prev) => [...prev, { id, name, points: 0 }]);
    return id;
  }, [setGroups]);

  const removeGroup = useCallback((id) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setStudents((prev) =>
      prev.map((s) => (s.groupId === id ? { ...s, groupId: null } : s))
    );
  }, [setGroups, setStudents]);

  const toggleStudentBadge = useCallback((studentId, badgeId, hasBadge) => {
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
    if (delta !== 0) {
      const badgeTitle = badgeDefs.find((b) => b.id === badgeId)?.title || badgeId;
      const award = {
        id: genId(),
        ts: Date.now(),
        type: 'student',
        targetId: studentId,
        amount: delta,
        reason: `Badge ${badgeTitle}`,
      };
      setAwards((prev) => [award, ...prev].slice(0, 500));
    }
  }, [setStudents, setAwards, badgeDefs]);

  const awardToStudent = useCallback((studentId, amount, reason) => {
    if (!studentId || !Number.isFinite(amount)) return;
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, points: s.points + amount } : s)));
    const award = { id: genId(), ts: Date.now(), type: 'student', targetId: studentId, amount, reason };
    setAwards((prev) => [award, ...prev].slice(0, 500));
  }, [setStudents, setAwards]);

  const awardToGroup = useCallback((groupId, amount, reason) => {
    if (!groupId || !Number.isFinite(amount)) return;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, points: g.points + amount } : g)));
    const award = { id: genId(), ts: Date.now(), type: 'group', targetId: groupId, amount, reason };
    setAwards((prev) => [award, ...prev].slice(0, 500));
  }, [setGroups, setAwards]);

  const [newStudent, setNewStudent] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [studentSort, setStudentSort] = useState('name');
  const [newGroup, setNewGroup] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const resetTeacherPassword = useCallback((id) => {
    const pwd = window.prompt('Nieuw wachtwoord:');
    if (!pwd?.trim()) return;
    const hash = bcrypt.hashSync(pwd.trim(), 10);
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, passwordHash: hash } : t))
    );
  }, [setTeachers]);
  const removeTeacher = useCallback((id) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  }, [setTeachers]);
  const approveTeacher = useCallback((id) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, approved: true } : t))
    );
  }, [setTeachers]);
  const [badgeStudentId, setBadgeStudentId] = useState('');
  const [awardType, setAwardType] = useState('student');
  const [awardStudentIds, setAwardStudentIds] = useState(students[0] ? [students[0].id] : []);
  const [awardGroupId, setAwardGroupId] = useState(groups[0]?.id || '');
  const [awardAmount, setAwardAmount] = useState(5);
  const [awardReason, setAwardReason] = useState('');

  const [newBadgeTitle, setNewBadgeTitle] = useState('');
  const [newBadgeImage, setNewBadgeImage] = useState('');
  const [newBadgeRequirement, setNewBadgeRequirement] = useState('');

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
    setNewBadgeRequirement('');
  }, [newBadgeTitle, newBadgeImage, newBadgeRequirement, setBadgeDefs]);

  const removeBadge = useCallback((badgeId) => {
    setBadgeDefs((prev) => prev.filter((b) => b.id !== badgeId));
  }, [setBadgeDefs]);

  const handleBackup = useCallback(() => {
    const data = { students, groups, awards, badges: badgeDefs, teachers };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [students, groups, awards, badgeDefs, teachers]);

  const handleRestore = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.students)) setStudents(data.students);
        if (Array.isArray(data.groups)) setGroups(data.groups);
        if (Array.isArray(data.awards)) setAwards(data.awards);
        if (Array.isArray(data.badges)) setBadgeDefs(data.badges);
        if (Array.isArray(data.teachers)) setTeachers(data.teachers);
      } catch {
        alert('Ongeldige backup');
      }
    };
    reader.readAsText(file);
  }, [setStudents, setGroups, setAwards, setBadgeDefs, setTeachers]);
  const [page, setPage] = useState('points');

  // Preview state (gedeeld met Student-weergave via localStorage)
  const [previewId, setPreviewId] = usePersistentState('nm_preview_student', '');

  useEffect(() => {
    if (students.length === 0) {
      setAwardStudentIds([]);
    } else {
      setAwardStudentIds((prev) => {
        const valid = prev.filter((id) => students.some((s) => s.id === id));
        return valid.length ? valid : [students[0].id];
      });
    }
  }, [students]);

  useEffect(() => {
    if (groups.length && !groups.find((g) => g.id === awardGroupId)) {
      setAwardGroupId(groups[0]?.id || '');
    }
  }, [groups, awardGroupId]);

  // Houd preview-selectie geldig als de lijst verandert
  useEffect(() => {
    if (previewId && !students.find((s) => s.id === previewId)) {
      setPreviewId(students[0]?.id || '');
    }
  }, [students, previewId]);

  const menuItems = [
    { value: 'scores', label: 'Scores' },
    { value: 'points', label: 'Punten invoeren' },
    { value: 'badges', label: 'Badges toekennen' },
    { value: 'manage-groups', label: 'Groepen beheren' },
    { value: 'manage-students', label: 'Studenten beheren' },
    { value: 'manage-teachers', label: 'Docenten beheren' },
    { value: 'manage-badges', label: 'Badges beheren' },
    { value: 'backup', label: 'Backup & herstel' },
    { value: 'preview', label: 'Preview student' }
  ];

  return (

    <div className="pl-60">
      <nav className="fixed left-0 top-0 h-screen w-60 overflow-y-auto border-r bg-white p-4 space-y-2">

        {menuItems.map((item) => (
          <button
            key={item.value}
            onClick={() => setPage(item.value)}
            className={`block w-full text-left px-2 py-1 rounded ${page === item.value ? 'bg-neutral-200' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4">
          <span className="bg-white/90 px-2 py-1 rounded">Ingelogd als beheerder</span>
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
                      {row.total}
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
              disabled={!newStudent.trim() || (newStudentEmail.trim() !== '' && !emailValid(newStudentEmail))}
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
              {students
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
                        onChange={(val) =>
                          setStudents((prev) =>
                            prev.map((st) =>
                              st.id === s.id ? { ...st, groupId: val || null } : st
                            )
                          )
                        }
                        className="w-40"
                      >
                        <option value="">Geen</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </Select>
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
              {groups.map((g) => {
                const members = students.filter((s) => s.groupId === g.id);
                return (
                  <li key={g.id} className="border rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{g.name}</span>
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
                            onClick={() =>
                              setStudents((prev) =>
                                prev.map((s) =>
                                  s.id === m.id ? { ...s, groupId: null } : s
                                )
                              )
                            }
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
                        if (val)
                          setStudents((prev) =>
                            prev.map((s) =>
                              s.id === val ? { ...s, groupId: g.id } : s
                            )
                          );
                      }}
                      className="mt-2"
                    >
                      <option value="">Voeg student toe…</option>
                      {students
                        .filter((s) => s.groupId !== g.id)
                        .map((s) => (
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
              {students.map((s) => (
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 p-4">
              {badgeDefs.map((b) => (
                <div key={b.id} className="flex flex-col items-center text-sm">
                  <div className="relative">
                    <img
                      src={b.image}
                      alt={b.title}
                      className="badge-box rounded-full border object-cover"
                    />
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center text-xl text-white rounded-full z-0"
                      onClick={() =>
                        document.getElementById(`edit-badge-image-${b.id}`).click()
                      }
                      style={{ background: 'transparent' }}
                    >
                      ✏️
                    </button>
                    <Button
                      className="absolute top-1 right-1 p-1 text-rose-600 bg-white/80 rounded-full text-xs z-10"
                      onClick={() => {
                        if (window.confirm('Badge verwijderen?')) removeBadge(b.id);
                      }}
                    >
                      <span style={{ display: 'inline-block', transform: 'scaleX(0.5)' }}>
                        &#x2715;
                      </span>
                    </Button>
                  </div>
                  <div className="mt-2 text-center w-full">
                    <span>{b.title}</span>
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
                      className="mt-1 text-xs"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    id={`edit-badge-image-${b.id}`}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setBadgeDefs((prev) =>
                          prev.map((bd) =>
                            bd.id === b.id ? { ...bd, image: ev.target.result } : bd
                          )
                        );
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              ))}
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setNewBadgeImage(ev.target.result);
                  reader.readAsDataURL(file);
                }}
              />
              {newBadgeImage && (
                <img
                  src={newBadgeImage}
                  alt="Preview"
                  className="badge-box rounded-full border object-cover"
                />
              )}
              <Button
                className="bg-indigo-600 text-white"
                disabled={!newBadgeTitle.trim() || !newBadgeImage}
                onClick={addBadge}
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
              onClick={() => {
                const email = newTeacherEmail.trim().toLowerCase();
                if (teachers.some((t) => t.email.toLowerCase() === email)) return;
                const hash = bcrypt.hashSync(newTeacherPassword.trim(), 10);
                setTeachers((prev) => [
                  ...prev,
                  { id: genId(), email, passwordHash: hash, approved: true },
                ]);
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
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select value={awardGroupId} onChange={setAwardGroupId}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div>
              <label className="text-sm">Punten</label>
              <TextInput value={String(awardAmount)} onChange={(v) => setAwardAmount(Number(v))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">Reden</label>
              <TextInput value={awardReason} onChange={setAwardReason} />
            </div>
            <Button
              className="bg-indigo-600 text-white md:col-span-5"
              disabled={awardType === 'student' ? awardStudentIds.length === 0 : !awardGroupId}
              onClick={() => {
                if (awardType === 'student') {
                  awardStudentIds.forEach((id) => awardToStudent(id, awardAmount, awardReason.trim()));
                } else {
                  awardToGroup(awardGroupId, awardAmount, awardReason.trim());
                }
                setAwardReason('');
              }}
            >
              Toekennen
            </Button>
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

      {page === 'preview' && (
        <Card title="Preview student">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-end">
            <div>
              <label className="text-sm">Student</label>
              <Select value={previewId} onChange={setPreviewId}>
                <option value="">— Kies student —</option>
                {students.map((s) => (
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