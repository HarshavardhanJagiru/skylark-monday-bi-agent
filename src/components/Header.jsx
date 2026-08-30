import React from 'react';
import { BarChart3, ShieldCheck, Sparkles } from 'lucide-react';

export default function Header({ onLeadershipUpdate, apiConnected }) {
  return (
    <header className="app-header">
      <div className="brand-title">
        <div className="brand-logo">
          🦅
        </div>
        <div className="brand-text">
          <h1>Skylark BI Agent</h1>
          <p>Monday.com Conversational Intelligence • Deals & Work Orders</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="status-badge">
          <div className="status-dot"></div>
          <span>{apiConnected ? 'Monday.com Connected' : 'Dynamic BI Active'}</span>
        </div>

        <button className="btn-leadership" onClick={onLeadershipUpdate}>
          <Sparkles size={16} />
          <span>Generate Leadership Update</span>
        </button>
      </div>
    </header>
  );
}
