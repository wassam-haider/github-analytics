import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Overview from './pages/Overview';
import LanguageAnalytics from './pages/LanguageAnalytics';
import TopContributors from './pages/TopContributors';
import RepositoryHealth from './pages/RepositoryHealth';
import TopRepositories from './pages/TopRepositories';
import CommitActivity from './pages/CommitActivity';
import Predictions from './pages/Predictions';
import './index.css';

const NAV_ITEMS = [
  { to: '/',            label: 'Overview' },
  { to: '/languages',   label: 'Languages' },
  { to: '/contributors',label: 'Contributors' },
  { to: '/health',      label: 'Repo Health' },
  { to: '/repos',       label: 'Top Repositories' },
  { to: '/commits',     label: 'Commit Activity' },
  { to: '/predictions', label: 'Predictions' },
  { href: '/architecture.html', label: 'Architecture' },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  // Close sidebar on nav in mobile
  useEffect(() => { onClose(); }, [location.pathname]);

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <h1>GitHub<br />Analytics</h1>
          <span>Developer Insights Platform</span>
        </div>
        <span className="sidebar-section-label">Dashboard</span>
        <ul className="sidebar-nav" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to || item.href}>
              {item.to ? (
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => isActive ? 'active' : ''}
                >
                  {item.label}
                </NavLink>
              ) : (
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="app-layout">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="main-content" id="main-content">
          <Routes>
            <Route path="/"             element={<Overview />} />
            <Route path="/languages"    element={<LanguageAnalytics />} />
            <Route path="/contributors" element={<TopContributors />} />
            <Route path="/health"       element={<RepositoryHealth />} />
            <Route path="/repos"        element={<TopRepositories />} />
            <Route path="/commits"      element={<CommitActivity />} />
            <Route path="/predictions"  element={<Predictions />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
