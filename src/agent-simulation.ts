/**
 * Agent Simulation — Read → Think → Act → Observe loop.
 *
 * Works both in-browser (reading app.layout/tree directly) and
 * conceptually maps to the REST API for real agent usage.
 */
import type { UIElement } from '@geometra/core';
import type { ComputedLayout } from 'textura';
import type { App } from '@geometra/core';
import {
  taskQueue, agents, metrics,
  getActionForStatus,
  handleTaskAction,
} from './dashboard-interactive.js';

// ── Types ────────────────────────────────────────────────────────────
export type Phase = 'read' | 'think' | 'act' | 'observe';

export interface LogEntry {
  phase: Phase;
  message: string;
  detail?: string;
  timestamp: number;
}

export interface ActionTarget {
  id: string;
  taskId: string;
  label: string;
  taskDescription: string;
  taskStatus: string;
  bounds: { x: number; y: number; width: number; height: number };
}

// ── Geometry introspection ───────────────────────────────────────────
function collectActions(tree: UIElement, layout: ComputedLayout, path: number[] = []): ActionTarget[] {
  const results: ActionTarget[] = [];

  if (tree.kind === 'box') {
    // Check if this box has an onClick handler and a key matching action pattern
    const key = tree.key || '';
    if (tree.handlers?.onClick && key.startsWith('action-')) {
      // Extract task ID and action from key: "action-T-1028-retry"
      const parts = key.replace('action-', '').split('-');
      const actionLabel = parts.pop() || '';
      const taskId = parts.join('-');
      const textChild = tree.children.find(c => c.kind === 'text');
      const label = textChild?.kind === 'text' ? textChild.props.text : actionLabel;

      // Find task info
      const task = taskQueue.peek().find(t => t.id === taskId);

      results.push({
        id: key,
        taskId,
        label,
        taskDescription: task?.description || '',
        taskStatus: task?.status || '',
        bounds: {
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
        },
      });
    }

    // Recurse into children
    tree.children.forEach((child, i) => {
      if (layout.children && layout.children[i]) {
        results.push(...collectActions(child, layout.children[i], [...path, i]));
      }
    });
  }

  return results;
}

function buildStateSnapshot(app: App) {
  const tasks = taskQueue.peek();
  const agentList = agents.peek();
  const m = metrics.peek();
  const actions = (app.layout && app.tree)
    ? collectActions(app.tree, app.layout)
    : [];

  return {
    metrics: {
      totalTasks: m.totalTasks,
      successRate: m.successRate.toFixed(1) + '%',
      avgDuration: m.avgDuration,
      activeAgents: m.activeAgents,
    },
    agents: agentList.map(a => ({
      name: a.name,
      status: a.status,
      tasksCompleted: a.tasksCompleted,
    })),
    tasks: tasks.map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      model: t.model,
      availableAction: getActionForStatus(t.status),
    })),
    actions,
  };
}

// ── Agent decision engine ────────────────────────────────────────────
function pickAction(actions: ActionTarget[]): ActionTarget | null {
  // Priority: retry errors first, then start idle tasks
  const retries = actions.filter(a => a.label === 'Retry');
  if (retries.length > 0) return retries[0];

  const starts = actions.filter(a => a.label === 'Start');
  if (starts.length > 0) return starts[0];

  const cancels = actions.filter(a => a.label === 'Cancel');
  if (cancels.length > 0) return cancels[0];

  return null;
}

// ── Simulation loop ──────────────────────────────────────────────────
export class AgentSimulator {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cycleCount = 0;
  public onLog: (entry: LogEntry) => void = () => {};

  constructor(private app: App) {}

  private log(phase: Phase, message: string, detail?: string) {
    this.onLog({ phase, message, detail, timestamp: Date.now() });
  }

  start() {
    this.running = true;
    this.runCycle();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private async runCycle() {
    if (!this.running) return;
    this.cycleCount++;

    // ── READ ──
    this.log('read', `Cycle ${this.cycleCount}: Reading UI geometry...`);
    await this.delay(800);

    const state = buildStateSnapshot(this.app);
    this.log('read', `GET /api/state → ${state.tasks.length} tasks, ${state.agents.length} agents, ${state.actions.length} available actions`);
    await this.delay(600);

    const stateJson = JSON.stringify({
      metrics: state.metrics,
      tasks: state.tasks.map(t => ({ id: t.id, status: t.status, action: t.availableAction })),
    }, null, 2);
    this.log('read', 'Response payload:', stateJson);
    await this.delay(1000);

    // ── THINK ──
    const errorTasks = state.tasks.filter(t => t.status === 'error');
    const idleTasks = state.tasks.filter(t => t.status === 'idle');
    const runningTasks = state.tasks.filter(t => t.status === 'running');

    this.log('think', `Analyzing: ${errorTasks.length} errors, ${idleTasks.length} idle, ${runningTasks.length} running`);
    await this.delay(800);

    const chosen = pickAction(state.actions);

    if (!chosen) {
      this.log('think', 'No actionable tasks found. Waiting for next cycle.');
      await this.delay(1000);
      this.scheduleNext();
      return;
    }

    if (chosen.label === 'Retry') {
      this.log('think', `Task ${chosen.taskId} is in ERROR state → should retry`);
    } else if (chosen.label === 'Start') {
      this.log('think', `Task ${chosen.taskId} is IDLE → can be started`);
    } else {
      this.log('think', `Task ${chosen.taskId} is RUNNING → can cancel if needed`);
    }
    this.log('think', `Decision: ${chosen.label} "${chosen.taskDescription}"`);
    await this.delay(1000);

    // ── ACT ──
    this.log('act', `POST /api/action → { id: "${chosen.id}" }`);
    await this.delay(600);

    // Actually dispatch the action
    handleTaskAction(chosen.taskId, chosen.label);
    this.app.update();

    this.log('act', `Dispatched ${chosen.label} on ${chosen.taskId} at bounds (${Math.round(chosen.bounds.x)}, ${Math.round(chosen.bounds.y)})`);
    await this.delay(800);

    // ── OBSERVE ──
    const afterState = buildStateSnapshot(this.app);
    const updatedTask = afterState.tasks.find(t => t.id === chosen.taskId);

    this.log('observe', `Task ${chosen.taskId} is now ${updatedTask?.status?.toUpperCase() || 'unknown'}`);
    this.log('observe', `Success rate: ${afterState.metrics.successRate}`);
    await this.delay(600);

    this.log('observe', 'Cycle complete. Scheduling next in 3s...');
    this.scheduleNext();
  }

  private scheduleNext() {
    this.timer = setTimeout(() => this.runCycle(), 3000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => { this.timer = setTimeout(resolve, ms); });
  }
}
