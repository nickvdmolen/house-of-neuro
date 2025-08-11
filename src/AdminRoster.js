import React, { useMemo } from 'react';
import { Card } from './components/ui';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';

export default function AdminRoster() {
  const [students] = useStudents();
  const [groups] = useGroups();
  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Studenten">
        <ul className="list-disc pl-5">
          {students.map((s) => (
            <li key={s.id}>
              {s.name} {s.groupId ? `(${groupById.get(s.groupId)?.name || '-'})` : '(geen groep)'}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Groepen">
        <ul className="list-disc pl-5">
          {groups.map((g) => (
            <li key={g.id}>{g.name}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
