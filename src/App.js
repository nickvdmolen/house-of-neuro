import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Student from './Student';
import AdminRoster from './AdminRoster';
import { Card, Button, TextInput } from './components/ui';
import usePersistentState from './hooks/usePersistentState';
import useStudents from './hooks/useStudents';
import useTeachers from './hooks/useTeachers';
import { nameFromEmail, genId } from './utils';
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

  const logoutAdmin = () => {
    denyAdmin();
    window.location.hash = '/';
  };

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
        </header>

        {route === '/admin' ? (
          isAdmin ? (
            <Admin onLogout={logoutAdmin} />
          ) : (
            <Auth
              onAdminLogin={() => {
                allowAdmin();
                window.location.hash = '/admin';
              }}
              onStudentLogin={(id) => {
                setSelectedStudentId(id);
                window.location.hash = '/student';
              }}
            />
          )
        ) : route === '/student' ? (
          selectedStudentId ? (
            <Student
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
            />
          ) : (
            <Auth
              onAdminLogin={() => {
                allowAdmin();
                window.location.hash = '/admin';
              }}
              onStudentLogin={(id) => {
                setSelectedStudentId(id);
                window.location.hash = '/student';
              }}
            />
          )
        ) : route === '/roster' ? (
          isAdmin ? (
            <AdminRoster />
          ) : (
            <Auth
              onAdminLogin={() => {
                allowAdmin();
                window.location.hash = '/admin';
              }}
              onStudentLogin={(id) => {
                setSelectedStudentId(id);
                window.location.hash = '/student';
              }}
            />
          )
        ) : route === '/admin/preview' ? (
          isAdmin ? (
            <AdminPreview />
          ) : (
            <Auth
              onAdminLogin={() => {
                allowAdmin();
                window.location.hash = '/admin';
              }}
              onStudentLogin={(id) => {
                setSelectedStudentId(id);
                window.location.hash = '/student';
              }}
            />
          )
        ) : (
          <Auth
            onAdminLogin={() => {
              allowAdmin();
              window.location.hash = '/admin';
            }}
            onStudentLogin={(id) => {
              setSelectedStudentId(id);
              window.location.hash = '/student';
            }}
          />
        )}
      </div>
    </div>
  );
}

/* AdminPreview: dropdown met studenten uit useStudents */
function AdminPreview() {
  const [previewId, setPreviewId] = usePersistentState('nm_preview_student', '');
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
              value={previewId}
              onChange={(e) => setPreviewId(e.target.value)}
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
            <Button className="border" onClick={() => setPreviewId('')}>Leegmaken</Button>
            <a href="#/admin" className="px-4 py-2 rounded-2xl border">Terug naar beheer</a>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <Student previewStudentId={previewId} />
      </div>
    </div>
  );
}

function Auth({ onStudentLogin, onAdminLogin }) {
  const [mode, setMode] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetStudent, setResetStudent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupError, setSignupError] = useState('');
  const [students, setStudents] = useStudents();
  const [teachers, setTeachers] = useTeachers();

  const handleLogin = () => {
    const norm = loginEmail.trim().toLowerCase();
    const pass = loginPassword.trim();
    if (norm.endsWith('@student.nhlstenden.com')) {
      const s = students.find((st) => (st.email || '').toLowerCase() === norm);
      if (s) {
        if (s.tempCode && pass === s.tempCode) {
          setResetStudent(s);
          setLoginEmail('');
          setLoginPassword('');
          setLoginError('');
        } else if ((s.password || '') === pass) {
          setLoginError('');
          onStudentLogin(s.id);
        } else {
          setLoginError('Onjuiste e-mail of wachtwoord.');
        }
      } else {
        setLoginError('Onjuiste e-mail of wachtwoord.');
      }
    } else if (norm.endsWith('@nhlstenden.com')) {
      const t = teachers.find((te) => te.email.toLowerCase() === norm);
      if (!t) {
        setLoginError('Onjuiste e-mail of wachtwoord.');
      } else if (t.approved === false) {
        setLoginError('Account nog niet goedgekeurd.');
      } else if (bcrypt.compareSync(pass, t.passwordHash)) {
        setLoginError('');
        onAdminLogin();
      } else {
        setLoginError('Onjuiste e-mail of wachtwoord.');
      }
    } else {
      setLoginError('Gebruik een geldig e-mailadres.');
    }
  };

  const handleSignup = () => {
    const norm = signupEmail.trim().toLowerCase();
    if (!signupPassword.trim() || signupPassword !== signupPassword2) {
      setSignupError('Wachtwoorden komen niet overeen.');
      return;
    }
    if (norm.endsWith('@student.nhlstenden.com')) {
      if (students.some((s) => (s.email || '').toLowerCase() === norm)) {
        setSignupError('E-mailadres bestaat al.');
        return;
      }
      const id = genId();
      setStudents((prev) => [
        ...prev,
        { id, name: nameFromEmail(norm), email: norm, password: signupPassword.trim(), groupId: null, points: 0, badges: [] },
      ]);
      setSignupEmail('');
      setSignupPassword('');
      setSignupPassword2('');
      setSignupError('');
      onStudentLogin(id);
    } else if (norm.endsWith('@nhlstenden.com')) {
      if (teachers.some((t) => t.email.toLowerCase() === norm)) {
        setSignupError('E-mailadres bestaat al.');
        return;
      }
      const hash = bcrypt.hashSync(signupPassword.trim(), 10);
      setTeachers((prev) => [
        ...prev,
        { id: genId(), email: norm, passwordHash: hash, approved: false },
      ]);
      setSignupEmail('');
      setSignupPassword('');
      setSignupPassword2('');
      setSignupError('Account aangemaakt, wacht op goedkeuring.');
      setMode('login');
    } else {
      setSignupError('Gebruik een geldig e-mailadres.');
    }
  };

  const handleForgotPassword = () => {
    const norm = loginEmail.trim().toLowerCase();
    if (norm.endsWith('@student.nhlstenden.com')) {
      const s = students.find((st) => (st.email || '').toLowerCase() === norm);
      if (!s) {
        setLoginError('Onbekend e-mailadres.');
        return;
      }
      const code = Math.random().toString(36).slice(2, 8);
      setStudents((prev) =>
        prev.map((st) =>
          st.id === s.id ? { ...st, password: '', tempCode: code } : st
        )
      );
      window.alert(`Resetmail verstuurd. Gebruik code: ${code}`);
    } else if (norm.endsWith('@nhlstenden.com')) {
      const t = teachers.find((te) => te.email.toLowerCase() === norm);
      if (!t) {
        setLoginError('Onbekend e-mailadres.');
        return;
      }
      const code = Math.random().toString(36).slice(2, 8);
      const hash = bcrypt.hashSync(code, 10);
      setTeachers((prev) =>
        prev.map((te) => (te.id === t.id ? { ...te, passwordHash: hash } : te))
      );
      window.alert(`Resetmail verstuurd. Tijdelijk wachtwoord: ${code}`);
    } else {
      setLoginError('Gebruik een geldig e-mailadres.');
    }
  };

  const handleSetNewPassword = () => {
    if (!resetStudent) return;
    if (!newPassword.trim() || newPassword !== newPassword2) return;
    const id = resetStudent.id;
    const pass = newPassword.trim();
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, password: pass, tempCode: undefined } : s))
    );
    setResetStudent(null);
    setNewPassword('');
    setNewPassword2('');
    onStudentLogin(id);
  };

  return (
    <div className="max-w-md mx-auto">
      {resetStudent ? (
        <Card title="Nieuw wachtwoord instellen">
          <TextInput
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Nieuw wachtwoord"
            className="mb-2"
          />
          <TextInput
            type="password"
            value={newPassword2}
            onChange={setNewPassword2}
            placeholder="Bevestig wachtwoord"
            className="mb-4"
          />
          <Button
            className="w-full bg-indigo-600 text-white"
            onClick={handleSetNewPassword}
            disabled={
              !newPassword.trim() ||
              !newPassword2.trim() ||
              newPassword !== newPassword2
            }
          >
            Opslaan
          </Button>
        </Card>
      ) : (
        <Card title={mode === 'login' ? 'Inloggen' : 'Account aanmaken'}>
          {mode === 'login' ? (
            <>
              <TextInput
                value={loginEmail}
                onChange={setLoginEmail}
                placeholder="E-mail"
                className="mb-2"
              />
              <TextInput
                type="password"
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="Wachtwoord"
                className="mb-4"
              />
              {loginError && (
                <div className="text-sm text-rose-600 mb-2">{loginError}</div>
              )}
              <Button
                className="w-full bg-indigo-600 text-white"
                onClick={handleLogin}
                disabled={!loginEmail.trim() || !loginPassword.trim()}
              >
                Inloggen
              </Button>
              <button
                className="text-sm text-indigo-600 text-left mt-2"
                onClick={handleForgotPassword}
              >
                Wachtwoord vergeten?
              </button>
              <button
                className="text-sm text-indigo-600 text-left mt-2"
                onClick={() => {
                  setLoginEmail('');
                  setLoginPassword('');
                  setLoginError('');
                  setMode('signup');
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
                placeholder="E-mail"
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
                className="mb-4"
              />
              {signupError && (
                <div className="text-sm text-rose-600 mb-2">{signupError}</div>
              )}
              <Button
                className="w-full bg-indigo-600 text-white"
                onClick={handleSignup}
                disabled={
                  !signupEmail.trim() ||
                  !signupPassword.trim() ||
                  !signupPassword2.trim()
                }
              >
                Account aanmaken
              </Button>
              <button
                className="text-sm text-indigo-600 text-left mt-2"
                onClick={() => {
                  setSignupEmail('');
                  setSignupPassword('');
                  setSignupPassword2('');
                  setSignupError('');
                  setMode('login');
                }}
              >
                Terug naar inloggen
              </button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}