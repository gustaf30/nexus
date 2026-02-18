# Nexus Hub — MVP Implementation Tracker

**Source:** `docs/plans/2026-02-18-nexus-hub-implementation.md`
**Goal:** Personal Tauri v2 desktop app aggregating Jira data into a unified dashboard with intelligent notifications.

---

## Phase 1: Infrastructure & Backend (Rust)

### Task 1: Scaffold Tauri v2 Project
- [ ] Run `pnpm create tauri-app` and move contents to project root
- [ ] Update `src-tauri/tauri.conf.json` (productName, identifier, window config)
- [ ] Add Rust dependencies to `src-tauri/Cargo.toml` (rusqlite, tokio, chrono, uuid, serde)
- [ ] Add frontend deps (`@tauri-apps/api`, `@tauri-apps/plugin-opener`)
- [ ] Verify: `cargo check` and `pnpm build` succeed
- [ ] Commit: `chore: scaffold Tauri v2 project with React + TypeScript`

**Key files:** `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `package.json`

### Task 2: SQLite Database Layer
- [ ] Create `src-tauri/src/models.rs` (NexusItem, Notification, PluginConfig, HeuristicWeight)
- [ ] Create `src-tauri/src/db.rs` (migrations, CRUD: items, notifications, plugin_config, weights)
- [ ] Register modules in `src-tauri/src/lib.rs`
- [ ] Verify: `cargo check` compiles with no errors
- [ ] Commit: `feat: add SQLite database layer with models and CRUD operations`

**Key files:** `src-tauri/src/db.rs`, `src-tauri/src/models.rs`

### Task 3: Tauri Commands (Rust-Frontend Bridge)
- [ ] Create `src-tauri/src/commands.rs` (get_items, mark_read, get_notifications, dismiss_notification, get/save_plugin_config)
- [ ] Create `AppState` struct with `Mutex<Database>`
- [ ] Update `src-tauri/src/lib.rs` (manage state, setup DB in .setup(), register invoke_handler)
- [ ] Verify: `cargo check` compiles cleanly
- [ ] Commit: `feat: add Tauri IPC commands for frontend-backend communication`

**Key files:** `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`

### Task 4: Plugin Runtime (rustyscript)
- [ ] Add `rustyscript` to `src-tauri/Cargo.toml`
- [ ] Create `src-tauri/plugins/plugin_interface.ts` (shared types contract)
- [ ] Create `src-tauri/plugins/jira.ts` (fetch assigned issues, generate notifications with urgency signals)
- [ ] Create `src-tauri/src/plugin_runtime.rs` (load TS module, call exported function, parse JSON result)
- [ ] Register module in `src-tauri/src/lib.rs`
- [ ] Verify: `cargo check` compiles (adjust API if rustyscript differs from docs)
- [ ] Commit: `feat: add plugin runtime (rustyscript) with Jira plugin`

**Key files:** `src-tauri/src/plugin_runtime.rs`, `src-tauri/plugins/jira.ts`, `src-tauri/plugins/plugin_interface.ts`

### Task 5: Polling Scheduler
- [ ] Create `src-tauri/src/scheduler.rs` (poll_plugin, upsert items/notifications, start_polling loop)
- [ ] Add `refresh_plugin` command to `src-tauri/src/commands.rs`
- [ ] Update `AppState` to include `plugins_dir: PathBuf`
- [ ] Wire scheduler + refresh_plugin into `src-tauri/src/lib.rs`
- [ ] Verify: `cargo check` compiles
- [ ] Commit: `feat: add polling scheduler with manual refresh command`

**Key files:** `src-tauri/src/scheduler.rs`, `src-tauri/src/commands.rs`

---

### Checkpoint: Backend Verification
- [ ] All Rust code compiles: `cd src-tauri && cargo check`
- [ ] Database initializes correctly on first run
- [ ] All 5 backend tasks committed

---

## Phase 2: Frontend (React 19 + TypeScript)

### Task 6: Clean Slate + Design System
- [ ] Update `index.html` with Google Fonts (Bricolage Grotesque, JetBrains Mono)
- [ ] Create `src/styles/theme.css` (RPG dark theme CSS variables, scrollbar, panels)
- [ ] Create `src/App.tsx` (3-panel layout: sidebar, feed, detail)
- [ ] Remove default boilerplate (`App.css`, `react.svg`)
- [ ] Clean up `src/main.tsx` imports
- [ ] Verify: `pnpm tauri dev` shows dark-themed 3-panel shell
- [ ] Commit: `feat: add RPG dark theme and 3-panel dashboard layout`

**Key files:** `src/styles/theme.css`, `src/App.tsx`, `index.html`

### Task 7: Feed Component + Tauri IPC
- [ ] Create `src/hooks/useItems.ts` (invoke get_items, listen for items-updated event, refresh, markRead)
- [ ] Create `src/components/FeedItem.tsx` (source accent color, time ago, metadata badges)
- [ ] Create `src/components/Feed.tsx` (loading/error/empty states, item list)
- [ ] Integrate Feed into `src/App.tsx` with selectedItem state
- [ ] Verify: `pnpm tauri dev` shows empty state message
- [ ] Commit: `feat: add feed component with Tauri IPC integration`

**Key files:** `src/hooks/useItems.ts`, `src/components/FeedItem.tsx`, `src/components/Feed.tsx`

### Task 8: Detail Panel
- [ ] Create `src/components/DetailPanel.tsx` (metadata grid, summary, tags, open/mark-read actions)
- [ ] Integrate into `src/App.tsx` (pass selectedItem, onMarkRead, onOpenUrl via @tauri-apps/plugin-opener)
- [ ] Verify: `pnpm tauri dev` — clicking items shows detail
- [ ] Commit: `feat: add detail panel with metadata display and actions`

**Key files:** `src/components/DetailPanel.tsx`

### Task 9: Settings Panel
- [ ] Create `src/components/Settings.tsx` (Jira credentials form: baseUrl, email, apiToken, pollInterval)
- [ ] Add view switching in `src/App.tsx` (`"dashboard" | "settings"`)
- [ ] Verify: `pnpm tauri dev` — Settings saves Jira config to SQLite
- [ ] Commit: `feat: add settings panel for Jira plugin configuration`

**Key files:** `src/components/Settings.tsx`

---

### Checkpoint: Frontend Verification
- [ ] All React components render without errors
- [ ] IPC calls to Tauri backend work (Settings save, Feed fetch)
- [ ] All 4 frontend tasks committed

---

## Phase 3: Integration & Polish

### Task 10: Native Notifications
- [ ] Add `tauri-plugin-notification` to Cargo.toml and `@tauri-apps/plugin-notification` to package.json
- [ ] Create `src-tauri/src/notifications.rs` (send_native_notification with urgency labels)
- [ ] Register notification plugin in `src-tauri/src/lib.rs`
- [ ] Add `"notification:default"` to `src-tauri/capabilities/default.json`
- [ ] Wire notifications into scheduler (send for medium+ urgency)
- [ ] Verify: `pnpm tauri dev` — native notifications fire for high-priority tickets
- [ ] Commit: `feat: add native OS notifications for high-priority items`

**Key files:** `src-tauri/src/notifications.rs`, `src-tauri/capabilities/default.json`

### Task 11: End-to-End Integration Test
- [ ] Run `pnpm tauri dev`
- [ ] Verify: app opens with dark RPG theme, 3-panel layout
- [ ] Verify: Settings → fill Jira credentials → Save → success message
- [ ] Verify: Dashboard → Refresh → feed populates with Jira tickets
- [ ] Verify: Click ticket → detail panel shows metadata
- [ ] Verify: "Open in jira" → opens browser
- [ ] Verify: "Mark read" → item opacity decreases
- [ ] Verify: Native notification appears for high-priority tickets
- [ ] Fix any issues found
- [ ] Commit: `fix: integration fixes from end-to-end testing`

### Task 12: Polish and Cleanup
- [ ] Finalize `src-tauri/tauri.conf.json` (bundle config, window dimensions)
- [ ] Build release binary: `pnpm tauri build`
- [ ] Verify: built binary runs correctly from bundle output
- [ ] Commit: `chore: finalize build config and cleanup for MVP release`

**Key files:** `src-tauri/tauri.conf.json`

---

## Acceptance Criteria

- [ ] Tauri v2 desktop app opens with RPG dark theme
- [ ] 3-panel layout: sidebar (source filter), feed (item list), detail (item metadata)
- [ ] Jira plugin fetches assigned issues via REST API
- [ ] Items display with source-colored accents, priority badges, and time-ago timestamps
- [ ] Detail panel shows full metadata, summary, tags, and action buttons
- [ ] "Open in Jira" opens the ticket in the default browser
- [ ] "Mark read/unread" toggles item state
- [ ] Settings panel persists Jira credentials to SQLite
- [ ] Native OS notifications fire for medium+ urgency items
- [ ] Release binary builds and runs successfully

---

## Working Notes

_Capture constraints, decisions, and discovered pitfalls here as work progresses._
