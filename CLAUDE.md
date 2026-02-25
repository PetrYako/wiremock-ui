# CLAUDE.md

## Project Overview

WireMock UI — a web dashboard for managing WireMock server instances. Lets you monitor recorded HTTP requests, create/edit/delete stub mappings, import/export mappings as JSON, clone mappings, and switch between multiple WireMock instances. Connects via WireMock's `/__admin/` REST API (requires CORS enabled).

## Tech Stack

- **React 18** with **TypeScript** (strict mode)
- **Vite** for dev server and builds
- **Plain CSS** with CSS custom properties for theming (dark/light)
- **Fetch API** for HTTP — no axios or other HTTP client
- No state management library — all local component state
- No router — tab-based navigation within a single page

## Project Structure

```
src/client/
├── main.tsx              # Entry point
├── App.tsx               # Root layout, theme toggle, tab navigation
├── types.ts              # Shared TypeScript interfaces
├── components/
│   ├── InstanceSwitcher.tsx   # Multi-instance dropdown
│   ├── RequestsList.tsx       # Requests table with polling + filtering
│   ├── RequestDrawer.tsx      # Request detail slide-out panel
│   ├── MappingsList.tsx       # Mappings table with bulk ops
│   ├── MappingDrawer.tsx      # Mapping detail slide-out panel
│   └── NewMappingModal.tsx    # Create/edit mapping form modal
└── styles/                    # One CSS file per component
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build to dist/
```

## Environment Variables

- `VITE_WIREMOCK_URLS` — comma-separated WireMock base URLs (required). See `.env.example`.

## Code Conventions

### Naming
- **Components/Types**: PascalCase (`RequestsList.tsx`, `WireMockRequest`)
- **Variables/Functions**: camelCase (`fetchRequests`, `selectedRequest`)
- **CSS classes**: kebab-case (`drawer-panel`, `badge-blue`)
- **Props interfaces**: named `Props`

### Imports (ordering)
1. React imports (`from 'react'`)
2. Type imports (`import type { ... }`)
3. Local component imports
4. CSS imports

### File Structure Pattern
1. Utility functions at top of file
2. Constants (colors, operators, limits)
3. `Props` interface
4. Default export functional component using hooks

### Component Patterns
- **Drawers**: Slide-out panels with backdrop, ESC to close, parent-controlled open state
- **Lists**: Auto-polling with `setInterval` in `useEffect`, client-side filtering, configurable limits
- **Modals**: `createPortal()` for rendering, supports create and edit modes via `initialData`/`editMapping` props
- **Bulk operations**: Checkbox select with "Select All" (indeterminate state), bulk delete with confirmation
- **Cross-drawer navigation**: Request drawer can navigate to matched mapping and back

### Event Handlers
- Named `handleXxx` (e.g., `handleDelete`, `handleSubmit`)

### Async / Error Handling
- `useCallback` for memoized fetch functions
- Boolean loading flags (`submitting`, `deleting`)
- `try/catch` around fetch calls, errors stored in state as `string | null`

### CSS / Theming
- CSS variables defined on `:root` (`--bg`, `--surface`, `--text`, `--accent`, etc.)
- Light theme via `[data-theme="light"]` selector
- Dark theme is default

## API Endpoints Used

All relative to WireMock base URL + `/__admin/`:
- `GET /mappings` / `GET /requests` — list
- `POST /mappings` — create
- `PUT /mappings/{id}` — update
- `DELETE /mappings/{id}` — delete
- `POST /mappings/import` — bulk import

## Key Notes

- No ESLint/Prettier config — follow existing code style
- TypeScript strict mode with no implicit any, no unused variables/parameters
- Fonts: Syne (headings), DM Sans (body), JetBrains Mono (code) via Google Fonts
- No backend — purely static frontend that talks directly to WireMock instances
