import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backend-fawn-omega-20.vercel.app/api';

interface Repo {
  id: number;
  name: string;
  language: string;
  stars: number;
  forks: number;
  commit_count: number;
  health_score: number | null;
}

type SortKey = 'stars' | 'forks' | 'commit_count' | 'health_score';

function formatNum(n: number | null) {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
  return <span style={{ marginLeft: 4, color: 'var(--olive)' }}>{dir === 'desc' ? '↓' : '↑'}</span>;
}

export default function TopRepositories() {
  const [data, setData]       = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('stars');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    axios.get(`${API_BASE}/repos/top`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => { setError('Could not load repository data.'); setLoading(false); });
  }, []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  if (loading) return (
    <div className="loading-wrap">
      <div className="spinner" role="status" aria-label="Loading…" />
      <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>Fetching repositories…</span>
    </div>
  );

  const COLS: { key: SortKey; label: string }[] = [
    { key: 'stars',        label: 'Stars' },
    { key: 'forks',        label: 'Forks' },
    { key: 'commit_count', label: 'Commits' },
    { key: 'health_score', label: 'Health' },
  ];

  return (
    <section aria-labelledby="repos-title">
      <div className="page-header">
        <h2 id="repos-title">Top Repositories</h2>
        <p>Sortable leaderboard — click any column header to reorder</p>
      </div>

      {error && <p style={{ color: 'var(--rust-red)', marginBottom: 'var(--space-6)' }}>{error}</p>}

      {!data.length && !error ? (
        <div className="empty-state">No repository data yet. Run the ETL pipeline first.</div>
      ) : (
        <div className="paper-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ledger-table" aria-label="Top repositories">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 52 }}>#</th>
                  <th scope="col">Repository</th>
                  <th scope="col">Language</th>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      scope="col"
                      className={sortKey === col.key ? 'sorted' : ''}
                      onClick={() => handleSort(col.key)}
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleSort(col.key)}
                      aria-sort={sortKey === col.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                      style={{ textAlign: 'right', cursor: 'pointer' }}
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((repo, i) => (
                  <tr key={repo.id}>
                    <td>
                      <span className={i < 3 ? ['rank-badge gold','rank-badge silver','rank-badge bronze'][i] : 'rank-badge'}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{repo.name}</span>
                    </td>
                    <td>
                      {repo.language
                        ? <span style={{ background: 'rgba(107,118,84,0.15)', color: 'var(--olive)', padding: '2px 8px', borderRadius: 12, fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                            {repo.language}
                          </span>
                        : <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-xs)' }}>—</span>
                      }
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 600 }}>⭐ {formatNum(repo.stars)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(repo.forks)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(repo.commit_count)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {repo.health_score !== null
                        ? <span style={{ color: repo.health_score >= 70 ? 'var(--olive)' : repo.health_score >= 40 ? 'var(--burnt-amber)' : 'var(--rust-red)', fontWeight: 700 }}>
                            {Math.round(repo.health_score)}
                          </span>
                        : <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
