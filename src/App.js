import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Student from './Student';
import AdminRoster from './AdminRoster';
import { Card, Button, TextInput } from './components/ui';
import usePersistentState from './hooks/usePersistentState';
import useStudents from './hooks/useStudents';
import useTeachers from './hooks/useTeachers';
import { teacherEmailValid } from './utils';
import bcrypt from 'bcryptjs';

export default function App() {
  const getRoute = () => (typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : '/');
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

  const [selectedStudentId, setSelectedStudentId] = usePersistentState('nm_points_current_student', '');

  const [menuOpen, setMenuOpen] = useState(false);

  const logoutAdmin = () => {
    denyAdmin();
    setMenuOpen(false);
    window.location.hash = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8 text-slate-800">
      <div className="max-w-6xl mx-auto">
        <header className="app-header">
          <h1 className="app-title">Neuromarketing Housepoints</h1>
          {route !== '/' && (
            <div className="menu-wrapper">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="menu-button"
                aria-label="Menu"
              >☰</button>
              {menuOpen && (
                <div className="dropdown">
                  <a href="#/student" className="dropdown-link" onClick={() => setMenuOpen(false)}>Student</a>
                  <a href="#/admin" className="dropdown-link" onClick={() => setMenuOpen(false)}>Beheer</a>
                  {isAdmin && (
                    <a href="#/admin/preview" className="dropdown-link" onClick={() => setMenuOpen(false)}>
                      Preview student
                    </a>
                  )}
                  {isAdmin && (
                    <button onClick={logoutAdmin} className="dropdown-button">Uitloggen beheer</button>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {route === '/admin' ? (
          isAdmin ? <Admin /> : <AdminGate onAllow={allowAdmin} />
        ) : route === '/student' ? (
          <Student selectedStudentId={selectedStudentId} setSelectedStudentId={setSelectedStudentId} />
        ) : route === '/roster' ? (
          isAdmin ? <AdminRoster /> : <AdminGate onAllow={allowAdmin} />
        ) : route === '/admin/preview' ? (
          isAdmin ? (
            <AdminPreview
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          ) : (
            <AdminGate onAllow={allowAdmin} />
          )
        ) : (
          <RoleSelect />
        )}
      </div>
    </div>
  );
}

function AdminGate({ onAllow }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [teachers] = useTeachers();

  const submit = () => {
    const norm = email.trim().toLowerCase();
    if (!teacherEmailValid(norm)) {
      setError('Alleen adressen eindigend op @nhlstenden.com zijn toegestaan.');
      return;
    }
    const t = teachers.find((te) => te.email.toLowerCase() === norm);
    if (t && bcrypt.compareSync(password, t.passwordHash)) {
      setError('');
      onAllow();
    } else {
      setError('Onjuiste e-mail of wachtwoord.');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card title="Beheer – Toegang">
        <p className="text-sm text-neutral-600 mb-3">Alleen docenten. Log in met je @nhlstenden.com e-mailadres.</p>
        <TextInput
          value={email}
          onChange={setEmail}
          placeholder="E-mail"
          className="mb-2"
        />
        <TextInput
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Wachtwoord"
          className="mb-4"
        />
        {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
        <div className="mt-3 flex gap-2">
          <Button
            className="bg-indigo-600 text-white"
            onClick={submit}
            disabled={!email.trim() || !password.trim()}
          >
            Inloggen
          </Button>
          <a href="#/student" className="px-4 py-2 rounded-2xl border">Terug naar studenten</a>
        </div>
      </Card>
    </div>
  );
}

/* AdminPreview: dropdown met studenten uit useStudents */
function AdminPreview({ selectedStudentId, setSelectedStudentId }) {
  const studentsHook = useStudents();
  // Ondersteun zowel return van [students, setStudents] als direct students
  const studentsRaw =
    Array.isArray(studentsHook?.[0]) && typeof studentsHook?.[1] === 'function'
      ? studentsHook[0]
      : studentsHook;

  const students = Array.isArray(studentsRaw)
    ? studentsRaw
    : studentsRaw && typeof studentsRaw === 'object'
    ? Object.values(studentsRaw)
    : [];

  const toId = (s, i) => String(s?.id ?? s?.code ?? s?.studentId ?? (typeof s === 'string' ? s : i));
  const toName = (s, id) => {
    if (typeof s === 'string') return s;
    const name =
      s?.name ??
      s?.fullName ??
      [s?.firstName, s?.lastName].filter(Boolean).join(' ').trim();
    return String(name || id);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Card title="Preview student">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm text-neutral-600 mb-1">Selecteer student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">— Geen selectie —</option>
              {students.map((s, i) => {
                const id = toId(s, i);
                const name = toName(s, id);
                return (
                  <option key={id} value={id}>
                    {name} ({id})
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-neutral-500 mt-2">
              Tip: Laat leeg om te zien wat een student zonder selectie ziet.
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="border" onClick={() => setSelectedStudentId('')}>Leegmaken</Button>
            <a href="#/admin" className="px-4 py-2 rounded-2xl border">Terug naar beheer</a>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <Student
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
        />
      </div>
    </div>
  );
}

function RoleSelect() {
  return (
    <div className="max-w-md mx-auto">
      <Card title="Wie ben je?">
        <div className="flex flex-col gap-4">
          <a href="#/student" className="block w-full">
            <Button className="w-full bg-indigo-600 text-white">Ik ben student</Button>
          </a>
          <a href="#/admin" className="block w-full">
            <Button className="w-full bg-indigo-600 text-white">Ik ben docent</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}