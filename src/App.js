import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Student from './Student';
import AdminRoster from './AdminRoster';
import { Card, Button, TextInput } from './components/ui';
import usePersistentState from './hooks/usePersistentState';
import useStudents from './hooks/useStudents';
import useTeachers from './hooks/useTeachers';
import { teacherEmailValid, genId, emailValid, nameFromEmail, requestPasswordReset } from './utils';

const SUPERUSER_EMAIL = 'admin@nhlstenden.com';
const SUPERUSER_PASSWORD = 'Neuro2025!';

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

  // Add proper menu management
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && !event.target.closest('.menu-wrapper')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Add route change handler to close menu
  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8 text-slate-800 overflow-hidden">
      {route === '/' && (
        <picture className="pointer-events-none absolute inset-0 m-auto h-full w-auto max-h-screen">
          <source srcSet="/images/voorpagina.webp" type="image/webp" />
          <source srcSet="/images/voorpagina.png" type="image/png" />
          <img
            src="/images/voorpagina.jpg"
            alt="Voorpagina"
            className="h-full w-auto object-contain"
          />
        </picture>
      )}
      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="app-header">
          <h1 className="app-title">Neuromarketing Housepoints</h1>
          <div className="menu-wrapper">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="menu-button"
              aria-label="Menu"
            >☰</button>
            {menuOpen && (
              <div className="dropdown">
                <a href="#/student" className="dropdown-link" onClick={() => setMenuOpen(false)}>Student</a>
                {!isAdmin && (
                  <a href="#/docent" className="dropdown-link" onClick={() => setMenuOpen(false)}>Docent</a>
                )}
                {isAdmin && (
                  <>
                    <a href="#/admin" className="dropdown-link" onClick={() => setMenuOpen(false)}>Beheer</a>
                    <a href="#/admin/preview" className="dropdown-link" onClick={() => setMenuOpen(false)}>
                      Preview student
                    </a>
                    <button onClick={logoutAdmin} className="dropdown-button">Uitloggen beheer</button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {route === '/docent' ? (
          <AdminGate
            title="Docenten – Inloggen"
            onAllow={() => {
              allowAdmin();
              window.location.hash = '/admin';
            }}
          />
        ) : route === '/admin' ? (
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
          <StudentGate setSelectedStudentId={setSelectedStudentId} />
        )}
      </div>
    </div>
  );
}



function AdminGate({ onAllow, title = 'Beheer – Toegang' }) {
  const [authMode, setAuthMode] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupError, setSignupError] = useState('');
  const [teachers, setTeachers] = useTeachers();

  const handleLogin = () => {
    setResetMessage('');
    const norm = loginEmail.trim().toLowerCase();
    if (norm === SUPERUSER_EMAIL && loginPassword === SUPERUSER_PASSWORD) {
      setLoginError('');
      onAllow();
      return;
    }
    if (!teacherEmailValid(norm)) {
      setLoginError('Alleen adressen eindigend op @nhlstenden.com zijn toegestaan.');
      return;
    }
    const t = teachers.find((te) => te.email.toLowerCase() === norm);
    if (t && loginPassword === t.password) {
      setLoginError('');
      onAllow();
    } else {
      setLoginError('Onjuiste e-mail of wachtwoord.');
    }
  };

  const handleSignup = () => {
    const norm = signupEmail.trim().toLowerCase();
    if (!teacherEmailValid(norm)) return;
    if (norm === SUPERUSER_EMAIL) {
      setSignupError('Dit e-mailadres is gereserveerd.');
      return;
    }
    if (!signupPassword.trim() || signupPassword !== signupPassword2) {
      setSignupError('Wachtwoorden komen niet overeen.');
      return;
    }
    if (teachers.some((t) => t.email.toLowerCase() === norm)) {
      setSignupError('E-mailadres bestaat al.');
      return;
    }
    setTeachers((prev) => [
      ...prev,
      { id: genId(), email: norm, password: signupPassword.trim() }
    ]);
    setSignupEmail('');
    setSignupPassword('');
    setSignupPassword2('');
    setSignupError('');
    onAllow();
  };

  const handlePasswordReset = async () => {
    const norm = loginEmail.trim().toLowerCase();
    if (!teacherEmailValid(norm)) {
      setLoginError('Vul een geldig e-mailadres in.');
      return;
    }
    const t = teachers.find((te) => te.email.toLowerCase() === norm);
    if (t || norm === SUPERUSER_EMAIL) {
      await requestPasswordReset(norm);
      setResetMessage('Als het e-mailadres bestaat, is een resetmail verstuurd.');
    } else {
      setResetMessage('E-mailadres niet gevonden.');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card title={title}>
        {authMode === 'login' ? (
          <>
            <p className="text-sm text-neutral-600 mb-3">Alleen docenten. Log in met je @nhlstenden.com e-mailadres.</p>
            <TextInput
              value={loginEmail}
              onChange={setLoginEmail}
              placeholder="E-mail (@nhlstenden.com)"
              className="mb-2"
            />
            <TextInput
              type="password"
              value={loginPassword}
              onChange={setLoginPassword}
              placeholder="Wachtwoord"
              className="mb-4"
            />
            {loginError && <div className="text-sm text-rose-600 mt-2">{loginError}</div>}
            {resetMessage && <div className="text-sm text-green-600 mt-2">{resetMessage}</div>}
            <div className="mt-3 flex gap-2">
              <Button
                className="bg-indigo-600 text-white"
                onClick={handleLogin}
                disabled={!loginEmail.trim() || !loginPassword.trim()}
              >
                Inloggen
              </Button>
              <a href="#/student" className="px-4 py-2 rounded-2xl border">Terug naar studenten</a>
            </div>
            <button
              className="text-sm text-indigo-600 text-left mt-2"
              onClick={handlePasswordReset}
            >
              Wachtwoord vergeten?
            </button>
            <button
              className="text-sm text-indigo-600 text-left mt-2"
              onClick={() => {
                setLoginEmail('');
                setLoginPassword('');
                setLoginError('');
                setResetMessage('');
                setAuthMode('signup');
              }}
            >
              Account aanmaken
            </button>
          </>
        ) : (
          <>
            <TextInput
              value={signupEmail}
              onChange={setSignupEmail}
              placeholder="E-mail (@nhlstenden.com)"
            />
            {signupEmail && !teacherEmailValid(signupEmail) && (
              <div className="text-sm text-rose-600">
                Alleen adressen eindigend op @nhlstenden.com zijn toegestaan.
              </div>
            )}
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
              className="mb-4"
            />
            {signupError && <div className="text-sm text-rose-600 mt-2">{signupError}</div>}
            <div className="mt-3 flex gap-2">
              <Button
                className="bg-indigo-600 text-white"
                onClick={handleSignup}
                disabled={
                  !signupEmail.trim() ||
                  !signupPassword.trim() ||
                  signupPassword !== signupPassword2 ||
                  !teacherEmailValid(signupEmail)
                }
              >
                Account aanmaken
              </Button>
              <a href="#/student" className="px-4 py-2 rounded-2xl border">Terug naar studenten</a>
            </div>
            <button
              className="text-sm text-indigo-600 text-left mt-2"
              onClick={() => {
                setSignupEmail('');
                setSignupPassword('');
                setSignupPassword2('');
                setSignupError('');
                setResetMessage('');
                setAuthMode('login');
              }}
            >
              Terug naar inloggen
            </button>
          </>
        )}
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
                const email = typeof s === 'string' ? '' : s?.email;
                return (
                  <option key={id} value={id}>
                    {name} ({email || id})
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

function StudentGate({ setSelectedStudentId }) {
  const [students, setStudents] = useStudents();
  const [authMode, setAuthMode] = useState('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleLogin = () => {
    setResetMessage('');
    if (!emailValid(loginEmail)) return;
    const normEmail = loginEmail.trim().toLowerCase();
    const existing = students.find((s) => (s.email || '').toLowerCase() === normEmail);
    if (existing && (existing.password || '') === loginPassword.trim()) {
      setSelectedStudentId(existing.id);
      setLoginEmail('');
      setLoginPassword('');
      setLoginError('');
      window.location.hash = '/student';
    } else {
      setLoginError('Onjuist e-mailadres of wachtwoord.');
    }
  };

  const handlePasswordReset = async () => {
    const normEmail = loginEmail.trim().toLowerCase();
    if (!emailValid(normEmail)) {
      setLoginError('Vul een geldig e-mailadres in.');
      return;
    }
    const existing = students.find((s) => (s.email || '').toLowerCase() === normEmail);
    if (existing) {
      await requestPasswordReset(normEmail);
      setResetMessage('Als het e-mailadres bestaat, is een resetmail verstuurd.');
    } else {
      setResetMessage('E-mailadres niet gevonden.');
    }
  };

  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupError, setSignupError] = useState('');

  const addStudent = (name, email, password = '') => {
    const id = genId();
    setStudents((prev) => [
      ...prev,
      { id, name, email: email || undefined, password, groupId: null, points: 0, badges: [] }
    ]);
    return id;
  };

  const handleSignup = () => {
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
    if (students.some((s) => (s.email || '').toLowerCase() === normEmail)) {
      setSignupError('E-mailadres bestaat al.');
      return;
    }

    const newId = addStudent(signupName.trim(), normEmail, signupPassword.trim());
    setSelectedStudentId(newId);
    setSignupEmail('');
    setSignupName('');
    setSignupPassword('');
    setSignupPassword2('');
    setSignupError('');
    window.location.hash = '/student';
  };

  return (
    <div className="max-w-md mx-auto">
      {authMode === 'login' ? (
        <Card title="Log in">
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              value={loginEmail}
              onChange={setLoginEmail}
              placeholder="E-mail (@student.nhlstenden.com)"
            />
            <TextInput
              type="password"
              value={loginPassword}
              onChange={setLoginPassword}
              placeholder="Wachtwoord"
            />
            {loginEmail && !emailValid(loginEmail) && (
              <div className="text-sm text-rose-600">
                Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.
              </div>
            )}
            {loginError && <div className="text-sm text-rose-600">{loginError}</div>}
            {resetMessage && <div className="text-sm text-green-600">{resetMessage}</div>}
            <Button
              className="bg-indigo-600 text-white"
              disabled={!loginEmail.trim() || !emailValid(loginEmail) || !loginPassword.trim()}
              onClick={handleLogin}
            >
              Log in
            </Button>
            <button
              className="text-sm text-indigo-600 text-left"
              onClick={handlePasswordReset}
            >
              Wachtwoord vergeten?
            </button>
            <button
              className="text-sm text-indigo-600 text-left"
              onClick={() => {
                setSignupEmail('');
                setSignupName('');
                setSignupPassword('');
                setSignupPassword2('');
                setSignupError('');
                setResetMessage('');
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
              <div className="text-sm text-rose-600">
                Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.
              </div>
            )}
            <TextInput
              value={signupName}
              onChange={setSignupName}
              placeholder="Volledige naam"
            />
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
                setResetMessage('');
                setAuthMode('login');
              }}
            >
              Terug naar inloggen
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
