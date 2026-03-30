/**
 * Mode 3 (Client Side): Thin paint client
 *
 * Connects to the Geometra server via WebSocket, receives
 * pre-computed geometry, and paints with Canvas2D.
 * No layout engine runs on the client.
 */
import { CanvasRenderer } from '@geometra/renderer-canvas';
import { createClient } from '@geometra/client';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const w = window.innerWidth;
const h = window.innerHeight;
canvas.width = w * devicePixelRatio;
canvas.height = h * devicePixelRatio;
canvas.style.width = `${w}px`;
canvas.style.height = `${h}px`;

const renderer = new CanvasRenderer({
  canvas,
  background: '#0f172a',
});

const client = createClient({
  url: 'ws://localhost:3100',
  renderer,
  canvas,
});

window.addEventListener('beforeunload', () => {
  client.close();
  renderer.destroy();
});
