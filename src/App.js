import React, { useState, useEffect } from 'react';
import Admin from './Admin';
import Student from './Student';
import { Card, Button, TextInput } from './components/ui';

export default function App() {
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
          isAdmin ? <Admin /> : <AdminGate onAllow={allowAdmin} />
        ) : (
          <Student />
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
