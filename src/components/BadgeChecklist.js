import React, { useMemo } from 'react';

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
  const sortedBadges = useMemo(() => {
    if (!Array.isArray(badgeDefs)) return [];
    return [...badgeDefs].sort((a, b) =>
      badgeCollator.compare(
        normalizeTitle(a?.title, normalizeTitle(a?.id)),
        normalizeTitle(b?.title, normalizeTitle(b?.id))
      )
    );
  }, [badgeDefs]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {sortedBadges.map((b) => (
        <label key={b.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={studentBadges.includes(b.id)}
            onChange={(e) => onToggle(b.id, e.target.checked)}
          />
          {b.title}
        </label>
      ))}
    </div>
  );
}
