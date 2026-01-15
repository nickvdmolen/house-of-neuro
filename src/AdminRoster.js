import React, { useMemo } from 'react';
import { Card } from './components/ui';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import { getIndividualLeaderboard } from './utils';

export default function AdminRoster() {
  const [students] = useStudents();
  const [groups] = useGroups();
  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);
  const leaderboard = useMemo(() => getIndividualLeaderboard(students), [students]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Scores – Studenten" className="md:col-span-2">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Student</th>
              <th className="py-1 pr-2">Groep</th>
              <th className="py-1 pr-2 text-right">Punten</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-1 pr-2">{row.rank}</td>
                <td className="py-1 pr-2">{row.name}</td>
                <td className="py-1 pr-2">{row.groupId ? groupById.get(row.groupId)?.name || '-' : '-'}</td>
                <td className={`py-1 pr-2 text-right font-semibold ${row.points > 0 ? 'text-emerald-700' : row.points < 0 ? 'text-rose-700' : 'text-neutral-700'}`}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
