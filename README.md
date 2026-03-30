# Geometra Demo — AI Agent Dashboard

A real-time AI Agent monitoring dashboard built with [Geometra](https://github.com/razroo/geometra), a DOM-free frontend framework for the AI Agent era.

This demo proves Geometra works in production by rendering the **same reactive UI** across three completely different targets:

| Mode | Command | What it does |
|------|---------|--------------|
| **Canvas** (browser) | `npm run dev` | Full pipeline in the browser: signals → Yoga WASM layout → Canvas2D paint |
| **Terminal** (TUI) | `npm run terminal` | Same dashboard as ANSI art in your terminal |
| **Server → Client** | `npm run server` + `npm run dev:client` | Layout computed on the server, geometry streamed via WebSocket to a thin paint client |

## Why this matters for AI Agents

Traditional web apps require a full browser (DOM, CSS, compositor) to render UI. Geometra outputs **pure geometry** — `{ x, y, width, height }` — which means:

- **Agents can consume UI directly** — no headless browser needed
- **Server-streamed geometry** — layout computed once, painted anywhere
- **Terminal-native** — same app runs as a TUI for CLI-based agents
- **Minimal overhead** — Yoga WASM computes flexbox at near-native speed

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
```

## Architecture

```
src/
├── dashboard.ts    # Shared view layer — signals + box/text primitives
├── canvas.ts       # Entry: browser Canvas2D rendering
├── terminal.ts     # Entry: terminal ANSI rendering
├── server.ts       # Entry: server-side layout + WebSocket streaming
└── client.ts       # Entry: thin WebSocket client (paint only)
```

The key insight: `dashboard.ts` defines the UI once using Geometra's `box()` and `text()` primitives with reactive `signal()` state. Each entry point simply wires it to a different renderer. Zero code duplication across targets.

## Stack

- **@geometra/core** — Component model, signals, hit-testing
- **@geometra/renderer-canvas** — Canvas2D paint backend
- **@geometra/renderer-terminal** — ANSI/TUI paint backend
- **@geometra/server** — Server-side layout + WebSocket geometry streaming
- **@geometra/client** — Thin client that receives and paints pre-computed geometry
- **Vite** — Dev server and bundler
- **tsx** — TypeScript execution for Node.js entry points
