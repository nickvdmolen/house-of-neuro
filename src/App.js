import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Student from './Student';
import { Card, Button, TextInput } from './components/ui';

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

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8 text-slate-800">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Neuromarketing Points · Prototype</h1>
          {route !== '/' && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                aria-label="Menu"
              >☰</button>
              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, marginTop: '8px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                  <a href="#/student" style={{ display: 'block', padding: '8px 12px', textDecoration: 'none', color: '#000' }} onClick={() => setMenuOpen(false)}>Student</a>
                  <a href="#/admin" style={{ display: 'block', padding: '8px 12px', textDecoration: 'none', color: '#000' }} onClick={() => setMenuOpen(false)}>Beheer</a>
                  {route === '/admin' && isAdmin && (
                    <button onClick={() => { denyAdmin(); setMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>Uitloggen</button>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {route === '/admin' ? (
          isAdmin ? <Admin /> : <AdminGate onAllow={allowAdmin} />
        ) : route === '/student' ? (
          <Student />
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
