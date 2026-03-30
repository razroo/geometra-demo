/**
 * Interactive Dashboard — extends the base dashboard with clickable actions.
 *
 * Each task row gets a contextual action button (Retry / Start / Cancel)
 * that AI agents can discover and invoke via the geometry API.
 */
import { batch, box, text } from '@geometra/core';
import type { UIElement } from '@geometra/core';
import {
  theme, agents, taskQueue, metrics,
  viewportWidth, viewportHeight,
  statusColor, statusLabel,
  startSimulation,
  type AgentTask, type AgentInfo, type AgentStatus,
} from './dashboard.js';

// Re-export everything the entry points need
export {
  theme, agents, taskQueue, metrics,
  viewportWidth, viewportHeight,
  startSimulation,
  type AgentTask, type AgentInfo, type AgentStatus,
};

// ── Task actions ─────────────────────────────────────────────────────
export function handleTaskAction(taskId: string, action: string): void {
  batch(() => {
    const tasks = taskQueue.peek();
    taskQueue.set(tasks.map(t => {
      if (t.id !== taskId) return t;
      switch (action) {
        case 'Retry':  return { ...t, status: 'running' as const, duration: '0m 00s' };
        case 'Start':  return { ...t, status: 'running' as const, duration: '0m 00s' };
        case 'Cancel': return { ...t, status: 'idle' as const,    duration: '—' };
        default: return t;
      }
    }));

    // Update metrics
    const m = metrics.peek();
    const updated = taskQueue.peek();
    metrics.set({
      ...m,
      activeAgents: agents.peek().filter(a => a.status === 'running').length,
      successRate: Math.min(99.9, m.successRate + (action === 'Retry' ? 0.5 : 0)),
    });
  });
}

export function getActionForStatus(status: AgentStatus): string | null {
  return status === 'error'   ? 'Retry'
       : status === 'idle'    ? 'Start'
       : status === 'running' ? 'Cancel'
       : null;
}

// ── Component: Action Button ─────────────────────────────────────────
function actionButton(task: AgentTask): UIElement {
  const action = getActionForStatus(task.status);

  if (!action) {
    return box({ width: 68, height: 26 }, []);
  }

  const bg = action === 'Retry'  ? theme.warning
           : action === 'Start'  ? theme.success
           : theme.muted;

  return box({
    key: `action-${task.id}-${action.toLowerCase()}`,
    width: 68,
    height: 26,
    backgroundColor: bg,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    onClick: () => handleTaskAction(task.id, action),
  }, [
    text({ text: action, font: theme.fontSm, lineHeight: 16, color: '#ffffff' }),
  ]);
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
    box({ flexDirection: 'row', alignItems: 'center', gap: 8 }, [
      box({
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: statusColor(agent.status),
      }, []),
      text({ text: agent.name, font: theme.font, lineHeight: 18, color: theme.text }),
    ]),
    text({ text: agent.currentTask, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    box({ flexDirection: 'row', gap: 16 }, [
      text({ text: `${agent.tasksCompleted} tasks`, font: theme.fontSm, lineHeight: 16, color: theme.text }),
      text({ text: agent.uptime, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    ]),
  ]);
}

// ── Component: Interactive Task Row ──────────────────────────────────
function interactiveTaskRow(task: AgentTask): UIElement {
  return box({
    key: `task-${task.id}`,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 6,
    height: 40,
  }, [
    box({
      width: 76,
      backgroundColor: statusColor(task.status),
      borderRadius: 4,
      paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
      alignItems: 'center',
    }, [
      text({ text: statusLabel(task.status), font: theme.fontSm, lineHeight: 16, color: '#ffffff' }),
    ]),
    box({ width: 56 }, [
      text({ text: task.id, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    ]),
    box({ flexGrow: 1, flexShrink: 1 }, [
      text({ text: task.description, font: theme.font, lineHeight: 18, color: theme.text }),
    ]),
    box({ width: 120, alignItems: 'flex-end' }, [
      text({ text: task.model, font: theme.fontSm, lineHeight: 16, color: theme.accent }),
    ]),
    box({ width: 60, alignItems: 'flex-end' }, [
      text({ text: task.duration, font: theme.fontSm, lineHeight: 16, color: theme.muted }),
    ]),
    actionButton(task),
  ]);
}

// ── Root View (Interactive) ──────────────────────────────────────────
export function interactiveDashboardView(): UIElement {
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
    // Header
    box({ flexDirection: 'row', alignItems: 'center', gap: 12 }, [
      text({ text: 'AI Agent Dashboard', font: 'bold 22px Inter, system-ui, sans-serif', lineHeight: 28, color: theme.text }),
      box({ flexGrow: 1 }, []),
      box({
        backgroundColor: theme.accent,
        borderRadius: 4,
        paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
      }, [
        text({ text: 'AGENT MODE', font: theme.fontSm, lineHeight: 16, color: '#ffffff' }),
      ]),
      box({
        backgroundColor: theme.success,
        borderRadius: 4,
        paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
      }, [
        text({ text: 'LIVE', font: theme.fontSm, lineHeight: 16, color: '#ffffff' }),
      ]),
    ]),

    // Metrics
    box({ flexDirection: 'row', gap: 14 }, [
      metricCard('Total Tasks',    String(m.totalTasks)),
      metricCard('Success Rate',   `${m.successRate.toFixed(1)}%`),
      metricCard('Avg Duration',   m.avgDuration),
      metricCard('Active Agents',  String(m.activeAgents)),
    ]),

    // Agents
    text({ text: 'Agents', font: theme.fontLg, lineHeight: 22, color: theme.text }),
    box({ flexDirection: 'row', gap: 12 }, agentList.map(agentCard)),

    // Task Queue (with action buttons)
    text({ text: 'Task Queue', font: theme.fontLg, lineHeight: 22, color: theme.text }),
    box({ flexDirection: 'column', gap: 6, flexGrow: 1 }, tasks.map(interactiveTaskRow)),

    // Footer
    box({ flexDirection: 'row', justifyContent: 'center', paddingTop: 8 }, [
      text({
        text: 'Powered by Geometra — DOM-free rendering for the AI Agent era',
        font: theme.fontSm, lineHeight: 16, color: theme.muted,
      }),
    ]),
  ]);
}
