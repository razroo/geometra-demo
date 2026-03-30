/**
 * Agent Demo — browser entry point.
 *
 * Split-screen: interactive dashboard on canvas (left)
 * + agent simulation log (right).
 */
import { createApp, batch } from '@geometra/core';
import { CanvasRenderer } from '@geometra/renderer-canvas';
import {
  interactiveDashboardView,
  startSimulation,
  viewportWidth,
  viewportHeight,
} from './dashboard-interactive.js';
import { AgentSimulator } from './agent-simulation.js';
import type { LogEntry } from './agent-simulation.js';

// ── Canvas setup ─────────────────────────────────────────────────────
const canvas = document.getElementById('app') as HTMLCanvasElement;
const logEl = document.getElementById('log') as HTMLDivElement;
const cycleEl = document.getElementById('cycle-counter') as HTMLSpanElement;

function resizeCanvas() {
  const panel = canvas.parentElement!;
  const w = panel.clientWidth;
  const h = panel.clientHeight;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  batch(() => {
    viewportWidth.set(w);
    viewportHeight.set(h);
  });
}

resizeCanvas();

const renderer = new CanvasRenderer({
  canvas,
  background: '#0f172a',
});

const app = await createApp(interactiveDashboardView, renderer, {
  width: canvas.parentElement!.clientWidth,
  height: canvas.parentElement!.clientHeight,
});

const stopSim = startSimulation();

window.addEventListener('resize', () => {
  resizeCanvas();
  app.update();
});

// ── Agent simulation ─────────────────────────────────────────────────
const agent = new AgentSimulator(app);
let cycleCount = 0;

agent.onLog = (entry: LogEntry) => {
  // Track cycles
  if (entry.phase === 'read' && entry.message.includes('Cycle')) {
    cycleCount++;
    cycleEl.textContent = `Cycle ${cycleCount}`;
  }

  const el = document.createElement('div');
  el.className = `log-entry ${entry.phase}`;

  let html = `<span class="phase-tag ${entry.phase}">${entry.phase}</span>`;
  html += `<span class="log-msg">${escapeHtml(entry.message)}</span>`;
  if (entry.detail) {
    html += `<div class="log-detail">${escapeHtml(entry.detail)}</div>`;
  }
  el.innerHTML = html;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;

  // Keep log manageable
  while (logEl.children.length > 200) {
    logEl.removeChild(logEl.firstChild!);
  }
};

agent.start();

// ── Cleanup ──────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  agent.stop();
  stopSim();
  app.destroy();
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
