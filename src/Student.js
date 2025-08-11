import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, Button, TextInput, Select } from './components/ui';
import BadgeOverview from './components/BadgeOverview';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import { genId, emailValid, getIndividualLeaderboard, getGroupLeaderboard } from './utils';
import { BADGE_DEFS } from './badgeDefs';

export default function Student() {
  const [students, setStudents] = useStudents();
  const [groups] = useGroups();
  const [awards] = useAwards();

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

  const addStudent = useCallback((name, email) => {
    const id = genId();
    setStudents((prev) => [...prev, { id, name, email: email || undefined, groupId: null, points: 0, badges: [] }]);
    return id;
  }, [setStudents]);

  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '');
  useEffect(() => {
    if (students.length && !students.find((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  const me = students.find((s) => s.id === selectedStudentId) || null;
  const myGroup = me && me.groupId ? groupById.get(me.groupId) || null : null;
  const myBadges = me?.badges || [];

  const myAwards = useMemo(() => {
    return awards.filter(
      (a) =>
        (a.type === 'student' && a.targetId === selectedStudentId) ||
        (a.type === 'group' && myGroup && a.targetId === myGroup.id)
    );
  }, [awards, selectedStudentId, myGroup]);

  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const handleSelfSignup = () => {
    if (!signupEmail.trim() || !signupName.trim() || !emailValid(signupEmail)) return;
    const existing = students.find((s) => s.email === signupEmail.trim());
    if (existing) {
      setSelectedStudentId(existing.id);
    } else {
      const newId = addStudent(signupName.trim(), signupEmail.trim());
      setSelectedStudentId(newId);
    }
    setSignupEmail('');
    setSignupName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <Card title="Selecteer student" className="lg:col-span-2">
        <Select value={selectedStudentId} onChange={setSelectedStudentId}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Card>

      <Card title="Nog geen account? Zelf aanmaken" className="lg:col-span-3">
        <div className="grid grid-cols-1 gap-2">
          <TextInput value={signupEmail} onChange={setSignupEmail} placeholder="E-mail (@student.nhlstenden.com)" />
          {signupEmail && !emailValid(signupEmail) && (
            <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
          )}
          <TextInput value={signupName} onChange={setSignupName} placeholder="Volledige naam" />
          <Button
            className="bg-indigo-600 text-white"
            disabled={!signupEmail.trim() || !signupName.trim() || !emailValid(signupEmail)}
            onClick={handleSelfSignup}
          >
            Maak account
          </Button>
        </div>
      </Card>

      <Card title="Badges" className="lg:col-span-3">
        {me ? (
          <BadgeOverview badgeDefs={BADGE_DEFS} earnedBadges={myBadges} />
        ) : (
          <p className="text-sm text-neutral-600">Selecteer een student om badges te bekijken.</p>
        )}
      </Card>

      <Card title="Jouw recente activiteiten" className="lg:col-span-2 max-h-[320px] overflow-auto">
        <ul className="space-y-2 text-sm">
          {myAwards.length === 0 && <li>Geen recente items.</li>}
          {myAwards.map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span>
                {new Date(a.ts).toLocaleString()} · {a.type === 'student' ? 'Individueel' : `Groep (${myGroup?.name || '-'})`} {a.reason ? `— ${a.reason}` : ''}
              </span>
              <span className={`font-semibold ${a.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{a.amount >= 0 ? '+' : ''}{a.amount}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Leaderboard – Individueel" className="lg:col-span-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Student</th>
              <th className="py-1 pr-2 text-right">Punten</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const top3 = individualLeaderboard.slice(0, 3);
              const meRow = individualLeaderboard.find((r) => r.id === selectedStudentId);
              const isTop3 = meRow && meRow.rank <= 3;
              return (
                <>
                  {top3.map((row) => (
                    <tr key={row.id} className={`border-b last:border-0 ${row.id === selectedStudentId ? 'bg-indigo-50' : ''}`}>
                      <td className="py-1 pr-2">{row.rank}</td>
                      <td className="py-1 pr-2">{row.name}</td>
                      <td className={`py-1 pr-2 text-right font-semibold ${row.points > 0 ? 'text-emerald-700' : row.points < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{row.points}</td>
                    </tr>
                  ))}
                  {!isTop3 && meRow && (
                    <>
                      <tr className="border-b"><td colSpan="3" className="py-1"></td></tr>
                      <tr className="bg-indigo-50">
                        <td className="py-1 pr-2">{meRow.rank}</td>
                        <td className="py-1 pr-2">{meRow.name}</td>
                        <td className={`py-1 pr-2 text-right font-semibold ${meRow.points > 0 ? 'text-emerald-700' : meRow.points < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{meRow.points}</td>
                      </tr>
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </Card>

      <Card title="Leaderboard – Groepen" className="lg:col-span-3">
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
              <tr key={row.id} className={row.id === myGroup?.id ? 'bg-indigo-50' : ''}>
                <td className="py-1 pr-2">{row.rank}</td>
                <td className="py-1 pr-2">{row.name}</td>
                <td className={`py-1 pr-2 text-right font-semibold ${row.total > 0 ? 'text-emerald-700' : row.total < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
