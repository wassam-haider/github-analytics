import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Filler,
  Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Filler, Title, Tooltip, Legend,
);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Kraft paper palette for chart datasets
const PALETTE = [
  '#6B7654', '#C17A3E', '#A8472E', '#8A9970',
  '#D49355', '#B86B4A', '#7A8A60', '#C9B89A',
];

const TOOLTIP_STYLE = {
  backgroundColor: '#F3EAD8',
  borderColor: '#CEC0A8',
  borderWidth: 1,
  titleColor: '#3A332A',
  bodyColor: '#6B5F50',
  titleFont: { family: "'Fraunces', serif", weight: 'bold' as const },
  bodyFont:  { family: "'Inter', sans-serif" },
  padding: 10,
  cornerRadius: 6,
  boxShadow: '0 2px 8px rgba(58,51,42,0.25)',
};

const GRID_COLOR = 'rgba(206,192,168,0.5)';
const TICK_COLOR = '#9C8E7E';

interface LangData { language: string; repo_count: number; }

export default function LanguageAnalytics() {
  const [data, setData]     = useState<LangData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/languages`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-wrap">
      <div className="spinner" role="status" aria-label="Loading…" />
      <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>Fetching language data…</span>
    </div>
  );

  if (!data.length) return (
    <div className="empty-state">No language data available yet. Run the ETL pipeline first.</div>
  );

  const labels = data.map(d => d.language);
  const counts = data.map(d => d.repo_count);

  const pieData = {
    labels,
    datasets: [{ data: counts, backgroundColor: PALETTE, borderColor: '#F3EAD8', borderWidth: 2 }],
  };

  const barData = {
    labels,
    datasets: [{
      label: 'Repositories',
      data: counts,
      backgroundColor: PALETTE,
      borderColor: PALETTE.map(c => c),
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  // Simulated trend data — real data requires /api/commits/trend (see backend new endpoints)
  const trendLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
  const trendData = {
    labels: trendLabels,
    datasets: data.slice(0, 4).map((lang, i) => ({
      label: lang.language,
      data: trendLabels.map((_, j) => Math.max(1, lang.repo_count * (0.7 + j * 0.06) + (Math.random() - 0.5) * 2)),
      borderColor: PALETTE[i],
      backgroundColor: `${PALETTE[i]}22`,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: PALETTE[i],
    })),
  };

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: TICK_COLOR, font: { family: "'Inter', sans-serif", size: 11 } },
      },
      tooltip: TOOLTIP_STYLE,
    },
  };

  const barOptions = {
    ...sharedOptions,
    scales: {
      x: { ticks: { color: TICK_COLOR, font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } },
    },
  };

  const lineOptions = {
    ...sharedOptions,
    scales: {
      x: { ticks: { color: TICK_COLOR, font: { size: 11 } }, grid: { color: GRID_COLOR } },
      y: { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } },
    },
  };

  return (
    <section aria-labelledby="lang-title">
      <div className="page-header">
        <h2 id="lang-title">Language Analytics</h2>
        <p>Distribution and trends across all collected repositories</p>
      </div>

      <div className="charts-grid" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="chart-panel">
          <div className="chart-title">Language Distribution — Repo Share</div>
          <Pie data={pieData} options={{
            ...sharedOptions,
            plugins: { ...sharedOptions.plugins, legend: { position: 'bottom', labels: { color: TICK_COLOR, font: { size: 11 }, padding: 12 } } },
          }} />
        </div>
        <div className="chart-panel">
          <div className="chart-title">Repositories by Language</div>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>

      <div className="chart-panel">
        <div className="chart-title">Language Share Trend (Top 4 Languages)</div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ⚠ Projected from current snapshot — time-series endpoint in progress
        </p>
        <Line data={trendData} options={lineOptions} />
      </div>
    </section>
  );
}
