import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, TextInput, Select } from './components/ui';
import BadgeChecklist from './components/BadgeChecklist';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import { genId, emailValid, getIndividualLeaderboard, getGroupLeaderboard, teacherEmailValid } from './utils';
import Student from './Student';
import useBadges from './hooks/useBadges';
import usePersistentState from './hooks/usePersistentState';
import useTeachers from './hooks/useTeachers';
import bcrypt from 'bcryptjs';

export default function Admin() {
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

  const addGroup = useCallback((name) => {
    const id = genId();
    setGroups((prev) => [...prev, { id, name, points: 0 }]);
    return id;
  }, [setGroups]);

  const toggleStudentBadge = useCallback((studentId, badgeId, hasBadge) => {
    if (!studentId || !badgeId) return;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const current = new Set(s.badges || []);
        if (hasBadge) current.add(badgeId); else current.delete(badgeId);
        return { ...s, badges: Array.from(current) };
      })
    );
  }, [setStudents]);

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

  const [resetStudentId, setResetStudentId] = useState(students[0]?.id || '');
  const [resetCode, setResetCode] = useState('');

  const handleResetPassword = useCallback(() => {
    if (!resetStudentId) return;
    const code = Math.random().toString(36).slice(2, 8);
    setStudents((prev) =>
      prev.map((s) =>
        s.id === resetStudentId ? { ...s, password: '', tempCode: code } : s
      )
    );
    setResetCode(code);
  }, [resetStudentId, setStudents]);

  const [assignStudentId, setAssignStudentId] = useState(students[0]?.id || '');
  const [assignGroupId, setAssignGroupId] = useState(groups[0]?.id || '');

  const [removeStudentId, setRemoveStudentId] = useState(students[0]?.id || '');

  const [page, setPage] = useState('add-student');

  // Preview state (gedeeld met Student-weergave via localStorage)
  const [selectedStudentId, setSelectedStudentId] = usePersistentState('nm_points_current_student', '');

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

  useEffect(() => {
    if (students.length && !students.find((s) => s.id === assignStudentId)) {
      setAssignStudentId(students[0]?.id || '');
    }
  }, [students, assignStudentId]);

  useEffect(() => {
    if (groups.length && !groups.find((g) => g.id === assignGroupId)) {
      setAssignGroupId(groups[0]?.id || '');
    }
  }, [groups, assignGroupId]);

  useEffect(() => {
    if (students.length && !students.find((s) => s.id === removeStudentId)) {
      setRemoveStudentId(students[0]?.id || '');
    }
  }, [students, removeStudentId]);

  useEffect(() => {
    if (students.length && !students.find((s) => s.id === resetStudentId)) {
      setResetStudentId(students[0]?.id || '');
    }
  }, [students, resetStudentId]);

  // Houd preview-selectie geldig als de lijst verandert
  useEffect(() => {
    if (selectedStudentId && !students.find((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(students[0]?.id || '');
    }
  }, [students, selectedStudentId, setSelectedStudentId]);

  return (
    <div className="space-y-4">
      <Select value={page} onChange={setPage} className="max-w-xs">
        <option value="add-student">Student toevoegen</option>
        <option value="remove-student">Student verwijderen</option>
        <option value="reset-password">Wachtwoord resetten</option>
        <option value="add-group">Groep toevoegen</option>
        <option value="assign-group">Student aan groep koppelen</option>
        <option value="badges">Badges toekennen</option>
        <option value="manage-badges">Badges beheren</option>
        <option value="manage-teachers">Docenten beheren</option>
        <option value="points">Punten invoeren</option>
        <option value="leaderboard-students">Scorebord – Individueel</option>
        <option value="leaderboard-groups">Scorebord – Groepen</option>
        <option value="backup">Backup & herstel</option>
        <option value="preview">Preview student</option>
      </Select>

      {page === 'add-student' && (
        <Card title="Student toevoegen">
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
            <div className="flex gap-2 items-center">
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
                Voeg toe
              </Button>
            </div>
          </div>
        </Card>
      )}

      {page === 'remove-student' && (
        <Card title="Student verwijderen">
          <div className="grid grid-cols-1 gap-2">
            <Select value={removeStudentId} onChange={setRemoveStudentId}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button
              className="bg-rose-600 text-white"
              disabled={!removeStudentId}
              onClick={() => {
                const student = students.find((s) => s.id === removeStudentId);
                const name = student?.name || 'deze student';
                if (window.confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) {
                  removeStudent(removeStudentId);
                }
              }}
            >
              Verwijder
            </Button>
          </div>
        </Card>
      )}

      {page === 'reset-password' && (
        <Card title="Wachtwoord resetten">
          <div className="grid grid-cols-1 gap-2">
            <Select value={resetStudentId} onChange={setResetStudentId}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button
              className="bg-indigo-600 text-white"
              disabled={!resetStudentId}
              onClick={handleResetPassword}
            >
              Genereer code
            </Button>
            {resetCode && (
              <div className="text-sm">
                Tijdelijke code: <code>{resetCode}</code>
              </div>
            )}
          </div>
        </Card>
      )}

      {page === 'add-group' && (
        <Card title="Groep toevoegen">
          <div className="grid grid-cols-1 gap-2">
            <TextInput value={newGroup} onChange={setNewGroup} placeholder="Groepsnaam" />
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
        </Card>
      )}

      {page === 'assign-group' && (
        <>
          <Card title="Student aan groep koppelen">
            <div className="grid grid-cols-1 gap-2">
              <Select value={assignStudentId} onChange={setAssignStudentId}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select value={assignGroupId} onChange={setAssignGroupId}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <Button
                className="bg-indigo-600 text-white"
                disabled={!assignStudentId || !assignGroupId}
                onClick={() => {
                  setStudents((prev) =>
                    prev.map((s) => (s.id === assignStudentId ? { ...s, groupId: assignGroupId } : s))
                  );
                }}
              >
                Koppel
              </Button>
            </div>
          </Card>

          <Card title="Overzicht groepsindeling">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1 pr-2">Student</th>
                  <th className="py-1 pr-2">E-mail</th>
                  <th className="py-1 pr-2">Groep</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">{s.name}</td>
                    <td className="py-1 pr-2">{s.email || '-'}</td>
                    <td className="py-1 pr-2">{s.groupId ? groupById.get(s.groupId)?.name || '-' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
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

      {page === 'leaderboard-students' && (
        <Card title="Leaderboard – Individueel">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Student</th>
                <th className="py-1 pr-2 text-right">Punten</th>
              </tr>
            </thead>
            <tbody>
              {individualLeaderboard.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-1 pr-2">{row.rank}</td>
                  <td className="py-1 pr-2">{row.name}</td>
                  <td
                    className={`py-1 pr-2 text-right font-semibold ${
                      row.points > 0 ? 'text-emerald-700' : row.points < 0 ? 'text-rose-700' : 'text-neutral-700'
                    }`}
                  >
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {page === 'leaderboard-groups' && (
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
                      row.total > 0 ? 'text-emerald-700' : row.total < 0 ? 'text-rose-700' : 'text-neutral-700'
                    }`}
                  >
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <Select value={selectedStudentId} onChange={setSelectedStudentId}>
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
              <Button className="border" onClick={() => setSelectedStudentId('')}>Leegmaken</Button>
              <a href="#/admin/preview" className="px-4 py-2 rounded-2xl border">Open als losse pagina</a>
            </div>
          </div>

          <div className="mt-4">
            <Student
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          </div>
        </Card>
      )}
    </div>
  );
}