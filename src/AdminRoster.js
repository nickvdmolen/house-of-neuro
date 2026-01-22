import React, { useMemo, useState, useEffect } from 'react';
import { Card, Select } from './components/ui';
import useStudents from './hooks/useStudents';
import useGroups from './hooks/useGroups';
import useSemesters from './hooks/useSemesters';
import { getIndividualLeaderboard } from './utils';

const nameCollator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

export default function AdminRoster() {
  const [students] = useStudents();
  const [groups] = useGroups();
  const [semesters] = useSemesters();
  const [semesterFilter, setSemesterFilter] = useState('');

  const sortedSemesters = useMemo(
    () => [...semesters].sort((a, b) => nameCollator.compare(a?.name || '', b?.name || '')),
    [semesters]
  );
  const hasSemesters = sortedSemesters.length > 0;

  useEffect(() => {
    if (!hasSemesters) {
      if (semesterFilter) setSemesterFilter('');
      return;
    }
    const isSpecial = semesterFilter === 'all' || semesterFilter === 'unassigned';
    if (semesterFilter && !isSpecial && !semesters.find((s) => s.id === semesterFilter)) {
      setSemesterFilter('');
      return;
    }
    if (!semesterFilter) {
      setSemesterFilter(sortedSemesters[0]?.id || '');
    }
  }, [hasSemesters, semesterFilter, semesters, sortedSemesters]);

  const filteredStudents = useMemo(() => {
    if (!hasSemesters || !semesterFilter || semesterFilter === 'all') return students;
    if (semesterFilter === 'unassigned') {
      return students.filter((s) => !s.semesterId);
    }
    return students.filter(
      (s) => String(s.semesterId || '') === String(semesterFilter)
    );
  }, [students, hasSemesters, semesterFilter]);

  const filteredGroups = useMemo(() => {
    if (!hasSemesters || !semesterFilter || semesterFilter === 'all') return groups;
    if (semesterFilter === 'unassigned') {
      return groups.filter((g) => !g.semesterId);
    }
    return groups.filter(
      (g) => String(g.semesterId || '') === String(semesterFilter)
    );
  }, [groups, hasSemesters, semesterFilter]);

  const groupById = useMemo(() => {
    const m = new Map();
    for (const g of filteredGroups) m.set(g.id, g);
    return m;
  }, [filteredGroups]);
  const leaderboard = useMemo(
    () => getIndividualLeaderboard(filteredStudents),
    [filteredStudents]
  );

  return (
    <div className="space-y-4">
      {hasSemesters && (
        <Card title="Semester">
          <Select value={semesterFilter} onChange={setSemesterFilter} className="w-72">
            <option value="all">Alle semesters</option>
            <option value="unassigned">Zonder semester</option>
            {sortedSemesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.name}
              </option>
            ))}
          </Select>
        </Card>
      )}
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
                  <td className="py-1 pr-2">
                    {row.groupId ? groupById.get(row.groupId)?.name || '-' : '-'}
                  </td>
                  <td
                    className={`py-1 pr-2 text-right font-semibold ${
                      row.points > 0
                        ? 'text-emerald-700'
                        : row.points < 0
                        ? 'text-rose-700'
                        : 'text-neutral-700'
                    }`}
                  >
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Groepen">
          <ul className="list-disc pl-5">
            {filteredGroups.map((g) => (
              <li key={g.id}>{g.name}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
