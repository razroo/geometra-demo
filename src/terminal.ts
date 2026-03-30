/**
 * Mode 2: Terminal / TUI Rendering
 *
 * The same dashboard rendered as ANSI art in the terminal.
 * Run with: npm run terminal
 */
import { createApp } from '@geometra/core';
import { TerminalRenderer } from '@geometra/renderer-terminal';
import { dashboardView, startSimulation } from './dashboard.js';

const cols = process.stdout.columns || 120;
const rows = process.stdout.rows || 40;

const renderer = new TerminalRenderer({ width: cols, height: rows });

const app = await createApp(dashboardView, renderer, {
  width: 900,
  height: 700,
});

const stop = startSimulation();

// Handle graceful exit
process.on('SIGINT', () => {
  stop();
  app.destroy();
  renderer.destroy();
  process.exit(0);
});

console.clear();
