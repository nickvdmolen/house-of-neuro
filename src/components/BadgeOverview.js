import React from 'react';

export default function BadgeOverview({ badgeDefs, earnedBadges }) {
  const visible = badgeDefs.filter((b) => earnedBadges.includes(b.id));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {visible.map((b) => (
        <div key={b.id} className="flex flex-col items-center text-sm">
          <div className="badge-placeholder rounded-full border overflow-hidden"></div>
          <div className="mt-2 text-center">{b.title}</div>
        </div>
      ))}
    </div>
  );
}
