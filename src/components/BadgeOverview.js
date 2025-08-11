import React from 'react';

export default function BadgeOverview({ badgeDefs, earnedBadges }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">

      {badgeDefs.map((b) => {
        const earned = earnedBadges.includes(b.id);
        return (
          <div key={b.id} className="flex flex-col items-center text-sm">
            {earned ? (
              <img
                src={b.image}
                alt={b.title}
                className="badge-box rounded-full border object-cover"
              />
            ) : (
              <div className="badge-box rounded-full border bg-white"></div>
            )}
            <div className="mt-2 text-center">{b.title}</div>
          </div>
        );
      })}

    </div>
  );
}
