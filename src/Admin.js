import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, TextInput, Select } from './components/ui';
import BadgeChecklist from './components/BadgeChecklist';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import { genId, emailValid, getIndividualLeaderboard, getGroupLeaderboard } from './utils';
import { BADGE_DEFS } from './badgeDefs';

export default function Admin() {
  const [students, setStudents] = useStudents();
  const [groups, setGroups] = useGroups();
  const [, setAwards] = useAwards();

  const studentById = useMemo(() => {
    const m = new Map();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const individualLeaderboard = useMemo(() => getIndividualLeaderboard(students), [students]);

  const groupLeaderboard = useMemo(
    () => getGroupLeaderboard(groups, students),
    [groups, students]
  );

  const addStudent = useCallback((name, email) => {
    const id = genId();
    setStudents((prev) => [...prev, { id, name, email: email || undefined, groupId: null, points: 0, badges: [] }]);
    return id;
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
  const [badgeStudentId, setBadgeStudentId] = useState('');
  const [awardType, setAwardType] = useState('student');
  const [awardStudentIds, setAwardStudentIds] = useState(students[0] ? [students[0].id] : []);
  const [awardGroupId, setAwardGroupId] = useState(groups[0]?.id || '');
  const [awardAmount, setAwardAmount] = useState(5);
  const [awardReason, setAwardReason] = useState('');

  const [page, setPage] = useState('add-student');

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

  return (
    <div className="space-y-4">
      <Select value={page} onChange={setPage} className="max-w-xs">
        <option value="add-student">Student toevoegen</option>
        <option value="add-group">Groep toevoegen</option>
        <option value="badges">Badges toekennen</option>
        <option value="points">Punten invoeren</option>
        <option value="leaderboard-students">Scorebord – Individueel</option>
        <option value="leaderboard-groups">Scorebord – Groepen</option>
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

      {page === 'badges' && (
        <Card title="Badges toekennen">
          <div className="grid grid-cols-1 gap-2">
            <Select value={badgeStudentId} onChange={setBadgeStudentId}>
              <option value="">Kies student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {badgeStudentId && (
              <BadgeChecklist
                badgeDefs={BADGE_DEFS}
                studentBadges={studentById.get(badgeStudentId)?.badges || []}
                onToggle={(badgeId, checked) => toggleStudentBadge(badgeStudentId, badgeId, checked)}
              />
            )}
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
          <table className="w-full text-sm">
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
          <table className="w-full text-sm">
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
    </div>
  );
}
