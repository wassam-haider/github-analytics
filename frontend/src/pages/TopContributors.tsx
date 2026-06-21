import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

interface Contributor { username: string; score: number; }

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? 'rank-badge gold' : rank === 2 ? 'rank-badge silver' : rank === 3 ? 'rank-badge bronze' : 'rank-badge';
  return <span className={cls} aria-label={`Rank ${rank}`}>{rank}</span>;
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div style={{
        flex: 1,
        height: 6,
        background: 'var(--cream-border)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: 'var(--olive)',
          borderRadius: 3,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-charcoal)', minWidth: 48, textAlign: 'right' }}>
        {Number(value).toLocaleString()}
      </span>
    </div>
  );
}

export default function TopContributors() {
  const [data, setData]       = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/contributors`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-wrap">
      <div className="spinner" role="status" aria-label="Loading…" />
      <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>Fetching contributor data…</span>
    </div>
  );

  if (!data.length) return (
    <div className="empty-state">No contributor data available yet. Run the ETL pipeline first.</div>
  );

  const maxScore = Math.max(...data.map(d => d.score));

  return (
    <section aria-labelledby="contrib-title">
      <div className="page-header">
        <h2 id="contrib-title">Top Contributors</h2>
        <p>Ranked by productivity score across all repositories</p>
      </div>

      <div className="paper-panel">
        <table className="ledger-table" aria-label="Top contributors ledger">
          <thead>
            <tr>
              <th scope="col" style={{ width: 60 }}>Rank</th>
              <th scope="col">Username</th>
              <th scope="col">Productivity Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.username}>
                <td><RankBadge rank={i + 1} /></td>
                <td>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                    {i < 3 && <span style={{ marginRight: 'var(--space-2)', fontSize: '0.9em' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </span>}
                    {row.username}
                  </span>
                </td>
                <td style={{ paddingRight: 'var(--space-6)' }}>
                  <ScoreBar value={row.score} max={maxScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
