import React, { useEffect, useMemo, useState, useCallback } from "react";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const LS_KEYS = {
  students: "nm_points_students_v2",
  groups: "nm_points_groups_v2",
  awards: "nm_points_awards_v2",
};

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const seedStudents = [
  { id: "s1", name: "Alex",  email: "alex@student.nhlstenden.com",  groupId: "g1", points: 10 },
  { id: "s2", name: "Bo",    email: "bo@student.nhlstenden.com",    groupId: "g1", points: 5  },
  { id: "s3", name: "Casey", email: "casey@student.nhlstenden.com", groupId: "g2", points: 12 },
];

const seedGroups = [
  { id: "g1", name: "Team EEG",       points: 20 },
  { id: "g2", name: "Team Eye-Track", points: 8  },
];

const seedAwards = [
  { id: "a1", ts: Date.now() - 1000 * 60 * 60, type: "group",   targetId: "g1", amount: 10, reason: "Kick-off pitch" },
  { id: "a2", ts: Date.now() - 1000 * 60 * 50, type: "student", targetId: "s3", amount: 4,  reason: "Reading quiz"   },
];

const EMAIL_RE = /@student\.nhlstenden\.com$/i;
const emailValid = (email) => EMAIL_RE.test((email || "").trim());

function usePersistentState(key, initial) {
  const [state, setState] = useState(() => loadLS(key, initial));
  useEffect(() => saveLS(key, state), [key, state]);
  return [state, setState];
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl shadow p-4 bg-white ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      {children}
    </div>
  );
}

function Button({ children, onClick, type = "button", className = "", disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl shadow px-4 py-2 hover:opacity-90 active:scale-[0.99] transition border border-neutral-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${className}`}
    />
  );
}

function Select({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl border border-neutral-300 px-3 py-2 bg-white ${className}`}
    >
      {children}
    </select>
  );
}

export default function App() {
  const [students, setStudents] = usePersistentState(LS_KEYS.students, seedStudents);
  const [groups,   setGroups]   = usePersistentState(LS_KEYS.groups,   seedGroups);
  const [awards,   setAwards]   = usePersistentState(LS_KEYS.awards,   seedAwards);

  const getRoute = () => (typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : '/student');
  const [route, setRoute] = useState(getRoute());
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const ADMIN_LS = 'nm_is_admin_v1';
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return localStorage.getItem(ADMIN_LS) === '1'; } catch { return false; }
  });
  const allowAdmin = () => { try { localStorage.setItem(ADMIN_LS, '1'); } catch {} setIsAdmin(true); };
  const denyAdmin  = () => { try { localStorage.removeItem(ADMIN_LS); } catch {} setIsAdmin(false); };

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

  const individualLeaderboard = useMemo(() => {
    return [...students]
      .sort((a, b) => b.points - a.points)
      .map((s, i) => ({ rank: i + 1, ...s }));
  }, [students]);

  const groupLeaderboard = useMemo(() => {
    const stats = groups.map((g) => {
      const members = students.filter((s) => s.groupId === g.id);
      const size = members.length;
      const sum = members.reduce((acc, s) => acc + (Number(s.points) || 0), 0);
      const avgIndiv = size ? sum / size : 0;
      const bonus = Number(g.points) || 0;
      const total = avgIndiv + bonus;
      return { ...g, size, avgIndiv, bonus, total };
    });
    return stats
      .sort((a, b) => b.total - a.total)
      .map((g, i) => ({ rank: i + 1, ...g }));
  }, [groups, students]);

  const addStudent = useCallback((name, email) => {
    const id = genId();
    setStudents((prev) => [...prev, { id, name, email: email || undefined, groupId: null, points: 0 }]);
    return id;
  }, [setStudents]);

  const addGroup = useCallback((name) => {
    const id = genId();
    setGroups((prev) => [...prev, { id, name, points: 0 }]);
    return id;
  }, [setGroups]);

  const deleteStudent = useCallback((studentId) => {
    if (!studentId) return;
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm("Deze student verwijderen? Dit verwijdert ook individuele awards.") : true;
    if (!ok) return;
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setAwards((prev) => prev.filter((a) => !(a.type === "student" && a.targetId === studentId)));
  }, [setStudents, setAwards]);

  const assignStudentGroup = useCallback((studentId, groupId) => {
    if (!studentId) return;
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, groupId: groupId || null } : s)));
  }, [setStudents]);

  const awardToStudent = useCallback((studentId, amount, reason) => {
    if (!studentId || !Number.isFinite(amount)) return;
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, points: s.points + amount } : s)));
    const award = { id: genId(), ts: Date.now(), type: "student", targetId: studentId, amount, reason };
    setAwards((prev) => [award, ...prev].slice(0, 500));
  }, [setStudents, setAwards]);

  const awardToGroup = useCallback((groupId, amount, reason) => {
    if (!groupId || !Number.isFinite(amount)) return;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, points: g.points + amount } : g)));
    const award = { id: genId(), ts: Date.now(), type: "group", targetId: groupId, amount, reason };
    setAwards((prev) => [award, ...prev].slice(0, 500));
  }, [setGroups, setAwards]);

  const resetAll = useCallback(() => {
    if (!confirm("Reset alle data? Dit kan niet ongedaan worden.")) return;
    setStudents(seedStudents);
    setGroups(seedGroups);
    setAwards(seedAwards);
  }, [setStudents, setGroups, setAwards]);

  // Self-tests (lightweight runtime checks)
  useEffect(() => {
    try {
      const g0 = { points: 10 }; const g1 = { ...g0, points: g0.points - 15 }; console.assert(g1.points === -5, 'negatives allowed');
      const order = [30,20,10,5].map((p,i)=>({id:`s${i}`,points:p})); const t3=[...order].sort((a,b)=>b.points-a.points).slice(0,3); console.assert(t3.length===3 && t3[2].points===10,'top3 individuals');
      const gstats = [ {total:50},{total:10},{total:5},{total:1} ].sort((a,b)=>b.total-a.total).slice(0,3); console.assert(gstats.length===3 && gstats[0].total===50,'top3 groups');
      console.assert(emailValid('a@student.nhlstenden.com') && !emailValid('x@nope.com'),'email regex');
      const avg0 = (()=>{const members=[];const sum=members.reduce((a,s)=>a+(s.points||0),0);return members.length?sum/members.length:0;})(); console.assert(avg0===0,'empty group avg = 0');
    } catch(e) { console.warn('Self-tests failed:', e); }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8 text-slate-800">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Neuromarketing Points · Prototype</h1>
          <div className="flex gap-2 text-sm">
            <a href="#/student" className={`px-3 py-2 rounded-xl border ${route === '/student' ? 'bg-indigo-100' : 'bg-white'}`}>Studenten</a>
            <a href="#/admin"   className={`px-3 py-2 rounded-xl border ${route === '/admin'   ? 'bg-indigo-100' : 'bg-white'}`}>Beheer</a>
            {route === '/admin' && isAdmin && (
              <button className="px-3 py-2 rounded-xl border" onClick={denyAdmin}>Uitloggen</button>
            )}
          </div>
        </header>

        {route === '/admin' ? (
          isAdmin ? (
            <AdminView
              students={students}
              groups={groups}
              awards={awards}
              onAddStudent={addStudent}
              onAddGroup={addGroup}
              onAssignStudentGroup={assignStudentGroup}
              onAwardStudent={awardToStudent}
              onAwardGroup={awardToGroup}
              onDeleteStudent={deleteStudent}
              individualLeaderboard={individualLeaderboard}
              groupLeaderboard={groupLeaderboard}
              groupById={groupById}
              onReset={resetAll}
            />
          ) : (
            <AdminGate onAllow={allowAdmin} />
          )
        ) : (
          <StudentView
            students={students}
            groups={groups}
            awards={awards}
            individualLeaderboard={individualLeaderboard}
            groupLeaderboard={groupLeaderboard}
            groupById={groupById}
            onSelfSignup={addStudent}
          />
        )}
      </div>
    </div>
  );
}

function AdminGate({ onAllow }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const ACCEPT = "neuro2025";

  const submit = () => {
    if (code.trim() === ACCEPT) {
      setError("");
      onAllow();
    } else {
      setError("Onjuiste code.");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card title="Beheer – Toegang">
        <p className="text-sm text-neutral-600 mb-3">Alleen docenten. Vul de toegangscode in om door te gaan.</p>
        <TextInput value={code} onChange={setCode} placeholder="Toegangscode" />
        {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
        <div className="mt-3 flex gap-2">
          <Button className="bg-indigo-600 text-white" onClick={submit}>Inloggen</Button>
          <a href="#/student" className="px-4 py-2 rounded-2xl border">Terug naar studenten</a>
        </div>
      </Card>
    </div>
  );
}

function AdminView({
  students,
  groups,
  awards,
  onAddStudent,
  onAddGroup,
  onAssignStudentGroup,
  onAwardStudent,
  onAwardGroup,
  onDeleteStudent,
  individualLeaderboard,
  groupLeaderboard,
  groupById,
  onReset,
}) {
  const [newStudent, setNewStudent] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignGroupId, setAssignGroupId] = useState("");

  const [awardType, setAwardType] = useState("student");
  const [awardTargetId, setAwardTargetId] = useState("");
  const [awardAmount, setAwardAmount] = useState(5);
  const [awardReason, setAwardReason] = useState("");

  useEffect(() => {
    if (awardType === "student") {
      if (students.length && !students.find((s) => s.id === awardTargetId)) {
        setAwardTargetId(students[0]?.id || "");
      }
    } else {
      if (groups.length && !groups.find((g) => g.id === awardTargetId)) {
        setAwardTargetId(groups[0]?.id || "");
      }
    }
  }, [awardType, students, groups, awardTargetId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Student toevoegen">
        <div className="grid grid-cols-1 gap-2">
          <TextInput value={newStudent} onChange={setNewStudent} placeholder="Naam" />
          <TextInput value={newStudentEmail} onChange={setNewStudentEmail} placeholder="E-mail (@student.nhlstenden.com)" />
          {newStudentEmail && !emailValid(newStudentEmail) && (
            <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
          )}
          <div className="flex gap-2 items-center">
            <Button
              className="bg-indigo-600 text-white"
              disabled={!newStudent.trim() || (newStudentEmail.trim() !== '' && !emailValid(newStudentEmail))}
              onClick={() => {
                const name = newStudent.trim();
                const email = newStudentEmail.trim();
                if (!name) return;
                if (email && !emailValid(email)) {
                  alert("Alleen @student.nhlstenden.com toegestaan");
                  return;
                }
                const newId = onAddStudent(name, email || undefined);
                setAssignStudentId(newId);
                setNewStudent("");
                setNewStudentEmail("");
              }}
            >
              Voeg toe
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Groep toevoegen">
        <div className="flex gap-2 items-center">
          <TextInput value={newGroup} onChange={setNewGroup} placeholder="Groepsnaam" />
          <Button
            className="bg-indigo-600 text-white"
            onClick={() => {
              const name = newGroup.trim();
              if (!name) return;
              onAddGroup(name);
              setNewGroup("");
            }}
          >
            Voeg toe
          </Button>
        </div>
      </Card>

      <Card title="Student ↔ Groep toewijzen / beheren">
        <div className="grid grid-cols-1 gap-2">
          <Select value={assignStudentId} onChange={setAssignStudentId}>
            <option value="">Kies student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.email ? `· ${s.email}` : ""} {s.groupId ? `(${groupById.get(s.groupId)?.name || "-"})` : "(geen groep)"}
              </option>
            ))}
          </Select>
          <Select value={assignGroupId} onChange={setAssignGroupId}>
            <option value="">(geen groep)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button
              className="bg-indigo-600 text-white"
              onClick={() => onAssignStudentGroup(assignStudentId, assignGroupId || null)}
            >
              Opslaan
            </Button>
            <Button
              className="bg-rose-600 text-white"
              onClick={() => assignStudentId && onDeleteStudent(assignStudentId)}
            >
              Verwijder student
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Punten toekennen" className="lg:col-span-2">
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
            {awardType === "student" ? (
              <Select value={awardTargetId} onChange={setAwardTargetId}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Select value={awardTargetId} onChange={setAwardTargetId}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="md:col-span-1">
            <label className="text-sm">Aantal (+/-)</label>
            <input
              type="number"
              value={awardAmount}
              onChange={(e) => setAwardAmount(parseInt(e.target.value || "0", 10))}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>

          <div className="md:col-span-1">
            <Button
              className="bg-emerald-600 text-white w-full"
              onClick={() => {
                if (awardType === "student") {
                  onAwardStudent(awardTargetId, awardAmount, awardReason.trim());
                } else {
                  onAwardGroup(awardTargetId, awardAmount, awardReason.trim());
                }
                setAwardReason("");
              }}
            >
              Toekennen
            </Button>
          </div>

          <div className="md:col-span-5">
            <TextInput value={awardReason} onChange={setAwardReason} placeholder="Reden (optioneel)" />
          </div>
        </div>
      </Card>

      <Card title="Recent toegekend" className="lg:col-span-1 max-h-[340px] overflow-auto">
        <ul className="space-y-2 text-sm">
          {awards.slice(0, 15).map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span>
                {new Date(a.ts).toLocaleString()} · {a.type === "student" ? "👤" : "👥"} {a.type === "student" ? (students.find((s) => s.id === a.targetId)?.name || '-') : (groupById.get(a.targetId)?.name || '-')}
                {a.reason ? ` — ${a.reason}` : ""}
              </span>
              <span className={`font-semibold ${a.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{a.amount >= 0 ? "+" : ""}{a.amount}</span>
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
              const me = assignStudentId ? individualLeaderboard.find((r) => r.id === assignStudentId) : null;
              const isTop3 = me && me.rank <= 3;
              return (
                <>
                  {top3.map((row) => (
                    <tr key={row.id} className={`border-b last:border-0 ${row.id === assignStudentId ? "bg-indigo-50" : ""}`}>
                      <td className="py-1 pr-2">{row.rank}</td>
                      <td className={`py-1 pr-2 ${row.id === assignStudentId ? 'font-bold' : ''}`}>{row.name}</td>
                      <td className={`py-1 pr-2 text-right ${row.id === assignStudentId ? 'font-bold' : 'font-semibold'} ${(row.points > 0) ? 'text-emerald-700' : (row.points < 0 ? 'text-rose-700' : 'text-neutral-700')}`}>{row.points}</td>
                    </tr>
                  ))}
                  {!isTop3 && me && (
                    <>
                      <tr><td colSpan={3} className="py-1 text-center text-neutral-400">…</td></tr>
                      <tr key={me.id} className="border-b last:border-0 bg-indigo-50">
                        <td className="py-1 pr-2">{me.rank}</td>
                        <td className="py-1 pr-2 font-bold">{me.name}</td>
                        <td className={`py-1 pr-2 text-right font-bold ${(me.points > 0) ? 'text-emerald-700' : (me.points < 0 ? 'text-rose-700' : 'text-neutral-700')}`}>{me.points}</td>
                      </tr>
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </Card>

      <Card title="Leaderboard – Groepen" className="lg:col-span-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Groep</th>
              <th className="py-1 pr-2 text-right">Leden</th>
              <th className="py-1 pr-2 text-right">Gem. individueel</th>
              <th className="py-1 pr-2 text-right">Bonus</th>
              <th className="py-1 pr-2 text-right">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const top3 = groupLeaderboard.slice(0, 3);
              const focusGroupId = assignStudentId ? (students.find(s => s.id === assignStudentId)?.groupId || null) : null;
              const focusRow = focusGroupId ? groupLeaderboard.find(g => g.id === focusGroupId) : null;
              const isTop3 = focusRow && focusRow.rank <= 3;
              return (
                <>
                  {top3.map((row) => (
                    <tr key={row.id} className={`border-b last:border-0 ${row.id === focusGroupId ? "bg-indigo-50" : ""}`}>
                      <td className="py-1 pr-2">{row.rank}</td>
                      <td className={`py-1 pr-2 ${row.id === focusGroupId ? 'font-bold' : ''}`}>{row.name}</td>
                      <td className="py-1 pr-2 text-right">{row.size}</td>
                      <td className={`py-1 pr-2 text-right ${(row.avgIndiv > 0) ? 'text-emerald-700' : (row.avgIndiv < 0 ? 'text-rose-700' : 'text-neutral-700')}`}>{row.avgIndiv.toFixed(1)}</td>
                      <td className={`py-1 pr-2 text-right ${row.bonus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{row.bonus}</td>
                      <td className={`py-1 pr-2 text-right font-semibold ${row.total > 0 ? 'text-emerald-800' : 'text-neutral-800'}`}>{row.total.toFixed(1)}</td>
                    </tr>
                  ))}
                  {!isTop3 && focusRow && (
                    <>
                      <tr><td colSpan={6} className="py-1 text-center text-neutral-400">…</td></tr>
                      <tr className="border-b last:border-0 bg-indigo-50">
                        <td className="py-1 pr-2">{focusRow.rank}</td>
                        <td className="py-1 pr-2 font-bold">{focusRow.name}</td>
                        <td className="py-1 pr-2 text-right">{focusRow.size}</td>
                        <td className={`py-1 pr-2 text-right ${(focusRow.avgIndiv > 0) ? 'text-emerald-700' : (focusRow.avgIndiv < 0 ? 'text-rose-700' : 'text-neutral-700')}`}>{focusRow.avgIndiv.toFixed(1)}</td>
                        <td className={`py-1 pr-2 text-right ${focusRow.bonus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{focusRow.bonus}</td>
                        <td className={`py-1 pr-2 text-right font-semibold ${focusRow.total > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{focusRow.total.toFixed(1)}</td>
                      </tr>
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </Card>

      <Card title="Opmerking" className="lg:col-span-3">
        <p className="text-sm text-neutral-600">
          Groepstotaal = Gemiddelde individuele punten + Groepsbonus (mag negatief zijn). Volgende iteraties: badges, upload van stickerafbeeldingen, quiz-gate, export/import.
        </p>
      </Card>
    </div>
  );
}

function StudentView({ students, groups, awards, individualLeaderboard, groupLeaderboard, groupById, onSelfSignup }) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");

  const me = students.find((s) => s.id === selectedStudentId) || null;
  const myGroup = me?.groupId ? groupById.get(me.groupId) : null;

  const myAwards = useMemo(() => {
    return awards.filter((a) => (a.type === "student" && a.targetId === selectedStudentId) || (a.type === "group" && myGroup && a.targetId === myGroup.id));
  }, [awards, selectedStudentId, myGroup]);

  const myGroupRow = myGroup ? groupLeaderboard.find((g) => g.id === myGroup.id) : null;

  const handleSelfSignup = () => {
    const email = (signupEmail || '').trim();
    const name = (signupName || '').trim();
    if (!email || !name) {
      alert("Vul zowel e-mail als naam in.");
      return;
    }
    if (!emailValid(email)) {
      alert("Alleen e-mails @student.nhlstenden.com zijn toegestaan.");
      return;
    }
    const existing = students.find((s) => (s.email || "").toLowerCase() === email.toLowerCase());
    if (existing) {
      setSelectedStudentId(existing.id);
      setSignupEmail("");
      setSignupName("");
      return;
    }
    const newId = onSelfSignup(name, email);
    if (newId) setSelectedStudentId(newId);
    setSignupEmail("");
    setSignupName("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Log in als student">
        <Select value={selectedStudentId} onChange={setSelectedStudentId}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {me && (
          <div className="mt-4 space-y-1 text-sm">
            <div>
              <span className="font-semibold">Jouw punten:</span> {me.points}
            </div>
            <div>
              <span className="font-semibold">Jouw groep:</span> {myGroup ? myGroup.name : "-"}
            </div>
            {myGroup && (
              <div>
                <span className="font-semibold">Groepspunten (totaal):</span> {myGroupRow ? myGroupRow.total.toFixed(1) : myGroup.points}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Nog geen account? Zelf aanmaken">
        <div className="grid grid-cols-1 gap-2">
          <TextInput value={signupEmail} onChange={setSignupEmail} placeholder="E-mail (@student.nhlstenden.com)" />
          {signupEmail && !emailValid(signupEmail) && (
            <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
          )}
          <TextInput value={signupName} onChange={setSignupName} placeholder="Volledige naam" />
          <Button className="bg-indigo-600 text-white" disabled={!signupEmail.trim() || !signupName.trim() || !emailValid(signupEmail)} onClick={handleSelfSignup}>Maak account</Button>
        </div>
      </Card>

      <Card title="Jouw recente activiteiten" className="lg:col-span-2 max-h-[320px] overflow-auto">
        <ul className="space-y-2 text-sm">
          {myAwards.length === 0 && <li>Geen recente items.</li>}
          {myAwards.map((a) => (
            <li key={a.id} className="flex justify-between gap-2">
              <span>
                {new Date(a.ts).toLocaleString()} · {a.type === "student" ? "Individueel" : `Groep (${myGroup?.name || "-"})`} {a.reason ? `— ${a.reason}` : ""}
              </span>
              <span className={`font-semibold ${a.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{a.amount >= 0 ? "+" : ""}{a.amount}</span>
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
                    <tr key={row.id} className={`border-b last:border-0 ${row.id === selectedStudentId ? "bg-indigo-50" : ""}`}>
                      <td className="py-1 pr-2">{row.rank}</td>
                      <td className={`py-1 pr-2 ${row.id === selectedStudentId ? 'font-bold' : ''}`}>{row.name}</td>
                      <td className={`py-1 pr-2 text-right ${row.id === selectedStudentId ? 'font-bold' : 'font-semibold'} ${row.points > 0 ? 'text-emerald-700' : row.points < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{row.points}</td>
                    </tr>
                  ))}
                  {!isTop3 && meRow && (
                    <>
                      <tr><td colSpan={3} className="py-1 text-center text-neutral-400">…</td></tr>
                      <tr key={meRow.id} className="border-b last:border-0 bg-indigo-50">
                        <td className="py-1 pr-2">{meRow.rank}</td>
                        <td className="py-1 pr-2 font-bold">{meRow.name}</td>
                        <td className={`py-1 pr-2 text-right font-bold ${meRow.points > 0 ? 'text-emerald-700' : meRow.points < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{meRow.points}</td>
                      </tr>
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </Card>

      <Card title="Leaderboard – Groepen" className="lg:col-span-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Groep</th>
              <th className="py-1 pr-2 text-right">Leden</th>
              <th className="py-1 pr-2 text-right">Gem. individueel</th>
              <th className="py-1 pr-2 text-right">Bonus</th>
              <th className="py-1 pr-2 text-right">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const top3 = groupLeaderboard.slice(0, 3);
              const myRow = myGroup ? groupLeaderboard.find((g) => g.id === myGroup.id) : null;
              const isTop3 = myRow && myRow.rank <= 3;
              return (
                <>
                  {top3.map((row) => (
                    <tr key={row.id} className={`border-b last:border-0 ${row.id === myGroup?.id ? "bg-indigo-50" : ""}`}>
                      <td className="py-1 pr-2">{row.rank}</td>
                      <td className={`py-1 pr-2 ${row.id === myGroup?.id ? 'font-bold' : ''}`}>{row.name}</td>
                      <td className="py-1 pr-2 text-right">{row.size}</td>
                      <td className={`py-1 pr-2 text-right ${row.avgIndiv > 0 ? 'text-emerald-700' : row.avgIndiv < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{row.avgIndiv.toFixed(1)}</td>
                      <td className={`py-1 pr-2 text-right ${row.bonus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{row.bonus}</td>
                      <td className={`py-1 pr-2 text-right font-semibold ${row.total > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{row.total.toFixed(1)}</td>
                    </tr>
                  ))}
                  {!isTop3 && myRow && (
                    <>
                      <tr><td colSpan={6} className="py-1 text-center text-neutral-400">…</td></tr>
                      <tr className="border-b last:border-0 bg-indigo-50">
                        <td className="py-1 pr-2">{myRow.rank}</td>
                        <td className="py-1 pr-2 font-bold">{myRow.name}</td>
                        <td className="py-1 pr-2 text-right">{myRow.size}</td>
                        <td className={`py-1 pr-2 text-right ${myRow.avgIndiv > 0 ? 'text-emerald-700' : myRow.avgIndiv < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{myRow.avgIndiv.toFixed(1)}</td>
                        <td className={`py-1 pr-2 text-right ${myRow.bonus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{myRow.bonus}</td>
                        <td className={`py-1 pr-2 text-right font-semibold ${myRow.total > 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{myRow.total.toFixed(1)}</td>
                      </tr>
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </Card>

      <Card title="Opmerking" className="lg:col-span-3">
        <p className="text-sm text-neutral-600">
          Groepstotaal = Gemiddelde individuele punten + Groepsbonus (mag negatief zijn). Volgende iteraties: badges, upload van stickerafbeeldingen, quiz-gate, export/import.
        </p>
      </Card>
    </div>
  );
}
