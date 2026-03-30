/**
 * Mode 4: Agent Interaction Server
 *
 * HTTP REST API exposing raw geometry + actions for AI agents.
 * No browser needed — agents consume structured JSON directly.
 *
 * Run with: npm run agent-server
 *
 * Endpoints:
 *   GET  /api/state    Full layout + tree + actions index
 *   GET  /api/actions  Just available actions
 *   POST /api/action   Execute an action by id or coordinates
 */
import { createServer as createHttpServer } from 'node:http';
import { createApp } from '@geometra/core';
import type { Renderer, UIElement } from '@geometra/core';
import type { ComputedLayout } from 'textura';
import {
  interactiveDashboardView,
  startSimulation,
  taskQueue, agents, metrics,
  handleTaskAction, getActionForStatus,
} from './dashboard-interactive.js';

// ── Null renderer (no painting, just layout) ─────────────────────────
const nullRenderer: Renderer = {
  render() {},
  destroy() {},
};

// ── Initialize Geometra app headlessly ───────────────────────────────
const app = await createApp(interactiveDashboardView, nullRenderer, {
  width: 900,
  height: 700,
});

const stopSim = startSimulation();

// ── Tree serialization (strips functions) ────────────────────────────
function serializeTree(tree: UIElement): unknown {
  if (tree.kind === 'text') {
    return { kind: 'text', props: tree.props, key: tree.key };
  }
  return {
    kind: 'box',
    key: tree.key,
    props: tree.props,
    hasClickHandler: !!tree.handlers?.onClick,
    children: tree.children.map(serializeTree),
  };
}

function serializeLayout(layout: ComputedLayout): unknown {
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    children: layout.children?.map(serializeLayout) || [],
  };
}

// ── Collect actionable elements ──────────────────────────────────────
interface ActionInfo {
  id: string;
  taskId: string;
  label: string;
  taskDescription: string;
  taskStatus: string;
  bounds: { x: number; y: number; width: number; height: number };
}

function collectActions(tree: UIElement, layout: ComputedLayout): ActionInfo[] {
  const results: ActionInfo[] = [];

  function walk(t: UIElement, l: ComputedLayout) {
    if (t.kind === 'box') {
      const key = t.key || '';
      if (t.handlers?.onClick && key.startsWith('action-')) {
        const parts = key.replace('action-', '').split('-');
        const actionLabel = parts.pop() || '';
        const taskId = parts.join('-');
        const textChild = t.children.find(c => c.kind === 'text');
        const label = textChild?.kind === 'text' ? textChild.props.text : actionLabel;
        const task = taskQueue.peek().find(tk => tk.id === taskId);

        results.push({
          id: key,
          taskId,
          label,
          taskDescription: task?.description || '',
          taskStatus: task?.status || '',
          bounds: { x: l.x, y: l.y, width: l.width, height: l.height },
        });
      }
      t.children.forEach((child, i) => {
        if (l.children?.[i]) walk(child, l.children[i]);
      });
    }
  }

  walk(tree, layout);
  return results;
}

function buildFullState() {
  app.update();
  const m = metrics.peek();
  const actions = (app.layout && app.tree) ? collectActions(app.tree, app.layout) : [];

  return {
    timestamp: new Date().toISOString(),
    viewport: { width: 900, height: 700 },
    metrics: {
      totalTasks: m.totalTasks,
      successRate: +m.successRate.toFixed(1),
      avgDuration: m.avgDuration,
      activeAgents: m.activeAgents,
    },
    agents: agents.peek().map(a => ({
      name: a.name,
      status: a.status,
      tasksCompleted: a.tasksCompleted,
      currentTask: a.currentTask,
    })),
    tasks: taskQueue.peek().map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      model: t.model,
      duration: t.duration,
      availableAction: getActionForStatus(t.status),
    })),
    actions,
    layout: app.layout ? serializeLayout(app.layout) : null,
    tree: app.tree ? serializeTree(app.tree) : null,
  };
}

// ── HTTP Server ──────────────────────────────────────────────────────
const PORT = 3101;

const server = createHttpServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const state = buildFullState();
    res.writeHead(200);
    res.end(JSON.stringify(state, null, 2));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/actions') {
    app.update();
    const actions = (app.layout && app.tree) ? collectActions(app.tree, app.layout) : [];
    res.writeHead(200);
    res.end(JSON.stringify({ actions }, null, 2));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        if (payload.id) {
          // Find action by ID
          app.update();
          const actions = (app.layout && app.tree) ? collectActions(app.tree, app.layout) : [];
          const target = actions.find(a => a.id === payload.id);
          if (!target) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: `Action "${payload.id}" not found` }));
            return;
          }
          handleTaskAction(target.taskId, target.label);
          app.update();
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            action: target.label,
            taskId: target.taskId,
            stateAfter: buildFullState(),
          }, null, 2));
          return;
        }

        if (payload.x != null && payload.y != null) {
          const dispatched = app.dispatch(
            payload.eventType || 'onClick',
            payload.x,
            payload.y,
          );
          app.update();
          res.writeHead(200);
          res.end(JSON.stringify({
            success: dispatched,
            stateAfter: buildFullState(),
          }, null, 2));
          return;
        }

        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Provide "id" or "x"/"y" in body' }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\nGeometra Agent API running on http://localhost:${PORT}\n`);
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/state    Full geometry + state`);
  console.log(`  GET  http://localhost:${PORT}/api/actions  Available actions`);
  console.log(`  POST http://localhost:${PORT}/api/action   Execute an action\n`);
  console.log('Example:');
  console.log(`  curl http://localhost:${PORT}/api/state | jq '.tasks'`);
  console.log(`  curl -X POST http://localhost:${PORT}/api/action -H 'Content-Type: application/json' -d '{"id":"action-T-1028-retry"}'\n`);
});

process.on('SIGINT', () => {
  stopSim();
  app.destroy();
  server.close();
  process.exit(0);
});
