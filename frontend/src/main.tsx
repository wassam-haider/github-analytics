import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defaults } from 'chart.js'
import './index.css'
import App from './App.tsx'

// Set Chart.js global defaults for paper card aesthetics
defaults.backgroundColor = 'rgba(0,0,0,0)'; // transparent canvas
if (defaults.plugins?.legend?.labels) {
  defaults.plugins.legend.labels.color = '#3A332A'; // ink-charcoal legend text
}
// Scale/gridline defaults
if ((defaults as any).scale?.grid) {
  (defaults as any).scale.grid.color = 'rgba(58, 51, 42, 0.08)'; // faint pencil gridlines
}
if ((defaults as any).scale?.ticks) {
  (defaults as any).scale.ticks.color = '#7A6E63'; // muted axis labels
}
// Tooltip styling
if (defaults.plugins?.tooltip) {
  defaults.plugins.tooltip.backgroundColor = '#F5EDD8';
  defaults.plugins.tooltip.titleColor = '#3A332A';
  defaults.plugins.tooltip.bodyColor = '#6B5E52';
  defaults.plugins.tooltip.borderColor = 'rgba(58, 51, 42, 0.15)';
  defaults.plugins.tooltip.borderWidth = 1;
  defaults.plugins.tooltip.padding = 10;
  defaults.plugins.tooltip.cornerRadius = 6;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

