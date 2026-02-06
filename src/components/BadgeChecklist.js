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
    <div className="flex flex-col">
      {sortedBadges.map((b) => (
        <label
          key={b.id}
          className="grid items-center gap-x-2 text-sm py-1 cursor-pointer hover:bg-black/5 rounded px-1 -mx-1"
          style={{ gridTemplateColumns: '1rem 1.5rem 1fr 1fr' }}
        >
          <input
            type="checkbox"
            className="shrink-0 w-3.5 h-3.5"
            checked={studentBadges.includes(b.id)}
            onChange={(e) => onToggle(b.id, e.target.checked)}
          />
          {b.image ? (
            <img
              src={b.image}
              alt={b.title}
              className="w-12 h-12 rounded-full object-cover border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full border bg-neutral-100" />
          )}
          <span className="font-medium truncate">{b.title}</span>
          {b.requirement && (
            <span className="text-xs text-neutral-500 truncate">{b.requirement}</span>
          )}
        </label>
      ))}
    </div>
  );
}
