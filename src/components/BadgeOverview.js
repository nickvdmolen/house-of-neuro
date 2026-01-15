import React, { useState } from 'react';

export default function BadgeOverview({ badgeDefs, earnedBadges }) {
  const [expanded, setExpanded] = useState(null);

  const expandedBadge = badgeDefs.find((b) => b.id === expanded);

  return (
    <div className="p-4">

      <div className="badge-stack">
        {badgeDefs.map((b) => {
          const earned = earnedBadges.includes(b.id);
          const text = earned ? b.title : b.requirement || '';
          const fontSize = Math.max(8, 14 - text.length / 5);
          return (
            <div key={b.id} className="badge-box relative z-0 hover:z-10">
              {earned && b.image ? (
                <img
                  src={b.image}
                  alt={b.title}
                  className="w-full h-full rounded-full border object-cover cursor-pointer"
                  onClick={() => setExpanded(b.id)}
                />
              ) : (
                <div
                  className="w-full h-full rounded-full border bg-white flex items-center justify-center text-center p-1 break-words leading-tight"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {text}
                </div>
              )}
            </div>
          );
        })}
      </div>


      {expandedBadge && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setExpanded(null)}
        >
          <div className="max-h-full overflow-auto text-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={expandedBadge.image}
              alt={expandedBadge.title}
              className="max-w-full max-h-[80vh] mx-auto object-contain"
            />
            {expandedBadge.requirement && (
              <p className="mt-4 text-white">{expandedBadge.requirement}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
