import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, Button, TextInput } from './components/ui';
import BadgeOverview from './components/BadgeOverview';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useAwards from './hooks/useAwards';
import { genId, emailValid, getIndividualLeaderboard, getGroupLeaderboard, nameFromEmail } from './utils';
import useBadges from './hooks/useBadges';

export default function Student({
  selectedStudentId = '',
  setSelectedStudentId = () => {},
  previewStudentId,
  route = '/student',
}) {
  const [students, setStudents] = useStudents();
  const [groups] = useGroups();
  const [awards] = useAwards();
  const [badgeDefs] = useBadges();

  const inPreview = previewStudentId !== undefined;
  const activeStudentId = inPreview ? previewStudentId : selectedStudentId;
  const bgPosClass = inPreview ? 'absolute' : 'fixed';

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
      { id, name, email: email || undefined, password, groupId: null, points: 0, badges: [], photo: '' }
    ]);
    return id;
  }, [setStudents]);

  useEffect(() => {
    if (!inPreview && selectedStudentId && !students.find((s) => s.id === selectedStudentId)) {
      setSelectedStudentId('');
    }
  }, [students, selectedStudentId, setSelectedStudentId, inPreview]);

  const me = students.find((s) => s.id === activeStudentId) || null;
  const myGroup = me && me.groupId ? groupById.get(me.groupId) || null : null;
  const myBadges = me?.badges || [];

  const myAwards = useMemo(() => {
    return awards.filter(
      (a) =>
        (a.type === 'student' && a.targetId === activeStudentId) ||
        (a.type === 'group' && myGroup && a.targetId === myGroup.id)
    );
  }, [awards, activeStudentId, myGroup]);

  const myRank = useMemo(
    () => individualLeaderboard.find((r) => r.id === activeStudentId) || null,
    [individualLeaderboard, activeStudentId]
  );

  const myGroupRank = useMemo(
    () => (myGroup ? groupLeaderboard.find((r) => r.id === myGroup.id) || null : null),
    [groupLeaderboard, myGroup]
  );

  const [showBadges, setShowBadges] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profilePassword2, setProfilePassword2] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  const [lastSeenBadgeCount, setLastSeenBadgeCount] = useState(0);

  useEffect(() => {
    if (activeStudentId) {
      try {
        const raw = localStorage.getItem(`nm_last_seen_badges_${activeStudentId}`);
        setLastSeenBadgeCount(raw ? parseInt(raw, 10) : 0);
      } catch {
        setLastSeenBadgeCount(0);
      }
    }
  }, [activeStudentId]);

  useEffect(() => {
    if (showBadges && activeStudentId) {
      try {
        localStorage.setItem(
          `nm_last_seen_badges_${activeStudentId}`,
          String(myBadges.length)
        );
      } catch {
        // ignore
      }
      setLastSeenBadgeCount(myBadges.length);
    }
  }, [showBadges, myBadges.length, activeStudentId]);

  const hasUnseenBadges = myBadges.length > lastSeenBadgeCount;

  useEffect(() => {
    setShowProfile(route === '/student/profile');
  }, [route]);

  useEffect(() => {
    if (showProfile && me) {
      setProfileName(me.name || '');
      setProfilePassword('');
      setProfilePassword2('');
      setProfilePhoto(me.photo || '');
    }
  }, [showProfile, me]);

  const [authMode, setAuthMode] = useState('login');

  const handleLogout = () => {
    setSelectedStudentId('');
    window.location.hash = '/';
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setProfilePhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === activeStudentId
          ? {
              ...s,
              name: profileName.trim(),
              password: profilePassword ? profilePassword : s.password,
              photo: profilePhoto,
            }
          : s
      )
    );
    window.location.hash = '/student';
  };

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetStudent, setResetStudent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const handleLogin = () => {
    if (!emailValid(loginEmail)) return;
    const normEmail = loginEmail.trim().toLowerCase();
    const existing = students.find((s) => (s.email || '').toLowerCase() === normEmail);
    if (existing) {
      const pass = loginPassword.trim();
      if (existing.tempCode && pass === existing.tempCode) {
        setResetStudent(existing);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
      } else if ((existing.password || '') === pass) {
        setSelectedStudentId(existing.id);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
      } else {
        setLoginError('Onjuist wachtwoord of code.');
      }
    } else {
      setLoginError('Onbekend e-mailadres.');
    }
  };

  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [signupError, setSignupError] = useState('');
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
    const existing = students.find((s) => (s.email || '').toLowerCase() === normEmail);
    if (existing) {
      setSignupError('E-mailadres bestaat al.');
    } else {
      const newId = addStudent(signupName.trim(), normEmail, signupPassword);
      setSelectedStudentId(newId);
      setSignupEmail('');
      setSignupName('');
      setSignupPassword('');
      setSignupPassword2('');
      setSignupError('');
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
    setSelectedStudentId(id);
    setNewPassword('');
    setNewPassword2('');
  };
  
  if (resetStudent) {
    return (
      <div className="max-w-md mx-auto">
        <Card title="Nieuw wachtwoord instellen">
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Nieuw wachtwoord"
            />
            <TextInput
              type="password"
              value={newPassword2}
              onChange={setNewPassword2}
              placeholder="Bevestig wachtwoord"
            />
            <Button
              className="bg-indigo-600 text-white"
              disabled={!newPassword.trim() || newPassword !== newPassword2}
              onClick={handleSetNewPassword}
            >
              Opslaan
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Background image */}
      <div className={`${bgPosClass} inset-0 z-0 pointer-events-none`}>
        <img
          src={process.env.PUBLIC_URL + '/images/voorpagina.png'}
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {activeStudentId && me && (
          inPreview ? (
            <div className="flex items-center justify-between mb-4">
              <span className="bg-white/90 px-2 py-1 rounded">
                Preview van {me.name}{me.email ? ` (${me.email})` : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-4">
              <span className="bg-white/90 px-2 py-1 rounded">
                Ingelogd als {me.name}{me.email ? ` (${me.email})` : ''}
              </span>
              <div className="flex gap-2">
                <Button
                  className="bg-indigo-600 text-white"
                  onClick={() => (window.location.hash = '/student/profile')}
                >
                  Mijn profiel
                </Button>
                <Button className="bg-indigo-600 text-white" onClick={handleLogout}>
                  Uitloggen
                </Button>
              </div>
            </div>
          )
        )}

        {!activeStudentId ? (
          inPreview ? (
            <div className="max-w-md mx-auto">
              <Card title="Geen student geselecteerd">
                <p className="text-sm text-neutral-700">
                  Selecteer een student om de preview te zien.
                </p>
              </Card>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              {authMode === 'login' ? (
                <Card title="Log in">
                  <div className="grid grid-cols-1 gap-4">
                    <TextInput value={loginEmail} onChange={setLoginEmail} placeholder="E-mail (@student.nhlstenden.com)" />
                    <TextInput
                      type="password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="Wachtwoord of code"
                    />
                    {loginEmail && !emailValid(loginEmail) && (
                      <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
                    )}
                    {loginError && <div className="text-sm text-rose-600">{loginError}</div>}
                    <Button
                      className="bg-indigo-600 text-white"
                      disabled={!loginEmail.trim() || !emailValid(loginEmail) || !loginPassword.trim()}
                      onClick={handleLogin}
                    >
                      Log in
                    </Button>
                    <button
                      className="text-sm text-indigo-600 text-left"
                      onClick={() => {
                        setSignupEmail('');
                        setSignupName('');
                        setSignupPassword('');
                        setSignupPassword2('');
                        setSignupError('');
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
                      <div className="text-sm text-rose-600">Alleen adressen eindigend op @student.nhlstenden.com zijn toegestaan.</div>
                    )}
                    <TextInput value={signupName} onChange={setSignupName} placeholder="Volledige naam" />
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
                        setAuthMode('login');
                      }}
                    >
                      Terug naar inloggen
                    </button>
                  </div>
                </Card>
              )}
            </div>
          )
        ) : showProfile ? (
          <div className="max-w-md mx-auto">
            <Card title="Mijn profiel">
              <div className="grid grid-cols-1 gap-4">
                <TextInput value={profileName} onChange={setProfileName} placeholder="Naam" />
                <div>
                  <label className="block text-sm font-medium mb-1">E-mail</label>
                  <div className="text-sm">{me.email || '-'}</div>
                </div>
                <TextInput
                  type="password"
                  value={profilePassword}
                  onChange={setProfilePassword}
                  placeholder="Nieuw wachtwoord"
                />
                <TextInput
                  type="password"
                  value={profilePassword2}
                  onChange={setProfilePassword2}
                  placeholder="Bevestig wachtwoord"
                />
                <div>
                  <label className="block text-sm font-medium mb-1">Profielfoto</label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} />
                  {profilePhoto && (
                    <img
                      src={profilePhoto}
                      alt="Profielfoto"
                      className="mt-2 w-32 h-32 object-cover rounded-full"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-indigo-600 text-white"
                    onClick={handleSaveProfile}
                    disabled={!profileName.trim() || (profilePassword && profilePassword !== profilePassword2)}
                  >
                    Opslaan
                  </Button>
                  <Button onClick={() => (window.location.hash = '/student')}>Annuleren</Button>
                </div>
              </div>
            </Card>
          </div>
        ) : showBadges ? (
          <div className="max-w-3xl mx-auto">

            <Card title="Verdiende badges">
              <div className="sticky top-0 bg-white pb-4 z-10">
                <Button className="bg-indigo-600 text-white" onClick={() => setShowBadges(false)}>
                  Terug naar puntenoverzicht
                </Button>
              </div>
              <BadgeOverview badgeDefs={badgeDefs} earnedBadges={myBadges} />
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card title="Badges" className="lg:col-span-3">
              {me ? (
                <>
                  {hasUnseenBadges && (
                    <p className="text-sm text-indigo-600 mb-2">
                      Je hebt nieuwe badges gekregen. Bekijk ze nu!
                    </p>
                  )}
                  <Button className="bg-indigo-600 text-white" onClick={() => setShowBadges(true)}>
                    Bekijk badges
                  </Button>
                </>
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
                      {new Date(a.ts).toLocaleString()} · {a.type === 'student' ? 'Individueel' : `Groep (${myGroup?.name || '-'})`}{' '}
                      {a.reason ? `— ${a.reason}` : ''}
                    </span>
                    <span className={`font-semibold ${a.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{a.amount >= 0 ? '+' : ''}{a.amount}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Leaderboard – Individueel" className="lg:col-span-2">
              <table className="w-full text-sm whitespace-nowrap">
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
                    const meRow = individualLeaderboard.find((r) => r.id === activeStudentId);
                    const isTop3 = meRow && meRow.rank <= 3;
                    return (
                      <>
                        {top3.map((row) => (
                          <tr key={row.id} className={`border-b last:border-0 ${row.id === activeStudentId ? 'bg-indigo-50' : ''}`}>
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
        )}
      </div>
    </div>
  );
}
