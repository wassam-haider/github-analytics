import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

interface TrendPoint { period: string; commit_count: number; language?: string; }

const PALETTE = ['#6B7654','#C17A3E','#A8472E','#8A9970','#D49355'];
const TOOLTIP_STYLE = {
  backgroundColor: '#F3EAD8', borderColor: '#CEC0A8', borderWidth: 1,
  titleColor: '#3A332A', bodyColor: '#6B5F50',
  titleFont: { family: "'Fraunces', serif", weight: 'bold' as const },
  bodyFont: { family: "'Inter', sans-serif" }, padding: 10, cornerRadius: 6,
};

// Generate a simple calendar heatmap from trend data
function buildHeatmap(trend: TrendPoint[]) {
  const map: Record<string, number> = {};
  trend.forEach(t => { map[t.period] = (map[t.period] || 0) + t.commit_count; });
  return map;
}

function getLevel(count: number, max: number) {
  if (count === 0) return 0;
  if (count < max * 0.25) return 1;
  if (count < max * 0.5)  return 2;
  if (count < max * 0.75) return 3;
  return 4;
}

function HeatmapCalendar({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-52 * 7);
  const max = Math.max(1, ...Object.values(data));

  if (!entries.length) return <div className="empty-state" style={{ padding: 'var(--space-8)' }}>No commit history data yet.</div>;

  return (
    <div>
      <div className="heatmap-grid" role="img" aria-label="Commit activity heatmap">
        {entries.map(([date, count]) => (
          <div
            key={date}
            className="heatmap-cell"
            data-level={getLevel(count, max)}
            title={`${date}: ${count} commits`}
            aria-label={`${date}: ${count} commits`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Less</span>
        {[0,1,2,3,4].map(l => (
          <div key={l} className="heatmap-cell" data-level={l} style={{ width: 12, height: 12, flexShrink: 0 }} />
        ))}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>More</span>
      </div>
    </div>
  );
}

export default function CommitActivity() {
  const [trend, setTrend]       = useState<TrendPoint[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeFilter, setFilter] = useState<string>('all');

  useEffect(() => {
    axios.get(`${API_BASE}/commits/trend`)
      .then(res => { setTrend(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const heatmapData = useMemo(() => buildHeatmap(trend), [trend]);

  // Group by period for the line chart
  const periods = useMemo(() => {
    const all = [...new Set(trend.map(t => t.period))].sort();
    return all.slice(-30);
  }, [trend]);

  const languages = useMemo(() => {
    const all = [...new Set(trend.map(t => t.language).filter(Boolean))];
    return all.slice(0, 5);
  }, [trend]);

  const lineData = useMemo(() => {
    if (activeFilter === 'all') {
      const byPeriod: Record<string, number> = {};
      trend.forEach(t => { byPeriod[t.period] = (byPeriod[t.period] || 0) + t.commit_count; });
      return {
        labels: periods,
        datasets: [{
          label: 'All Commits',
          data: periods.map(p => byPeriod[p] || 0),
          borderColor: PALETTE[0],
          backgroundColor: `${PALETTE[0]}22`,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2,
        }],
      };
    }
    const filtered = trend.filter(t => t.language === activeFilter);
    const byPeriod: Record<string, number> = {};
    filtered.forEach(t => { byPeriod[t.period] = (byPeriod[t.period] || 0) + t.commit_count; });
    return {
      labels: periods,
      datasets: [{
        label: activeFilter,
        data: periods.map(p => byPeriod[p] || 0),
        borderColor: PALETTE[1],
        backgroundColor: `${PALETTE[1]}22`,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        borderWidth: 2,
      }],
    };
  }, [trend, periods, activeFilter]);

  if (loading) return (
    <div className="loading-wrap">
      <div className="spinner" role="status" aria-label="Loading…" />
      <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-sm)' }}>Fetching commit data…</span>
    </div>
  );

  const lineOpts = {
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

  return (
    <section aria-labelledby="commits-title">
      <div className="page-header">
        <h2 id="commits-title">Commit Activity</h2>
        <p>Historical commit volume across all collected repositories</p>
      </div>

      {/* Calendar Heatmap */}
      <div className="paper-panel" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="chart-title">Commit Volume — Calendar Heatmap</div>
        <HeatmapCalendar data={heatmapData} />
      </div>

      {/* Trend Line */}
      <div className="chart-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>Commit Trend (Last 30 Periods)</div>
          <div className="filter-row" style={{ marginBottom: 0 }}>
            <span className="filter-label">Filter:</span>
            <button
              className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >All</button>
            {languages.map((lang, i) => (
              <button
                key={lang}
                className={`filter-chip ${activeFilter === lang ? 'active' : ''}`}
                onClick={() => setFilter(lang!)}
              >{lang}</button>
            ))}
          </div>
        </div>

        {trend.length > 0
          ? <Line data={lineData} options={lineOpts} />
          : <div className="empty-state">No commit trend data yet. Run the ETL pipeline first.</div>
        }
      </div>
    </section>
  );
}
