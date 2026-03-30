/**
 * Mode 3: Server-Computed Layout with WebSocket Streaming
 *
 * Layout is computed on the server (Node.js/Bun, no browser needed).
 * Geometry is streamed to thin clients over WebSocket.
 * Run with: npm run server
 */
import { createServer } from '@geometra/server';
import { dashboardView, startSimulation } from './dashboard.js';

const server = await createServer(dashboardView, {
  port: 3100,
  width: 900,
  height: 700,
});

const stop = startSimulation();

// The server pushes new frames whenever signals change.
// We also call server.update() periodically to ensure patches are sent.
const pushInterval = setInterval(() => {
  server.update();
}, 1500);

console.log('Geometra server listening on ws://localhost:3100');
console.log('Open client.html in a browser to see streamed geometry.');

process.on('SIGINT', () => {
  clearInterval(pushInterval);
  stop();
  server.close();
  process.exit(0);
});
