import React, { useState } from 'react';

export default function BadgeOverview({ badgeDefs, earnedBadges }) {
  const [expanded, setExpanded] = useState(null);

  const expandedBadge = badgeDefs.find((b) => b.id === expanded);

  return (
    <div className="p-4">
      <div className="badge-stack">
        {badgeDefs.map((b) => {
          const earned = earnedBadges.includes(b.id);
          return (
            <div key={b.id} className="relative z-0 hover:z-10">
              {earned ? (
                <img
                  src={b.image}
                  alt={b.title}
                  className="badge-box rounded-full border object-cover cursor-pointer"
                  onClick={() => setExpanded(b.id)}
                />
              ) : (
                <div className="badge-box rounded-full border bg-white"></div>
              )}
            </div>
          );
        })}
      </div>

      {expandedBadge && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setExpanded(null)}
        >
          <img
            src={expandedBadge.image}
            alt={expandedBadge.title}
            className="max-w-full max-h-full cursor-pointer object-contain"
          />
        </div>
      )}
    </div>
  );
}
