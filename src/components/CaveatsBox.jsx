import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function CaveatsBox({ caveats }) {
  if (!caveats || caveats.length === 0) return null;

  return (
    <div className="caveats-box">
      <div className="caveats-title">
        <AlertTriangle size={16} />
        <span>Data Quality Caveats</span>
      </div>
      <ul className="caveats-list">
        {caveats.map((caveat, index) => (
          <li key={index}>{caveat}</li>
        ))}
      </ul>
    </div>
  );
}
