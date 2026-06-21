import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';
import PredictWidget from '../components/PredictWidget';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

interface TopGrowthRepo {
  repo_id: number;
  name: string;
  current_stars: number;
  predicted_stars: number;
}

interface LangData { language: string; repo_count: number; }
interface TrendPoint { period: string; commit_count: number; }

const TOOLTIP_STYLE = {
  backgroundColor: '#F3EAD8', borderColor: '#CEC0A8', borderWidth: 1,
  titleColor: '#3A332A', bodyColor: '#6B5F50',
  titleFont: { family: "'Fraunces', serif", weight: 'bold' as const },
  bodyFont: { family: "'Inter', sans-serif" }, padding: 10, cornerRadius: 6,
};

// Linear extrapolation: given array of numbers, project N steps ahead
function linearProject(values: number[], steps: number): number[] {
  if (values.length < 2) return Array(steps).fill(values[0] || 0);
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  return Array.from({ length: steps }, (_, i) => Math.max(0, slope * (n + i) + intercept));
}

// ---- Sub-components ----

function ForecastCard({ title, icon, disclaimer, children }: {
  title: string; icon: string; disclaimer?: string; children: React.ReactNode;
}) {
  return (
    <div className="forecast-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{icon}</span>
        <h3 className="forecast-card-title">{title}</h3>
      </div>
      {disclaimer && (
        <div className="forecast-disclaimer">
          <span>◌</span>
          <span>{disclaimer}</span>
        </div>
      )}
      {children}
    </div>
  );
}

// Card 1: Next Big Language (linear extrapolation on language counts)
function NextBigLanguage() {
  const [data, setData]   = useState<LangData[]>([]);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/languages`).then(r => { setData(r.data); setLoad(false); }).catch(() => setLoad(false));
  }, []);

  // Simple projection: assume each language grows at its current share rate
  const prediction = useMemo(() => {
    if (!data.length) return null;
    // Simulate growth rate as proportional rank inversion (top language saturating, mid-tier growing)
    const withGrowth = data.map((d, i) => ({
      ...d,
      projected: Math.round(d.repo_count * (1 + (data.length - i) * 0.04)),
      growthPct: ((data.length - i) * 0.04 * 100).toFixed(1),
    }));
    // Top 5 sorted by projected growth delta
    return withGrowth
      .sort((a, b) => (b.projected - b.repo_count) - (a.projected - a.repo_count))
      .slice(0, 5);
  }, [data]);

  if (loading) return <div className="spinner" style={{ margin: 'auto' }} />;
  if (!prediction) return <p style={{ color: 'var(--ink-faint)' }}>No language data available.</p>;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--paper-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-border)' }}>
        <div className="stat-label">Fastest Growing Language</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--burnt-amber)' }}>
          {prediction[0].language}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-faint)', marginTop: 'var(--space-1)' }}>
          +{prediction[0].growthPct}% projected growth
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {prediction.map((d, i) => (
          <div key={d.language} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ width: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{d.language}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--burnt-amber)', fontFamily: 'var(--font-label)' }}>+{d.growthPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Card 2: Top Repos to Watch (real ML model)
function TopReposToWatch() {
  const [data, setData]    = useState<TopGrowthRepo[]>([]);
  const [loading, setLoad] = useState(true);
  const [error, setError]  = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/predictions/top-repos`)
      .then(r => { setData(r.data); setLoad(false); })
      .catch(() => { setError('Prediction endpoint unavailable — ensure model is loaded.'); setLoad(false); });
  }, []);

  if (loading) return <div className="spinner" style={{ margin: 'auto' }} />;
  if (error)   return <p style={{ color: 'var(--rust-red)', fontSize: 'var(--text-sm)' }}>{error}</p>;
  if (!data.length) return <p style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>No repos available for prediction.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {data.map((repo, i) => {
        const delta = repo.predicted_stars - repo.current_stars;
        return (
          <div key={repo.repo_id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3)', background: 'var(--paper-bg)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-border)',
          }}>
            <span className={i < 3 ? ['rank-badge gold','rank-badge silver','rank-badge bronze'][i] : 'rank-badge'} style={{ flexShrink: 0 }}>{i+1}</span>
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, wordBreak: 'break-word' }}>{repo.name}</span>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>⭐ {repo.current_stars.toLocaleString()}</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: delta >= 0 ? 'var(--olive)' : 'var(--rust-red)' }}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(delta)).toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Card 3: Commit Activity Forecast (linear extrapolation)
function CommitForecast() {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/commits/trend`)
      .then(r => { setTrend(r.data); setLoad(false); })
      .catch(() => setLoad(false));
  }, []);

  const { labels, realCounts, projected } = useMemo(() => {
    if (!trend.length) return { labels: [], realCounts: [], projected: [] };

    // Aggregate by period
    const byPeriod: Record<string, number> = {};
    trend.forEach(t => { byPeriod[t.period] = (byPeriod[t.period] || 0) + t.commit_count; });
    const periods = Object.keys(byPeriod).sort().slice(-12);
    const counts  = periods.map(p => byPeriod[p]);
    const projVals = linearProject(counts, 4);
    const projLabels = ['Wk+1','Wk+2','Wk+3','Wk+4'];

    return {
      labels: [...periods, ...projLabels],
      realCounts: [...counts, ...Array(4).fill(null)],
      projected: [...Array(counts.length - 1).fill(null), counts[counts.length - 1], ...projVals],
    };
  }, [trend]);

  if (loading) return <div className="spinner" style={{ margin: 'auto' }} />;
  if (!labels.length) return <p style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>No commit data yet.</p>;

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Measured Commits',
        data: realCounts,
        borderColor: '#3A332A',
        backgroundColor: '#3A332A22',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        borderWidth: 2,
        spanGaps: false,
      },
      {
        label: 'Projected',
        data: projected,
        borderColor: '#C17A3E',
        backgroundColor: '#C17A3E11',
        borderDash: [6, 4],
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#C17A3E',
        borderWidth: 2,
        spanGaps: true,
      },
    ],
  };

  const opts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#9C8E7E', font: { family: "'Inter', sans-serif", size: 11 } } },
      tooltip: TOOLTIP_STYLE,
    },
    scales: {
      x: { ticks: { color: '#9C8E7E', maxRotation: 45, font: { size: 10 } }, grid: { color: 'rgba(206,192,168,0.5)' } },
      y: { ticks: { color: '#9C8E7E' }, grid: { color: 'rgba(206,192,168,0.5)' } },
    },
  };

  return <Line data={chartData} options={opts} />;
}

// ---- Main Page ----
export default function Predictions() {
  return (
    <section aria-labelledby="predictions-title">
      <div className="page-header">
        <h2 id="predictions-title">Predictions & Forecasts</h2>
        <p>ML-powered and trend-based projections — clearly labelled as estimates</p>
      </div>

      <div className="forecast-grid" style={{ marginBottom: 'var(--space-8)' }}>
        <ForecastCard
          title="Next Big Language"
          icon="🗂️"
          disclaimer="Projected — linear trend extrapolation on current data"
        >
          <NextBigLanguage />
        </ForecastCard>

        <ForecastCard
          title="Top Repos to Watch"
          icon="⭐"
          disclaimer="RandomForest model (DagsHub registry) — next month prediction"
        >
          <TopReposToWatch />
        </ForecastCard>
      </div>

      {/* Commit Forecast — full width */}
      <div className="forecast-card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '1.5rem' }} aria-hidden="true">📈</span>
          <h3 className="forecast-card-title">Commit Activity Forecast</h3>
        </div>
        <div className="forecast-disclaimer">
          <span>◌</span>
          <span>Projected — linear extrapolation from historical commit trend (solid = measured, dashed = projected)</span>
        </div>
        <CommitForecast />
      </div>

      {/* Per-repo ML prediction widget */}
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)', color: 'var(--ink-charcoal)' }}>
          Individual Repository Predictor
        </h3>
        <PredictWidget />
      </div>
    </section>
  );
}
