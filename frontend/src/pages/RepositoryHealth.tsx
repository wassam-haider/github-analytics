import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

interface HealthRow { name: string; health_score: number; }

function GaugeDial({ score }: { score: number }) {
  const pct    = Math.min(100, Math.max(0, score));
  const radius = 42;
  const circ   = Math.PI * radius; // semicircle circumference
  const offset = circ * (1 - pct / 100);

  const color = pct >= 70 ? 'var(--olive)' : pct >= 40 ? 'var(--burnt-amber)' : 'var(--rust-red)';

  return (
    <div className="gauge-wrap" aria-label={`Health score: ${Math.round(score)}`}>
      <svg className="gauge-svg" viewBox="0 0 100 100" aria-hidden="true">
        {/* Track */}
        <path
          d="M 8 54 A 42 42 0 0 1 92 54"
          fill="none"
          stroke="var(--cream-border)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Arc */}
        <path
          d="M 8 54 A 42 42 0 0 1 92 54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="gauge-label">{Math.round(score)}</span>
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  if (score >= 70) return <span style={{ color: 'var(--olive)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>● Healthy</span>;
  if (score >= 40) return <span style={{ color: 'var(--burnt-amber)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>● Fair</span>;
  return <span style={{ color: 'var(--rust-red)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>● Needs Attention</span>;
}

export default function RepositoryHealth() {
  const [data, setData]       = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/health`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-wrap">
      <div className="spinner" role="status" aria-label="Loading…" />
      <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>Fetching health data…</span>
    </div>
  );

  return (
    <section aria-labelledby="health-title">
      <div className="page-header">
        <h2 id="health-title">Repository Health</h2>
        <p>Issue resolution, PR success, and activity composite scores</p>
      </div>

      {!data.length ? (
        <div className="empty-state">No health data yet. Run the Spark ETL pipeline to generate repo health scores.</div>
      ) : (
        <div className="health-grid">
          {data.map(row => (
            <article className="health-card" key={row.name}>
              <GaugeDial score={row.health_score} />
              <p className="health-repo-name">{row.name}</p>
              <HealthBadge score={row.health_score} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
