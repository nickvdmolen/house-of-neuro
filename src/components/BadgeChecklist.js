import React, { useMemo, useState, useEffect } from 'react';

const badgeCollator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

const normalizeTitle = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  const stringValue = String(value).trim();
  return stringValue || fallback;
};

export default function BadgeChecklist({ badgeDefs, studentBadges, onToggle }) {
  const [numColumns, setNumColumns] = useState(1);

  useEffect(() => {
    const updateColumns = () => {
      setNumColumns(window.innerWidth >= 640 ? 2 : 1);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const sortedBadges = useMemo(() => {
    if (!Array.isArray(badgeDefs)) return [];
    return [...badgeDefs].sort((a, b) =>
      badgeCollator.compare(
        normalizeTitle(a?.title, normalizeTitle(a?.id)),
        normalizeTitle(b?.title, normalizeTitle(b?.id))
      )
    );
  }, [badgeDefs]);

  const columns = useMemo(() => {
    const cols = Array.from({ length: numColumns }, () => []);
    sortedBadges.forEach((b, i) => cols[i % numColumns].push(b));
    return cols;
  }, [sortedBadges, numColumns]);

  return (
    <div className="flex gap-4">
      {columns.map((col, idx) => (
        <div key={idx} className="flex flex-col gap-2 flex-1">
          {col.map((b) => (
            <label key={b.id} className="grid grid-cols-[16px_1fr] items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={studentBadges.includes(b.id)}
                onChange={(e) => onToggle(b.id, e.target.checked)}
              />
              <span>{b.title}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
