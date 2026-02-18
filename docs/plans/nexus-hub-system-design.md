# Nexus Hub — Design Document

**Date:** 2026-02-18
**Status:** Approved
**Author:** Gustavo (with AI assistance)

---

## 1. Overview

**Nexus Hub** is a personal desktop application that aggregates information from development tools (Jira, Gmail, Slack, GitHub) into a unified dashboard with intelligent notifications.

### Problem Statement

Developers context-switch between multiple tools throughout the day. Important information gets lost across tabs, and critical notifications are buried in noise. Nexus Hub solves this by providing a single pane of glass with smart prioritization.

### Goals

- Unified dashboard showing data from all connected tools
- Intelligent notifications based on configurable heuristics (no AI/LLM required)
- Lightweight desktop app with native OS notifications
- Extensible plugin architecture for adding new integrations

### Non-Goals

- Multi-user / team features
- AI-powered summarization or classification
- Real-time sync (webhooks)
- Mobile app

---

## 2. Architecture

### Approach: Hybrid (Rust Core + TypeScript Plugins)

```
┌─────────────────────────────────────────────────────┐
│                    Tauri Window                      │
│  ┌───────────────────────────────────────────────┐  │
│  │              React Frontend                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │Dashboard │ │Notifica- │ │ Settings     │  │  │
│  │  │ View     │ │ tions    │ │ Panel        │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ Tauri Commands (IPC)           │
│  ┌──────────────────┴────────────────────────────┐  │
│  │              Rust Core                         │  │
│  │  ┌────────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │ Scheduler  │ │ SQLite   │ │  Native    │  │  │
│  │  │ (polling)  │ │ Manager  │ │  Notifs    │  │  │
│  │  └─────┬──────┘ └──────────┘ └────────────┘  │  │
│  │        │                                       │  │
│  │  ┌─────┴──────────────────────────────────┐   │  │
│  │  │        Plugin Runtime (Deno)            │   │  │
│  │  │  ┌───────┐ ┌───────┐ ┌───────┐        │   │  │
│  │  │  │ Jira  │ │ Gmail │ │ Slack │        │   │  │
│  │  │  │plugin │ │plugin │ │plugin │        │   │  │
│  │  │  └───────┘ └───────┘ └───────┘        │   │  │
│  │  │  ┌────────┐                             │   │  │
│  │  │  │ GitHub │                             │   │  │
│  │  │  │ plugin │                             │   │  │
│  │  │  └────────┘                             │   │  │
│  │  └────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| **Frontend** | React + TypeScript | Dashboard UI, in-app notifications, settings |
| **Rust Core** | Rust (Tauri) | Polling scheduler, SQLite management, native OS notifications, plugin runtime management |
| **Plugin Runtime** | Deno embedded | Executes TS plugins in sandbox isolation |
| **Plugins** | TypeScript | One per integration. Standard interface: `fetch()`, `normalize()`, `getNotifications()` |

### Data Flow

1. **Scheduler (Rust)** triggers polling at configured intervals per plugin
2. **Plugin Runtime (Deno)** executes the corresponding plugin
3. **Plugin (TS)** calls the external API, normalizes data to standard format
4. **Rust Core** persists to SQLite and evaluates notification heuristics
5. **Frontend (React)** receives Tauri event and updates UI

### Refresh Strategy

- Polling every 5-15 minutes (configurable per plugin)
- Manual refresh button available
- No webhooks or real-time connections

---

## 3. Plugin System

### Standard Plugin Interface

```typescript
interface NexusPlugin {
  id: string;
  name: string;
  icon: string;

  configure(credentials: Credentials): Promise<void>;
  validateConnection(): Promise<boolean>;
  fetch(): Promise<NexusItem[]>;
  getNotifications(): Promise<NexusNotification[]>;
}

interface NexusItem {
  id: string;
  source: string;          // "jira" | "gmail" | "slack" | "github"
  type: string;            // "ticket" | "email" | "message" | "pr" | "issue"
  title: string;
  summary: string;
  url: string;
  author: string;
  timestamp: Date;
  priority: Priority;
  metadata: Record<string, any>;
  tags: string[];
  isRead: boolean;
}

interface NexusNotification {
  itemId: string;
  reason: string;          // "assigned_to_you" | "mentioned" | "deadline_approaching" | etc.
  urgency: "low" | "medium" | "high" | "critical";
}
```

### Planned Plugins (v1)

| Plugin | API | Primary Data |
|---|---|---|
| **Jira** | Jira REST API v3 | Assigned tickets, watched issues, current sprint |
| **Gmail** | Gmail API (OAuth2) | Unread emails, starred, from VIP senders |
| **Slack** | Slack Web API | Direct messages, mentions, active channels |
| **GitHub** | GitHub REST/GraphQL API | PRs needing review, assigned issues, CI status |

### Plugin Lifecycle

```
[Installed] → [Configured (credentials)] → [Active (polling)] → [Error (retry)]
                                                    ↑                  |
                                                    └──────────────────┘
```

- Plugins in error state use exponential backoff (1min → 2min → 4min → max 30min)
- After 5 consecutive failures, plugin is deactivated and user is notified

---

## 4. Notification Heuristics

### Priority Model

Rules based on concrete signals from each source. Each signal has a **weight** and the sum determines urgency.

```
Urgency = Σ(active signal weights)

0-2  → low
3-5  → medium
6-8  → high
9+   → critical
```

### Signals by Source

| Source | Signal | Weight |
|---|---|---|
| **Jira** | Assigned to me | +3 |
| **Jira** | Priority P1/Blocker | +4 |
| **Jira** | Mentioned in comment | +2 |
| **Jira** | Deadline in < 24h | +3 |
| **Gmail** | From VIP sender (configurable) | +3 |
| **Gmail** | Unread > 4h | +1 |
| **Gmail** | Has attachment | +1 |
| **Slack** | Direct message | +3 |
| **Slack** | Channel mention | +2 |
| **Slack** | Thread I participated in | +1 |
| **GitHub** | PR needs my review | +4 |
| **GitHub** | CI failed on my PR | +3 |
| **GitHub** | Comment on my PR | +2 |

### Notification Behavior

| Urgency | Behavior |
|---|---|
| **low** | Badge on app icon, no pop-up |
| **medium** | Silent native notification (no sound) |
| **high** | Native notification with default sound |
| **critical** | Native notification with sound + blinking dock/taskbar icon |

### Additional Features

- **Focus mode**: Suppresses notifications below `high` (configurable threshold)
- **Quiet hours**: Configure silent periods (e.g., 22:00-08:00)
- All weights are user-configurable in Settings

---

## 5. Frontend Design

### Layout

Three-panel layout focused on dense, actionable information:

```
┌──────────────────────────────────────────────────────────────┐
│  ◈ Nexus Hub                          🔔 3  ⚙️  ↻ Refresh   │
├────────────┬─────────────────────────────┬───────────────────┤
│  SOURCES   │     UNIFIED FEED            │   DETAIL          │
│            │                             │                   │
│  ● All     │  🔴 [Jira] PROJ-123        │  PROJ-123         │
│  ● Jira    │     Critical prod bug       │  Critical bug...  │
│  ● Gmail   │     5 min ago · P1          │                   │
│  ● Slack   │                             │  Assigned: me     │
│  ● GitHub  │  🟡 [GitHub] PR #456        │  Sprint: 24.3     │
│            │     Review requested         │  Deadline: tmrw   │
│  FILTERS   │     20 min ago              │                   │
│            │                             │  Comments (3)     │
│  ○ Urgent  │  🟡 [Slack] DM @pedro       │  ...              │
│  ○ Today   │     "Did you see deploy?"   │                   │
│  ○ Unread  │     1h ago                  │  [Open in Jira]   │
│            │                             │                   │
├────────────┴─────────────────────────────┴───────────────────┤
│  Last update: 14:32  ·  Next refresh: 14:47                 │
└──────────────────────────────────────────────────────────────┘
```

### Screens

| Screen | Description |
|---|---|
| **Dashboard** | Unified feed with filters by source, urgency, and read status |
| **Notifications** | Notification list with quick actions (mark read, open, snooze) |
| **Settings** | Credential config, polling intervals, heuristic weights, quiet hours |

### Key Interactions

- **Click item** → Opens detail in right panel
- **Double-click** → Opens original URL in browser
- **Keyboard shortcuts** → `j/k` navigate, `Enter` open, `r` refresh, `m` mark read
- **Cmd+K** → Quick search / command palette

### Design System

- **Theme**: Dark mode with RPG/fantasy aesthetic
- **Typography**: JetBrains Mono for data, Bricolage Grotesque for headers
- **Source colors**: Jira=blue, Gmail=red, Slack=purple, GitHub=green

---

## 6. Data Model (SQLite)

### Schema

```sql
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    author TEXT,
    timestamp INTEGER NOT NULL,
    priority INTEGER DEFAULT 0,
    metadata TEXT,               -- JSON
    tags TEXT,                   -- JSON array
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(source, source_id)
);

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id),
    reason TEXT NOT NULL,
    urgency TEXT NOT NULL,
    is_dismissed INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE plugin_config (
    plugin_id TEXT PRIMARY KEY,
    is_enabled INTEGER DEFAULT 1,
    credentials TEXT,            -- Encrypted JSON (AES-256-GCM)
    poll_interval_secs INTEGER DEFAULT 600,
    last_poll_at INTEGER,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    settings TEXT                -- JSON
);

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE heuristic_weights (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    signal TEXT NOT NULL,
    weight INTEGER NOT NULL,
    UNIQUE(source, signal)
);
```

### Indexes

```sql
CREATE INDEX idx_items_source ON items(source);
CREATE INDEX idx_items_timestamp ON items(timestamp DESC);
CREATE INDEX idx_items_priority ON items(priority DESC);
CREATE INDEX idx_items_is_read ON items(is_read);
CREATE INDEX idx_notifications_urgency ON notifications(urgency);
CREATE INDEX idx_notifications_dismissed ON notifications(is_dismissed);
```

### Credential Security

- Credentials stored **encrypted** in SQLite using AES-256-GCM
- Encryption key derived from OS keychain (via `tauri-plugin-stronghold` or native keyring)
- Never stored in plaintext on disk

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| **API unavailable** | Exponential backoff (1→2→4→...→30 min). Warning badge on plugin. Stale data remains visible. |
| **Token expired** | Notification to user with "Reconnect" button. Plugin paused until reconnection. |
| **Rate limit** | Respects `Retry-After` headers. Adjusts polling interval automatically. |
| **Plugin crash** | Isolated in Deno sandbox. Does not affect other plugins or core. Error logged. |
| **SQLite corruption** | Automatic backup every 24h. Reset option in Settings. |

---

## 8. Testing Strategy

| Layer | Test Type | Tool |
|---|---|---|
| **Plugins (TS)** | Unit tests with API mocks | Vitest |
| **Rust Core** | Unit tests for scheduler, DB, heuristics | `cargo test` |
| **Frontend** | Component tests | Vitest + Testing Library |
| **Integration** | Plugin + SQLite end-to-end | Vitest with in-memory SQLite |

---

## 9. Release Plan

### MVP (v1.0)

- Jira plugin only (validates architecture end-to-end)
- Basic dashboard with unified feed and source filter
- Native notifications with basic heuristics (assigned to me, mentioned)
- Settings panel for credentials and polling interval

### Post-MVP

| Version | Feature |
|---|---|
| v1.1 | Gmail plugin |
| v1.2 | GitHub plugin |
| v1.3 | Slack plugin |
| v1.4 | Command palette, keyboard shortcuts, focus mode |

---

## 10. Tech Stack Summary

| Component | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Core backend | Rust |
| Plugin runtime | Deno embedded |
| Database | SQLite (via rusqlite) |
| Credential storage | tauri-plugin-stronghold / OS keyring |
| Build tool | Vite |
| Testing | Vitest + cargo test |
| Package manager | pnpm |
