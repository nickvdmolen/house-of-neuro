import React from 'react';

export default function BadgeChecklist({ badgeDefs, studentBadges, onToggle }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {badgeDefs.map((b) => (
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
