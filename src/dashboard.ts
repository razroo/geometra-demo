/**
 * AI Agent Task Dashboard — shared view layer
 *
 * Renders a real-time dashboard showing AI agents executing tasks.
 * Uses Geometra's signals for live reactivity and box/text primitives
 * for a renderer-agnostic UI that works on Canvas, Terminal, and
 * streamed over WebSocket.
 */
import { signal, batch, box, text } from '@geometra/core';
import type { UIElement, Signal } from '@geometra/core';

// ── Theme ────────────────────────────────────────────────────────────
export const theme = {
  bg:        '#0f172a',
  surface:   '#1e293b',
  card:      '#334155',
  accent:    '#3b82f6',
  success:   '#22c55e',
  warning:   '#f59e0b',
  error:     '#ef4444',
  text:      '#f8fafc',
  muted:     '#94a3b8',
  font:      '14px Inter, system-ui, sans-serif',
  fontSm:    '12px Inter, system-ui, sans-serif',
  fontLg:    '18px Inter, system-ui, sans-serif',
  fontXl:    '24px Inter, system-ui, sans-serif',
};

// ── Domain types ─────────────────────────────────────────────────────
export type AgentStatus = 'idle' | 'running' | 'success' | 'error';

export interface AgentTask {
  id: string;
  description: string;
  status: AgentStatus;
  duration: string;
  model: string;
}

export interface AgentInfo {
  name: string;
  status: AgentStatus;
  tasksCompleted: number;
  currentTask: string;
  uptime: string;
}

// ── Reactive state ───────────────────────────────────────────────────
export const agents: Signal<AgentInfo[]> = signal<AgentInfo[]>([
  { name: 'Code Review Agent',    status: 'running', tasksCompleted: 47, currentTask: 'PR #312 — auth middleware',  uptime: '4h 23m' },
  { name: 'Test Gen Agent',       status: 'running', tasksCompleted: 31, currentTask: 'Generate e2e for /api/v2',  uptime: '2h 11m' },
  { name: 'Deploy Agent',         status: 'idle',    tasksCompleted: 12, currentTask: '—',                         uptime: '6h 05m' },
  { name: 'Monitoring Agent',     status: 'success', tasksCompleted: 89, currentTask: 'Dashboard health check',    uptime: '12h 30m' },
]);

export const taskQueue: Signal<AgentTask[]> = signal<AgentTask[]>([
  { id: 'T-1024', description: 'Refactor payment module',       status: 'running', duration: '3m 12s', model: 'Claude Opus 4' },
  { id: 'T-1025', description: 'Fix CORS headers on /api/auth', status: 'success', duration: '1m 44s', model: 'Claude Sonnet 4' },
  { id: 'T-1026', description: 'Add rate limiting middleware',   status: 'running', duration: '2m 08s', model: 'Claude Opus 4' },
  { id: 'T-1027', description: 'Update OpenAPI spec',           status: 'idle',    duration: '—',      model: 'Claude Haiku 3.5' },
  { id: 'T-1028', description: 'Migrate DB to Postgres 17',     status: 'error',   duration: '5m 33s', model: 'Claude Opus 4' },
  { id: 'T-1029', description: 'Write integration tests',       status: 'idle',    duration: '—',      model: 'Claude Sonnet 4' },
]);

export const metrics = signal({
  totalTasks:   179,
  successRate:  94.2,
  avgDuration:  '2m 18s',
  activeAgents: 2,
});

const clockTick = signal(0);

// ── Simulation: update signals every second ──────────────────────────
const statusCycle: AgentStatus[] = ['idle', 'running', 'running', 'success', 'error', 'running'];

export function startSimulation(): () => void {
  const handle = setInterval(() => {
    batch(() => {
      clockTick.set(clockTick.peek() + 1);
      const tick = clockTick.peek();

      // Rotate agent statuses
      const agentsCopy = agents.peek().map((a, i) => ({
        ...a,
        status: statusCycle[(tick + i) % statusCycle.length],
        tasksCompleted: a.tasksCompleted + (tick % 3 === 0 ? 1 : 0),
      }));
      agents.set(agentsCopy);

      // Cycle task statuses
      const tasksCopy = taskQueue.peek().map((t, i) => ({
        ...t,
        status: statusCycle[(tick + i + 2) % statusCycle.length],
      }));
      taskQueue.set(tasksCopy);

      // Update metrics
      const m = metrics.peek();
      metrics.set({
        ...m,
        totalTasks: m.totalTasks + (tick % 4 === 0 ? 1 : 0),
        successRate: 90 + Math.sin(tick * 0.1) * 4,
        activeAgents: agentsCopy.filter(a => a.status === 'running').length,
      });
    });
  }, 1500);

  return () => clearInterval(handle);
}

// ── UI Helpers ───────────────────────────────────────────────────────
export function statusColor(s: AgentStatus): string {
  return s === 'running' ? theme.accent
       : s === 'success' ? theme.success
       : s === 'error'   ? theme.error
       : theme.muted;
}

export function statusLabel(s: AgentStatus): string {
  return s === 'running' ? 'RUNNING'
       : s === 'success' ? 'DONE'
       : s === 'error'   ? 'ERROR'
       : 'IDLE';
}

// ── Component: Metric Card ───────────────────────────────────────────
function metricCard(label: string, value: string): UIElement {
  return box({
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 16,
    gap: 8,
    flexDirection: 'column',
    height: 80,
  }, [
    text({ text: label, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    text({ text: value, font: theme.fontXl, lineHeight: 32, color: theme.text }),
  ]);
}

// ── Component: Agent Card ────────────────────────────────────────────
function agentCard(agent: AgentInfo): UIElement {
  return box({
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    flexDirection: 'column',
  }, [
    // Top row: dot + name + status
    box({ flexDirection: 'row', alignItems: 'center', gap: 8 }, [
      box({
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: statusColor(agent.status),
      }, []),
      text({ text: agent.name, font: theme.font, lineHeight: 18, color: theme.text }),
    ]),
    // Current task
    text({ text: agent.currentTask, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    // Bottom stats
    box({ flexDirection: 'row', gap: 16 }, [
      text({ text: `${agent.tasksCompleted} tasks`, font: theme.fontSm, lineHeight: 16, color: theme.text }),
      text({ text: agent.uptime, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    ]),
  ]);
}

// ── Component: Task Row ──────────────────────────────────────────────
function taskRow(task: AgentTask): UIElement {
  return box({
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 6,
    height: 40,
  }, [
    // Status badge — fixed width so they all align
    box({
      width: 76,
      backgroundColor: statusColor(task.status),
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      alignItems: 'center',
    }, [
      text({ text: statusLabel(task.status), font: theme.fontSm, lineHeight: 16, color: '#ffffff' }),
    ]),
    // Task ID — fixed width
    box({ width: 56 }, [
      text({ text: task.id, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    ]),
    // Description — takes remaining space
    box({ flexGrow: 1, flexShrink: 1 }, [
      text({ text: task.description, font: theme.font, lineHeight: 18, color: theme.text }),
    ]),
    // Model — fixed width
    box({ width: 120, alignItems: 'flex-end' }, [
      text({ text: task.model, font: theme.fontSm, lineHeight: 16, color: theme.accent }),
    ]),
    // Duration — fixed width
    box({ width: 60, alignItems: 'flex-end' }, [
      text({ text: task.duration, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    ]),
  ]);
}

// ── Viewport size (reactive) ─────────────────────────────────────────
export const viewportWidth = signal(1100);
export const viewportHeight = signal(820);

// ── Root View ────────────────────────────────────────────────────────
export function dashboardView(): UIElement {
  const m = metrics.value;
  const agentList = agents.value;
  const tasks = taskQueue.value;
  const w = viewportWidth.value;
  const h = viewportHeight.value;

  return box({
    flexDirection: 'column',
    padding: 28,
    gap: 20,
    backgroundColor: theme.bg,
    width: w,
    height: h,
  }, [
    // ── Header ──
    box({ flexDirection: 'row', alignItems: 'center', gap: 12 }, [
      text({ text: 'AI Agent Dashboard', font: 'bold 22px Inter, system-ui, sans-serif', lineHeight: 28, color: theme.text }),
      box({ flexGrow: 1 }, []),
      box({
        backgroundColor: theme.success,
        borderRadius: 4,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
      }, [
        text({ text: 'LIVE', font: theme.fontSm, lineHeight: 16, color: '#ffffff' }),
      ]),
    ]),

    // ── Metric Cards ──
    box({ flexDirection: 'row', gap: 14 }, [
      metricCard('Total Tasks',    String(m.totalTasks)),
      metricCard('Success Rate',   `${m.successRate.toFixed(1)}%`),
      metricCard('Avg Duration',   m.avgDuration),
      metricCard('Active Agents',  String(m.activeAgents)),
    ]),

    // ── Agents — horizontal cards ──
    text({ text: 'Agents', font: theme.fontLg, lineHeight: 22, color: theme.text }),
    box({ flexDirection: 'row', gap: 12 }, [
      ...agentList.map(agentCard),
    ]),

    // ── Task Queue — full width rows ──
    text({ text: 'Task Queue', font: theme.fontLg, lineHeight: 22, color: theme.text }),
    box({ flexDirection: 'column', gap: 6, flexGrow: 1 }, [
      ...tasks.map(taskRow),
    ]),

    // ── Footer ──
    box({ flexDirection: 'row', justifyContent: 'center', paddingTop: 8 }, [
      text({
        text: 'Powered by Geometra — DOM-free rendering for the AI Agent era',
        font: theme.fontSm,
        lineHeight: 16,
        color: theme.muted,
      }),
    ]),
  ]);
}
