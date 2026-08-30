import React from 'react';

export default function MetricCards({ cards }) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="metric-cards-grid">
      {cards.map((card, index) => (
        <div key={index} className="metric-card">
          <div className="metric-card-title">{card.title}</div>
          <div className="metric-card-value">{card.value}</div>
          {card.subtitle && <div className="metric-card-subtitle">{card.subtitle}</div>}
        </div>
      ))}
    </div>
  );
}
