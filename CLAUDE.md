# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Nexus Hub** — a personal Tauri v2 desktop app that aggregates Jira, Gmail, Slack, and GitHub into a unified developer dashboard with intelligent, heuristic-based notifications. MVP targets Jira only.

> The project is currently in the planning/design phase. The scaffold has not been created yet. All implementation plans live in `docs/plans/`.

## Key Documents

| File | Purpose |
|------|---------|
| `docs/plans/2026-02-18-nexus-hub-design.md` | System design: architecture, data model, plugin interface, notification heuristics |
| `docs/plans/nexus-hub-implementation.md` | Step-by-step implementation tasks (12 tasks, Task 1 first) |
| `docs/tasks/todo.md` | MVP task checklist and working notes |
| `docs/plans/design.md` | Full UI/UX design system (colors, typography, components, interactions) |

## Commands (once scaffolded)

```bash
pnpm tauri dev          # Start dev mode (Rust + React hot reload)
pnpm tauri build        # Build release binary → src-tauri/target/release/bundle/
pnpm build              # Build frontend only (Vite)
pnpm typecheck          # TypeScript type checking

cd src-tauri && cargo check      # Check Rust compilation
cd src-tauri && cargo test       # Run Rust unit tests
pnpm vitest run                  # Run frontend/plugin unit tests
pnpm vitest run src/components/Feed.test.tsx   # Run a single test file
```

## Architecture

```
Tauri Window
  └── React 19 Frontend (src/)
        ↕ Tauri IPC (invoke / listen)
  └── Rust Core (src-tauri/src/)
        ├── scheduler.rs   — tokio polling loop, calls plugin runtime
        ├── plugin_runtime.rs — rustyscript (embedded Deno) executes TS plugins
        ├── db.rs          — rusqlite wrapper, all CRUD
        ├── models.rs      — shared structs (NexusItem, Notification, PluginConfig, HeuristicWeight)
        ├── commands.rs    — #[tauri::command] handlers + AppState
        ├── notifications.rs — tauri-plugin-notification wrapper
        └── lib.rs         — app entry: setup, plugin registration, invoke_handler
  └── TS Plugins (src-tauri/plugins/)
        ├── plugin_interface.ts — shared types (Credentials, NexusItem, PluginResult)
        └── jira.ts             — Jira REST API v3, exports fetch() and validateConnection()
```

**Data flow:** Scheduler (Rust) → `rustyscript` executes `{plugin}.ts` → plugin returns JSON `{ items, notifications }` → Rust persists to SQLite → emits `items-updated` Tauri event → React re-fetches via `invoke("get_items")`.

## Frontend Structure (once scaffolded)

```
src/
  styles/theme.css          — CSS custom properties (RPG dark theme)
  hooks/useItems.ts         — invoke get_items, listen for items-updated, refresh, markRead
  components/
    Feed.tsx                — item list, loading/error/empty states
    FeedItem.tsx            — single row with source accent bar, urgency badge, time-ago
    DetailPanel.tsx         — metadata grid, summary, tags, Open + Mark Read actions
    Settings.tsx            — Jira credentials form, calls save_plugin_config
  App.tsx                   — 3-panel layout shell, view switching (dashboard | settings)
  main.tsx                  — entry point
index.html                  — Google Fonts (Bricolage Grotesque, JetBrains Mono)
```

## Plugin Contract

Every plugin in `src-tauri/plugins/` must export:
- `fetch(configJson: string): Promise<string>` — returns `JSON.stringify({ items, notifications })`
- `validateConnection(configJson: string): Promise<string>` — returns `JSON.stringify({ ok, status })`

`configJson` is the raw JSON string stored in `plugin_config.credentials`.

## Notification Urgency

Urgency is computed as `Σ(active signal weights)`:
- `0-2` → low (badge only), `3-5` → medium (silent notification), `6-8` → high (sound), `9+` → critical (sound + dock blink)

Weights are stored in the `heuristic_weights` table and seeded with defaults in `db.rs::seed_default_weights()`.

## Design System

- **Theme:** Dark RPG/fantasy ("Dark Scriptorium") — see `docs/plans/design.md` for full token reference
- **Fonts:** Bricolage Grotesque (headers, Bricolage display) + JetBrains Mono (all data/metadata)
- **Source colors:** Jira `#4c9aff` · Gmail `#ea4335` · Slack `#7c3aed` · GitHub `#3fb950`
- **Icons:** Lucide React only — no emoji as icons
- **Urgency tiers:** low=slate · medium=amber `#d4a843` · high=ember `#e67e22` · critical=crimson `#e74c3c`

## Tauri-Specific Patterns

- All frontend → backend calls use `invoke("command_name", { camelCaseArgs })`. Rust receives them as `snake_case`.
- Backend → frontend events use `app.emit("event-name", payload)` / `listen("event-name", handler)`.
- `AppState` is managed via `app.manage()` and accessed in commands via `State<AppState>`. The `db` field is behind a `Mutex`.
- Plugin files at `src-tauri/plugins/` are loaded at runtime via `app.path().resource_dir()` — they must be listed under `bundle.resources` in `tauri.conf.json`.
- Capabilities (permissions) for Tauri plugins go in `src-tauri/capabilities/default.json`.

## Implementation Order

Follow the 12 tasks in `docs/plans/nexus-hub-implementation.md` in sequence. Each task ends with a `cargo check` or `pnpm tauri dev` verification and a commit. Do not start Task N+1 before Task N's verification passes.
