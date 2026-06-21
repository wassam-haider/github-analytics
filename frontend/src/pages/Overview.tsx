import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const API_BASE = 'http://localhost:8000/api';

const CHART_COLORS = {
  olive: '#6B7654',
  amber: '#C17A3E',
  rust:  '#A8472E',
  faint: '#CEC0A8',
};

function Sparkline({ color }: { color: string }) {
  // Simulated sparkline data (last 7 data points trend)
  const points = [3, 5, 4, 7, 6, 9, 8].map((v, i) => ({ x: i, y: v }));
  const data = {
    labels: points.map(p => p.x),
    datasets: [{
      data: points.map(p => p.y),
      borderColor: color,
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      backgroundColor: `${color}22`,
      tension: 0.4,
    }],
  };
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    animation: false as const,
  };
  return <Line data={data} options={opts} />;
}

interface OverviewData {
  repositories: number;
  contributors: number;
  commits: number;
  issues: number;
}

const CARDS = [
  { key: 'repositories',  label: 'Repositories Analyzed', mod: '',       color: CHART_COLORS.olive },
  { key: 'contributors',  label: 'Total Contributors',     mod: 'amber',  color: CHART_COLORS.amber },
  { key: 'commits',       label: 'Total Commits',          mod: '',       color: CHART_COLORS.olive },
  { key: 'issues',        label: 'Total Issues',           mod: 'rust',   color: CHART_COLORS.rust  },
] as const;

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/overview`)
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load overview data.'));
  }, []);

  return (
    <section aria-labelledby="overview-title">
      <div className="page-header">
        <h2 id="overview-title">Platform Overview</h2>
        <p>Aggregated metrics across all collected GitHub repositories</p>
      </div>

      {error && <p style={{ color: 'var(--rust-red)', marginBottom: 'var(--space-6)' }}>{error}</p>}

      {!data && !error ? (
        <div className="loading-wrap">
          <div className="spinner" aria-label="Loading…" role="status" />
          <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>Fetching data…</span>
        </div>
      ) : data && (
        <div className="stat-grid">
          {CARDS.map(({ key, label, mod, color }) => (
            <article className={`stat-card ${mod}`} key={key} aria-label={label}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{formatNum(data[key])}</div>
              <div className="stat-sparkline">
                <Sparkline color={color} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
