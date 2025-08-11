import React from 'react';

export default function BadgeOverview({ badgeDefs, earnedBadges }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {badgeDefs.map((b) => {
        const earned = earnedBadges.includes(b.id);
        return (
          <div key={b.id} className="flex flex-col items-center text-sm">
            <div className="w-20 h-20 rounded-full border overflow-hidden">
              <img
                src={b.image}
                alt={b.title}
                className={`w-full h-full object-cover ${earned ? '' : 'opacity-20 grayscale'}`}
              />
            </div>
            <div className="mt-2 text-center">{b.title}</div>
          </div>
        );
      })}
    </div>
  );
}
