# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WireMock UI is a web dashboard for inspecting recorded HTTP requests and managing stub mappings across one or more running WireMock instances. It consists of an Express proxy server and a React/Vite frontend.

## Commands

```bash
# Install dependencies
npm install

# Development (runs both server and client concurrently)
npm run dev

# Run only the Express server (with hot reload via tsx)
npm run dev:server

# Run only the Vite dev server (frontend)
npm run dev:client

# Production build (Vite client build + tsc for server)
npm run build

# Run the production server
npm start
```

There is no test runner configured.

## Architecture

The project has two distinct parts:

### Server (`src/server/index.ts`)
A single-file Express server that:
- Reads `WIREMOCK_URLS` from `.env` (comma-separated URLs) and exposes them as named instances
- Proxies requests to WireMock's `/__admin/requests` and `/__admin/mappings` endpoints to avoid CORS issues
- In production (`NODE_ENV=production`), serves the Vite-built client from `dist/client/`
- Runs on port `3001` by default (configurable via `PORT` env var)

**API routes:**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/instances` | List configured WireMock instances |
| GET | `/api/requests` | Fetch recorded requests (`?instanceId=&limit=`; `?all=true` bypasses limit) |
| GET | `/api/mappings` | List stub mappings for an instance |
| POST | `/api/mappings` | Create a new stub mapping |
| PUT | `/api/mappings/:id` | Update an existing mapping |
| DELETE | `/api/mappings/:id` | Delete a mapping |

### Client (`src/client/`)
A React app (no routing) with two tab-based views — **Requests** and **Mappings**:
- `App.tsx` — root component; fetches instances, manages theme (dark/light), and switches between `'requests'` / `'mappings'` views via tab navigation (resets to requests on instance change)
- `components/InstanceSwitcher.tsx` — `<select>` to switch between WireMock instances
- `components/RequestsList.tsx` — polls `/api/requests?instanceId=&limit=` every 3 seconds (always on), renders a table with search/filter and limit selector; clicking a matched request's stub ID opens the MappingDrawer
- `components/RequestDrawer.tsx` — slide-out panel showing full request/response detail (headers, body, match status, stub ID); shows "Create Stub" button for unmatched requests via `onCreateStub` prop
- `components/MappingsList.tsx` — table of stub mappings with search, bulk select/delete, per-row delete with confirmation, and "New Mapping" button; fetches on mount (no polling)
- `components/MappingDrawer.tsx` — slide-out panel for a mapping's detail; supports inline response body editing (PUT), delete with confirmation, and optional back button (`onBack` prop) for cross-drawer navigation
- `components/NewMappingModal.tsx` — modal form for creating mappings (method, URL match type, URL value, body patterns, status, response templating toggle, body, response headers, delay, priority — all flat, no collapsible sections). Accepts optional `initialData?: InitialMappingData` prop to pre-fill fields (used for "Create Stub from Request" flow and default headers)
- `types.ts` — shared TypeScript interfaces (`WireMockInstance`, `WireMockRequest`, `RequestsResponse`, `WireMockMapping`, `MappingsResponse`, `InitialMappingData`)
- `styles/` — plain CSS files (no CSS-in-JS or utility framework)

### Dev proxy
During development, Vite proxies `/api/*` requests to `http://localhost:3001`, so the client always talks to a local URL regardless of environment.

### Build output
`npm run build` produces:
- `dist/client/` — Vite-compiled frontend assets
- `dist/server/` — tsc-compiled server (entry: `dist/server/index.js`)

## Configuration

Copy `.env.example` to `.env` and set `WIREMOCK_URLS` to a comma-separated list of WireMock base URLs:

```
WIREMOCK_URLS=http://localhost:8080,http://localhost:8081
```

The server derives each instance's `label` from `new URL(url).host`, so labels are automatically the `host:port` of each URL.

## WireMock API Notes

- `/__admin/requests?limit=N` — caps results (UI sends `limit` param; valid values: 20, 50, 100, 200). Pass `?all=true` on the proxy to omit the limit and fetch everything
- `loggedDate` is nested at `request.loggedDate` (milliseconds epoch), **not** at the root of the request object
- Server validates `limit` against an allowlist before forwarding to WireMock
- `/__admin/mappings` — CRUD for stub mappings; the proxy forwards POST/PUT/DELETE with JSON body as-is
- Mapping request matchers use one of `url`, `urlPath`, `urlPattern`, or `urlPathPattern` (mutually exclusive)
- `/__admin/requests` response: each request entry has `stubMapping` as an **object** (`{ id, name, ... }`), not a flat `stubMappingId` string
- `/__admin/mappings/import` returns **200 with empty body** on success — use `response.text()` and only `JSON.parse` if non-empty; calling `response.json()` directly throws "Unexpected end of JSON input"

## Design System

- **Fonts:** `Syne` (header/brand, weight 800), `DM Sans` (UI body), `JetBrains Mono` (URLs, status codes, counts, timestamps) — loaded from Google Fonts in `index.html`
- **CSS variables:** Defined in `App.css` `:root` (dark, default) and overridden in `[data-theme="light"]`. All component styles use variables — no hardcoded colors except URL-encoded SVGs (see below)
- **Theme toggle:** `data-theme` attribute on `document.documentElement`; initialised synchronously inside the `useState` callback to prevent flash; persisted to `localStorage`
- **URL-encoded SVG gotcha:** CSS variables cannot be used inside `url("data:image/svg+xml,...")`. Any SVG icon with a color that needs to change between themes requires a separate `[data-theme="light"] .selector` override with a re-encoded SVG
- **Accent button text color:** Dark theme accent (`#22d3ee`, bright cyan) needs `color: #000`; light theme accent (`#0891b2`, dark teal) needs `color: #fff`. Always add a `[data-theme="light"]` override when creating accent-colored buttons
- **`--text-dim` is near-invisible in dark theme:** `--text-dim` (`#253344`) is extremely dark on dark backgrounds. Use `--text-muted` (`#4a6070`) for secondary/hint text that needs to remain readable
- **Flex-basis in column layouts:** `.modal-input-short` uses `flex: 0 0 90px` which controls width in row flex but becomes height in column flex. Override with `flex: none` inside `.modal-field-column`
- **Textarea single-line height:** To match a `<textarea>` height to a regular `<input>`, use `rows={1}` and omit `min-height` from CSS — the browser's natural row height aligns with input padding
- **Reusable list-of-rows UI:** `btn-add-header`, `btn-remove-header`, and `header-row` CSS classes are generic — reuse them for any repeatable field row (e.g. body patterns), not just response headers
- **Toolbar buttons:** use `padding: 4px 11px`, `border-radius: 5px`, `font-size: 0.75rem`, `font-family: 'DM Sans'` — matching `.btn-refresh`. Avoid rem-based padding or buttons render taller than siblings
- **Success banner:** `.success-banner` class exists in `App.css` (green, mirrors `.error-banner`) — reuse it for post-action confirmations

## React Patterns

- **Stable callback with mutable dependency:** When a `useCallback` should not re-create on every state change (to avoid triggering unrelated effects), store the mutable value in a `useRef` and read `ref.current` inside the callback. E.g. `limitRef` in `RequestsList.tsx` keeps `fetchRequests` stable while still using the current `limit` value
- **Cross-drawer navigation:** When navigating from one drawer to another (e.g. request → mapping via stub ID click), store the previous selection in a `useRef` so the back button can restore it without re-render churn
