import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backend-fawn-omega-20.vercel.app/api';

interface PredictResult { repo_id: number; current_stars: number; expected_stars_next_month: number; }

export default function PredictWidget() {
  const [repoId, setRepoId]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<PredictResult | null>(null);
  const [error, setError]     = useState('');

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(`${API_BASE}/predict/${repoId.trim()}`);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Prediction failed. Check that the ML model is trained and loaded.');
    }
    setLoading(false);
  };

  const delta = result ? result.expected_stars_next_month - result.current_stars : 0;
  const isPositive = delta >= 0;

  return (
    <div className="paper-card" style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
          🔮 Repo Growth Prediction
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-faint)' }}>
          Enter a repository ID to predict expected stars next month using the DagsHub RandomForest model.
        </p>
      </div>

      <form onSubmit={handlePredict} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="repo-id-input" style={{ display: 'block', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 'var(--space-2)' }}>
            Repository ID
          </label>
          <input
            id="repo-id-input"
            className="paper-input"
            type="number"
            placeholder="e.g. 42"
            value={repoId}
            onChange={e => setRepoId(e.target.value)}
            min="1"
            required
          />
        </div>
        <button
          type="submit"
          className="btn btn-amber"
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? '…' : 'Predict'}
        </button>
      </form>

      {result && (
        <div style={{
          marginTop: 'var(--space-5)',
          padding: 'var(--space-4)',
          background: 'var(--paper-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--cream-border)',
          boxShadow: 'inset 0 2px 4px rgba(58,51,42,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
            <div>
              <div className="stat-label">Current Stars</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink-charcoal)' }}>
                {Number(result.current_stars).toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-label">Predicted Next Month</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-display)', fontWeight: 700, color: isPositive ? 'var(--olive)' : 'var(--rust-red)' }}>
                {Number(result.expected_stars_next_month).toLocaleString()}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: isPositive ? 'var(--olive)' : 'var(--rust-red)', marginTop: 'var(--space-1)' }}>
                {isPositive ? '↑' : '↓'} {Math.abs(Math.round(delta)).toLocaleString()} stars
              </div>
            </div>
          </div>
          <div className="forecast-disclaimer" style={{ marginTop: 'var(--space-4)' }}>
            ◌ Projected — based on RandomForest model (DagsHub registry)
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 'var(--space-4)', color: 'var(--rust-red)', fontSize: 'var(--text-sm)' }}>{error}</p>
      )}
    </div>
  );
}
