# Geometra Demo — AI Agent Dashboard

A real-time AI Agent monitoring dashboard built with [Geometra](https://github.com/razroo/geometra), a DOM-free frontend framework for the AI Agent era.

This demo proves Geometra works in production by rendering the **same reactive UI** across three completely different targets — and letting AI agents interact with it directly via structured geometry, no browser required.

| Mode | Command | What it does |
|------|---------|--------------|
| **Canvas** (browser) | `npm run dev` | Full pipeline in the browser: signals → Yoga WASM layout → Canvas2D paint |
| **Terminal** (TUI) | `npm run terminal` | Same dashboard as ANSI art in your terminal |
| **Server → Client** | `npm run server` + `npm run dev:client` | Layout computed on the server, geometry streamed via WebSocket to a thin paint client |
| **Agent API** | `npm run agent-server` | REST API exposing raw geometry + actions for AI agents |
| **Agent Demo** | `npm run dev` → agent-demo.html | Live visualization of an AI agent consuming geometry and taking actions |

## Agent Interaction — the key demo

The Agent API (`npm run agent-server`) exposes the dashboard's UI as structured JSON that any AI agent can consume directly:

```bash
# Get full UI state as geometry + actions
curl http://localhost:3101/api/state | jq '.tasks'

# See what actions are available
curl http://localhost:3101/api/actions

# Execute an action (retry a failed task)
curl -X POST http://localhost:3101/api/action \
  -H 'Content-Type: application/json' \
  -d '{"id": "action-T-1028-retry"}'
```

**Why this matters:** Traditional apps require a headless browser + vision model for an agent to "see" the UI. With Geometra, agents get structured `{ x, y, width, height }` geometry and a list of available actions — no browser, no screenshots, no OCR.

The [Agent Demo page](agent-demo.html) visualizes this in real-time: a split-screen showing the dashboard rendering on the left, and a simulated agent's Read → Think → Act → Observe loop on the right.

## Quick Start

```bash
npm install

# Mode 1: Browser Canvas rendering
npm run dev
# Open http://localhost:5173

# Mode 2: Terminal rendering
npm run terminal

# Mode 3: Server-streamed geometry
npm run server          # starts WebSocket server on :3100
npm run dev:client      # starts thin client on :5174
# Open http://localhost:5174/client.html

# Mode 4: Agent REST API
npm run agent-server
# curl http://localhost:3101/api/state
```

## Architecture

```
src/
├── dashboard.ts              # Base view layer — signals + box/text primitives
├── dashboard-interactive.ts  # Extended view with clickable action buttons
├── canvas.ts                 # Entry: browser Canvas2D rendering
├── terminal.ts               # Entry: terminal ANSI rendering
├── server.ts                 # Entry: server-side layout + WebSocket streaming
├── client.ts                 # Entry: thin WebSocket client (paint only)
├── agent-server.ts           # Entry: HTTP REST API for AI agents
├── agent-simulation.ts       # Agent loop: read/think/act/observe
└── agent-demo.ts             # Entry: browser agent interaction demo
```

## API Reference

### `GET /api/state`
Returns the full UI state: computed layout tree, element tree, metrics, and an `actions[]` index listing every clickable element with its label and bounding box.

### `GET /api/actions`
Returns just the available actions array — lightweight for agents that cache the full state.

### `POST /api/action`
Execute an action by ID or coordinates:
```json
{ "id": "action-T-1028-retry" }
// or
{ "x": 780, "y": 520, "eventType": "onClick" }
```

## Stack

- **@geometra/core** — Component model, signals, hit-testing
- **@geometra/renderer-canvas** — Canvas2D paint backend
- **@geometra/renderer-terminal** — ANSI/TUI paint backend
- **@geometra/server** — Server-side layout + WebSocket geometry streaming
- **@geometra/client** — Thin client that receives and paints pre-computed geometry
- **Vite** — Dev server and bundler
- **tsx** — TypeScript execution for Node.js entry points
