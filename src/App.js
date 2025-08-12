import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Student from './Student';
import AdminRoster from './AdminRoster';
import { Card, Button, TextInput } from './components/ui';
import useStudents from './hooks/useStudents';
import usePersistentState from './hooks/usePersistentState';

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

  const [students] = useStudents();
  const [selectedStudentId, setSelectedStudentId] = usePersistentState('nm_points_current_student', '');
  const me = students.find((s) => s.id === selectedStudentId) || null;

  const [menuOpen, setMenuOpen] = useState(false);

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
                  {me && (
                    <button onClick={() => { setSelectedStudentId(''); setMenuOpen(false); }} className="dropdown-button">Uitloggen student</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => { denyAdmin(); setMenuOpen(false); }} className="dropdown-button">Uitloggen beheer</button>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {route === '/student' && me && (
          <div className="text-center mb-4">Ingelogd als {me.name}</div>
        )}

        {route === '/admin' ? (
          isAdmin ? <Admin /> : <AdminGate onAllow={allowAdmin} />
        ) : route === '/student' ? (
          <Student />
        ) : route === '/roster' ? (
          isAdmin ? <AdminRoster /> : <AdminGate onAllow={allowAdmin} />
        ) : (
          <RoleSelect />
        )}
      </div>
    </div>
  );
}

function AdminGate({ onAllow }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const ACCEPT = 'neuro2025';

  const submit = () => {
    if (code.trim() === ACCEPT) {
      setError('');
      onAllow();
    } else {
      setError('Onjuiste code.');
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

function RoleSelect() {
  return (
    <div className="max-w-md mx-auto">
      <Card title="Wie ben je?">
        <div className="flex flex-col gap-4">
          <a href="#/student" className="w-full">
            <Button className="w-full bg-indigo-600 text-white">Ik ben student</Button>
          </a>
          <a href="#/admin" className="w-full">
            <Button className="w-full bg-indigo-600 text-white">Ik ben docent</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
