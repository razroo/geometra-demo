/**
 * Mode 1: Local Canvas Rendering (full viewport)
 *
 * The full Geometra pipeline runs in the browser:
 *   dashboardView() → Yoga WASM layout → Canvas2D paint
 */
import { createApp, batch } from '@geometra/core';
import { CanvasRenderer } from '@geometra/renderer-canvas';
import { dashboardView, startSimulation, viewportWidth, viewportHeight } from './dashboard.js';

const canvas = document.getElementById('app') as HTMLCanvasElement;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  batch(() => {
    viewportWidth.set(w);
    viewportHeight.set(h);
  });
}

resize();

const renderer = new CanvasRenderer({
  canvas,
  background: '#0f172a',
});

const app = await createApp(dashboardView, renderer, {
  width: window.innerWidth,
  height: window.innerHeight,
});

const stop = startSimulation();

window.addEventListener('resize', () => {
  resize();
  app.update();
});

window.addEventListener('beforeunload', () => {
  stop();
  app.destroy();
});
