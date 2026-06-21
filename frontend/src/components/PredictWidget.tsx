import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backend-fawn-omega-20.vercel.app/api';

interface PredictResult { repo_id: number; current_stars: number; expected_stars_next_month: number; }

export default function PredictWidget() {
  const [repoId, setRepoId]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [slowLoad, setSlowLoad] = useState(false); // true if request taking >3s (HF cold-start)
  const [result, setResult]     = useState<PredictResult | null>(null);
  const [error, setError]       = useState('');
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show warm-up hint if the request takes longer than 3 seconds
  useEffect(() => {
    if (loading) {
      slowTimer.current = setTimeout(() => setSlowLoad(true), 3000);
    } else {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setSlowLoad(false);
    }
    return () => { if (slowTimer.current) clearTimeout(slowTimer.current); };
  }, [loading]);

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
      const detail = err.response?.data?.detail || '';
      if (err.response?.status === 504 || detail.toLowerCase().includes('warm')) {
        setError('Model is warming up — the inference server was sleeping. Please retry in a few seconds.');
      } else if (err.response?.status === 503) {
        setError('Predictions temporarily unavailable. The inference service may be restarting.');
      } else if (err.response?.status === 404) {
        setError(`Repository ID ${repoId.trim()} was not found in the database.`);
      } else {
        setError(detail || 'Prediction failed. Please try again.');
      }
    }
    setLoading(false);
  };

  const delta = result ? result.expected_stars_next_month - result.current_stars : 0;
  const isPositive = delta >= 0;

  return (
    <div className="paper-card" style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
          Repo Growth Prediction
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-faint)' }}>
          Enter a repository ID to predict expected stars next month using the RandomForest model hosted on Hugging Face.
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

      {/* Cold-start warm-up hint */}
      {loading && slowLoad && (
        <div style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--paper-bg)',
          border: '1px solid var(--cream-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--ink-faint)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <span className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
          Warming up the inference server — free tier sleeps after inactivity. This usually takes 10–20s.
        </div>
      )}

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
            ◌ RandomForest model — served via Hugging Face Spaces
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 'var(--space-4)', color: 'var(--rust-red)', fontSize: 'var(--text-sm)' }}>{error}</p>
      )}
    </div>
  );
}
