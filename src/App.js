import React, { useState, useEffect, useMemo } from 'react';

// Helper function to generate a simple unique identifier using timestamp and
// a random suffix.  It's not cryptographically secure but fine for demo
// purposes.
function generateId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
  );
}

// Compute group statistics: average individual points plus group bonus.
function computeGroupStats(students, groups) {
  return groups.map((group) => {
    const members = students.filter((s) => s.groupId === group.id);
    const average = members.length
      ? members.reduce((sum, s) => sum + s.points, 0) / members.length
      : 0;
    const total = average + group.bonus;
    return {
      ...group,
      membersCount: members.length,
      average,
      total,
    };
  });
}

// Main application component.  Handles login, administration and student views.
export default function App() {
  // Application view: 'login', 'student', 'admin', 'scoreboard'
  const [view, setView] = useState('login');
  // Loaded from localStorage or empty
  const [students, setStudents] = useState(() => {
    try {
      const data = localStorage.getItem('houseOfNeuroStudents');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  });
  const [groups, setGroups] = useState(() => {
    try {
      const data = localStorage.getItem('houseOfNeuroGroups');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  });
  // The logged-in student ID (if any)
  const [currentStudentId, setCurrentStudentId] = useState(null);
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginError, setLoginError] = useState('');

  // Persist students and groups to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('houseOfNeuroStudents', JSON.stringify(students));
  }, [students]);
  useEffect(() => {
    localStorage.setItem('houseOfNeuroGroups', JSON.stringify(groups));
  }, [groups]);

  // Derived leaderboards (memoized to avoid recomputation)
  const individualLeaderboard = useMemo(() => {
    return [...students].sort((a, b) => b.points - a.points);
  }, [students]);
  const groupLeaderboard = useMemo(() => {
    return computeGroupStats(students, groups).sort((a, b) => b.total - a.total);
  }, [students, groups]);

  // Handle login form submission
  const handleLogin = (e) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    const name = loginName.trim();
    // Validate domain
    const domain = '@student.nhlstenden.com';
    if (!email.endsWith(domain)) {
      setLoginError(`Alleen e-mailadressen eindigend op ${domain} zijn toegestaan.`);
      return;
    }
    if (!name) {
      setLoginError('Vul je naam in.');
      return;
    }
    // Existing student?
    const existing = students.find((s) => s.email === email);
    if (existing) {
      // Update name if changed
      if (existing.name !== name) {
        setStudents((prev) =>
          prev.map((s) => (s.id === existing.id ? { ...s, name } : s))
        );
      }
      setCurrentStudentId(existing.id);
    } else {
      const newStudent = {
        id: generateId(),
        email,
        name,
        points: 0,
        groupId: null,
      };
      setStudents((prev) => [...prev, newStudent]);
      setCurrentStudentId(newStudent.id);
    }
    // Clear form and proceed
    setLoginEmail('');
    setLoginName('');
    setLoginError('');
    setView('student');
  };

  // Admin: add a new group
  const handleAddGroup = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = groups.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return;
    const newGroup = { id: generateId(), name: trimmed, bonus: 0 };
    setGroups((prev) => [...prev, newGroup]);
  };
  // Admin: assign a student to a group
  const handleAssignStudentToGroup = (studentId, groupId) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, groupId } : s))
    );
  };
  // Admin: award points to a student (can be negative)
  const handleAwardToStudent = (studentId, delta) => {
    const pointsDelta = parseFloat(delta);
    if (isNaN(pointsDelta)) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, points: s.points + pointsDelta } : s))
    );
  };
  // Admin: award bonus points to a group (can be negative)
  const handleAwardToGroup = (groupId, delta) => {
    const bonusDelta = parseFloat(delta);
    if (isNaN(bonusDelta)) return;
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, bonus: g.bonus + bonusDelta } : g))
    );
  };

  // Helper to get the current student object
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === currentStudentId) || null;
  }, [students, currentStudentId]);

  // Render login form
  const renderLogin = () => (
    <div className="container">
      <h2>Inloggen</h2>
      <form onSubmit={handleLogin}>
        <div className="field">
          <label>E-mailadres:</label>
          <br />
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="jouwnaam@student.nhlstenden.com"
            required
          />
        </div>
        <div className="field">
          <label>Volledige naam:</label>
          <br />
          <input
            type="text"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder="Jouw naam"
            required
          />
        </div>
        {loginError && <div className="error">{loginError}</div>}
        <button type="submit">Ga verder</button>
      </form>
      <div className="nav">
        <button onClick={() => setView('scoreboard')}>Bekijk klassement</button>
        <button onClick={() => setView('admin')}>Beheeromgeving</button>
      </div>
    </div>
  );

  // Render scoreboard (common for both admin and student views)
  const renderScoreboard = () => (
    <div className="container">
      <h2>Algemeen klassement</h2>
      <div className="nav">
        {currentStudent && <button onClick={() => setView('student')}>Mijn dashboard</button>}
        <button onClick={() => setView('admin')}>Beheer</button>
        <button onClick={() => setView('login')}>Uitloggen</button>
      </div>
      <h3>Individuen</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Naam</th>
            <th>Punten</th>
          </tr>
        </thead>
        <tbody>
          {individualLeaderboard.map((s, idx) => {
            const cls = s.points > 0 ? 'positive' : s.points < 0 ? 'negative' : 'zero';
            return (
              <tr key={s.id}>
                <td>
                  {idx === 0 && <span className="star">⭐</span>}
                  {idx + 1}
                </td>
                <td>{s.name}</td>
                <td className={cls}>{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Groepen</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Groep</th>
            <th>Leden</th>
            <th>Gemiddelde</th>
            <th>Bonus</th>
            <th>Totaal</th>
          </tr>
        </thead>
        <tbody>
          {groupLeaderboard.map((g, idx) => {
            const avgCls = g.average > 0 ? 'positive' : g.average < 0 ? 'negative' : 'zero';
            const bonusCls = g.bonus > 0 ? 'positive' : g.bonus < 0 ? 'negative' : 'zero';
            const totalCls = g.total > 0 ? 'positive' : g.total < 0 ? 'negative' : 'zero';
            return (
              <tr key={g.id}>
                <td>
                  {idx === 0 && <span className="star">⭐</span>}
                  {idx + 1}
                </td>
                <td>{g.name}</td>
                <td>{g.membersCount}</td>
                <td className={avgCls}>{g.average.toFixed(1)}</td>
                <td className={bonusCls}>{g.bonus}</td>
                <td className={totalCls}>{g.total.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Render admin interface: add groups, assign students to groups, award points
  const renderAdmin = () => {
    // Local form state
    const [newGroupName, setNewGroupName] = useState('');
    const [assignStudentId, setAssignStudentId] = useState('');
    const [assignGroupId, setAssignGroupId] = useState('');
    const [studentAwardValue, setStudentAwardValue] = useState('');
    const [groupAwardGroupId, setGroupAwardGroupId] = useState('');
    const [groupAwardValue, setGroupAwardValue] = useState('');
    return (
      <div className="container">
        <h2>Beheeromgeving</h2>
        <div className="nav">
          <button onClick={() => setView('scoreboard')}>Klassement</button>
          <button onClick={() => setView('login')}>Uitloggen</button>
        </div>
        <h3>Groep toevoegen</h3>
        <div className="field">
          <input
            type="text"
            placeholder="Naam van nieuwe groep"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button
            onClick={() => {
              handleAddGroup(newGroupName);
              setNewGroupName('');
            }}
          >
            Voeg toe
          </button>
        </div>
        <h3>Student aan groep toewijzen</h3>
        <div className="field">
          <select
            value={assignStudentId}
            onChange={(e) => setAssignStudentId(e.target.value)}
          >
            <option value="">Kies student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
          <select
            value={assignGroupId}
            onChange={(e) => setAssignGroupId(e.target.value)}
          >
            <option value="">Kies groep</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (assignStudentId && assignGroupId) {
                handleAssignStudentToGroup(assignStudentId, assignGroupId);
                setAssignStudentId('');
                setAssignGroupId('');
              }
            }}
          >
            Toewijzen
          </button>
        </div>
        <h3>Punten toekennen aan student</h3>
        <div className="field">
          <select
            value={assignStudentId}
            onChange={(e) => setAssignStudentId(e.target.value)}
          >
            <option value="">Kies student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Punten (bijv. 5 of -3)"
            value={studentAwardValue}
            onChange={(e) => setStudentAwardValue(e.target.value)}
          />
          <button
            onClick={() => {
              if (assignStudentId && studentAwardValue) {
                handleAwardToStudent(assignStudentId, studentAwardValue);
                setStudentAwardValue('');
              }
            }}
          >
            Toekennen
          </button>
        </div>
        <h3>Bonus toekennen aan groep</h3>
        <div className="field">
          <select
            value={groupAwardGroupId}
            onChange={(e) => setGroupAwardGroupId(e.target.value)}
          >
            <option value="">Kies groep</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Bonus (bijv. 2 of -1)"
            value={groupAwardValue}
            onChange={(e) => setGroupAwardValue(e.target.value)}
          />
          <button
            onClick={() => {
              if (groupAwardGroupId && groupAwardValue) {
                handleAwardToGroup(groupAwardGroupId, groupAwardValue);
                setGroupAwardValue('');
              }
            }}
          >
            Toekennen
          </button>
        </div>
      </div>
    );
  };

  // Render student dashboard: show personal points, group info and allow navigation
  const renderStudent = () => {
    if (!currentStudent) {
      return <div className="container">Geen student gevonden.</div>;
    }
    const group = groups.find((g) => g.id === currentStudent.groupId);
    const groupStats = group
      ? computeGroupStats(students, groups).find((g) => g.id === group.id)
      : null;
    const pointsCls = currentStudent.points > 0 ? 'positive' : currentStudent.points < 0 ? 'negative' : 'zero';
    const groupTotalCls = groupStats
      ? groupStats.total > 0
        ? 'positive'
        : groupStats.total < 0
        ? 'negative'
        : 'zero'
      : 'zero';
    return (
      <div className="container">
        <h2>Welkom, {currentStudent.name}</h2>
        <div className="nav">
          <button onClick={() => setView('scoreboard')}>Klassement</button>
          <button onClick={() => setView('login')}>Uitloggen</button>
        </div>
        <p>
          Je totale punten: <span className={pointsCls}>{currentStudent.points}</span>
        </p>
        {group ? (
          <p>
            Je zit in groep <strong>{group.name}</strong>. Groepsscore (gemiddelde + bonus):{' '}
            <span className={groupTotalCls}>{groupStats.total.toFixed(1)}</span>
          </p>
        ) : (
          <p>Je zit nog in geen groep.</p>
        )}
        <h3>Log</h3>
        <p>
          Hieronder zie je jouw persoonlijke punten en de groepsscore. Neem voor vragen
          contact op met je docent.
        </p>
        {renderScoreboard()}
      </div>
    );
  };

  // Determine which view to render
  switch (view) {
    case 'login':
      return renderLogin();
    case 'admin':
      return renderAdmin();
    case 'student':
      return renderStudent();
    case 'scoreboard':
    default:
      return renderScoreboard();
  }
}