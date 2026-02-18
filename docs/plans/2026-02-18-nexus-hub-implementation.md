# Nexus Hub — MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal desktop app (Tauri v2) that aggregates Jira data into a unified dashboard with intelligent notifications. MVP = Jira plugin only, validating the full architecture end-to-end.

**Architecture:** Tauri v2 desktop shell with React 19 frontend. Rust core handles SQLite, scheduling, and native notifications. TypeScript plugins run inside `rustyscript` (embedded Deno-compatible JS/TS runtime). Each plugin implements a standard interface and is invoked by the Rust scheduler on a configurable interval.

**Tech Stack:** Tauri v2, React 19, TypeScript, Vite, Rust, rustyscript, rusqlite (bundled), tauri-plugin-notification, tauri-plugin-stronghold, tauri-plugin-opener, tokio, serde, uuid, pnpm

**Design Document:** `docs/plans/2026-02-18-nexus-hub-design.md`

---

## Task 1: Scaffold Tauri v2 Project

**Files:**
- Create: project root via `pnpm create tauri-app`
- Modify: `src-tauri/Cargo.toml` (add dependencies)
- Modify: `src-tauri/tauri.conf.json` (app identity)
- Modify: `package.json` (add dev dependencies)

**Step 1: Scaffold the project**

```bash
cd /home/gustavo/dev/teste
pnpm create tauri-app nexus-hub -- --template react-ts --manager pnpm
```

If interactive, choose:
- Project name: `nexus-hub`
- Identifier: `com.nexushub.app`
- Frontend: TypeScript / JavaScript → React → TypeScript

**Step 2: Move project contents to root**

Since we already have `docs/` in the root, move the scaffold contents up:

```bash
# Move everything from nexus-hub/ to current directory, preserving docs/
cp -r nexus-hub/* nexus-hub/.* . 2>/dev/null || true
rm -rf nexus-hub
```

**Step 3: Install dependencies and verify scaffold works**

```bash
pnpm install
pnpm tauri dev
```

Expected: Tauri window opens with default React template. Close it.

**Step 4: Update `src-tauri/tauri.conf.json` identity**

Set the app name and window title:

```json
{
  "productName": "Nexus Hub",
  "identifier": "com.nexushub.app",
  "app": {
    "windows": [
      {
        "title": "Nexus Hub",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600
      }
    ]
  }
}
```

**Step 5: Add Rust dependencies to `src-tauri/Cargo.toml`**

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
```

Note: We add `tauri-plugin-notification`, `tauri-plugin-stronghold`, and `rustyscript` in later tasks when we need them.

**Step 6: Add frontend dev dependencies**

```bash
pnpm add -D @tauri-apps/api @tauri-apps/plugin-opener
```

**Step 7: Verify build still works**

```bash
cd src-tauri && cargo check && cd ..
pnpm build
```

Expected: No errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri v2 project with React + TypeScript"
```

---

## Task 2: SQLite Database Layer (Rust)

**Files:**
- Create: `src-tauri/src/db.rs`
- Create: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/lib.rs` (register module)

**Step 1: Create `src-tauri/src/models.rs` — data structures**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NexusItem {
    pub id: String,
    pub source: String,
    pub source_id: String,
    pub item_type: String,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub author: Option<String>,
    pub timestamp: i64,
    pub priority: i32,
    pub metadata: Option<String>,   // JSON string
    pub tags: Option<String>,       // JSON array string
    pub is_read: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub item_id: String,
    pub reason: String,
    pub urgency: String,
    pub is_dismissed: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub plugin_id: String,
    pub is_enabled: bool,
    pub credentials: Option<String>,   // Encrypted JSON
    pub poll_interval_secs: i64,
    pub last_poll_at: Option<i64>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub settings: Option<String>,      // JSON
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeuristicWeight {
    pub id: String,
    pub source: String,
    pub signal: String,
    pub weight: i32,
}
```

**Step 2: Create `src-tauri/src/db.rs` — database initialization and migrations**

```rust
use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use crate::models::{NexusItem, Notification, PluginConfig, HeuristicWeight};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT,
                url TEXT NOT NULL,
                author TEXT,
                timestamp INTEGER NOT NULL,
                priority INTEGER DEFAULT 0,
                metadata TEXT,
                tags TEXT,
                is_read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(source, source_id)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL REFERENCES items(id),
                reason TEXT NOT NULL,
                urgency TEXT NOT NULL,
                is_dismissed INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plugin_config (
                plugin_id TEXT PRIMARY KEY,
                is_enabled INTEGER DEFAULT 1,
                credentials TEXT,
                poll_interval_secs INTEGER DEFAULT 600,
                last_poll_at INTEGER,
                last_error TEXT,
                error_count INTEGER DEFAULT 0,
                settings TEXT
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS heuristic_weights (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                signal TEXT NOT NULL,
                weight INTEGER NOT NULL,
                UNIQUE(source, signal)
            );

            CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
            CREATE INDEX IF NOT EXISTS idx_items_timestamp ON items(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority DESC);
            CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read);
            CREATE INDEX IF NOT EXISTS idx_notifications_urgency ON notifications(urgency);
            CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(is_dismissed);
        ")?;
        Ok(())
    }

    // -- Items CRUD --

    pub fn upsert_item(&self, item: &NexusItem) -> Result<()> {
        self.conn.execute(
            "INSERT INTO items (id, source, source_id, item_type, title, summary, url, author, timestamp, priority, metadata, tags, is_read, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
             ON CONFLICT(source, source_id) DO UPDATE SET
                title=excluded.title, summary=excluded.summary, url=excluded.url,
                author=excluded.author, timestamp=excluded.timestamp, priority=excluded.priority,
                metadata=excluded.metadata, tags=excluded.tags, updated_at=excluded.updated_at",
            params![
                item.id, item.source, item.source_id, item.item_type,
                item.title, item.summary, item.url, item.author,
                item.timestamp, item.priority, item.metadata, item.tags,
                item.is_read as i32, item.created_at, item.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_items(&self, source: Option<&str>, unread_only: bool, limit: i64) -> Result<Vec<NexusItem>> {
        let mut sql = String::from("SELECT * FROM items WHERE 1=1");
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

        if let Some(s) = source {
            sql.push_str(" AND source = ?");
            param_values.push(Box::new(s.to_string()));
        }
        if unread_only {
            sql.push_str(" AND is_read = 0");
        }
        sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
        param_values.push(Box::new(limit));

        let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = self.conn.prepare(&sql)?;
        let items = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(NexusItem {
                id: row.get(0)?,
                source: row.get(1)?,
                source_id: row.get(2)?,
                item_type: row.get(3)?,
                title: row.get(4)?,
                summary: row.get(5)?,
                url: row.get(6)?,
                author: row.get(7)?,
                timestamp: row.get(8)?,
                priority: row.get(9)?,
                metadata: row.get(10)?,
                tags: row.get(11)?,
                is_read: row.get::<_, i32>(12)? != 0,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(items)
    }

    pub fn mark_item_read(&self, item_id: &str, read: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE items SET is_read = ?1 WHERE id = ?2",
            params![read as i32, item_id],
        )?;
        Ok(())
    }

    // -- Notifications CRUD --

    pub fn insert_notification(&self, notif: &Notification) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO notifications (id, item_id, reason, urgency, is_dismissed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![notif.id, notif.item_id, notif.reason, notif.urgency, notif.is_dismissed as i32, notif.created_at],
        )?;
        Ok(())
    }

    pub fn get_active_notifications(&self) -> Result<Vec<Notification>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM notifications WHERE is_dismissed = 0 ORDER BY created_at DESC"
        )?;
        let notifs = stmt.query_map([], |row| {
            Ok(Notification {
                id: row.get(0)?,
                item_id: row.get(1)?,
                reason: row.get(2)?,
                urgency: row.get(3)?,
                is_dismissed: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(notifs)
    }

    pub fn dismiss_notification(&self, notif_id: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE notifications SET is_dismissed = 1 WHERE id = ?1",
            params![notif_id],
        )?;
        Ok(())
    }

    // -- Plugin Config CRUD --

    pub fn get_plugin_config(&self, plugin_id: &str) -> Result<Option<PluginConfig>> {
        let mut stmt = self.conn.prepare("SELECT * FROM plugin_config WHERE plugin_id = ?1")?;
        let mut rows = stmt.query_map(params![plugin_id], |row| {
            Ok(PluginConfig {
                plugin_id: row.get(0)?,
                is_enabled: row.get::<_, i32>(1)? != 0,
                credentials: row.get(2)?,
                poll_interval_secs: row.get(3)?,
                last_poll_at: row.get(4)?,
                last_error: row.get(5)?,
                error_count: row.get(6)?,
                settings: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn upsert_plugin_config(&self, config: &PluginConfig) -> Result<()> {
        self.conn.execute(
            "INSERT INTO plugin_config (plugin_id, is_enabled, credentials, poll_interval_secs, last_poll_at, last_error, error_count, settings)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(plugin_id) DO UPDATE SET
                is_enabled=excluded.is_enabled, credentials=excluded.credentials,
                poll_interval_secs=excluded.poll_interval_secs, last_poll_at=excluded.last_poll_at,
                last_error=excluded.last_error, error_count=excluded.error_count, settings=excluded.settings",
            params![
                config.plugin_id, config.is_enabled as i32, config.credentials,
                config.poll_interval_secs, config.last_poll_at, config.last_error,
                config.error_count, config.settings
            ],
        )?;
        Ok(())
    }

    // -- Heuristic Weights --

    pub fn get_weights(&self, source: &str) -> Result<Vec<HeuristicWeight>> {
        let mut stmt = self.conn.prepare("SELECT * FROM heuristic_weights WHERE source = ?1")?;
        let weights = stmt.query_map(params![source], |row| {
            Ok(HeuristicWeight {
                id: row.get(0)?,
                source: row.get(1)?,
                signal: row.get(2)?,
                weight: row.get(3)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(weights)
    }

    pub fn upsert_weight(&self, weight: &HeuristicWeight) -> Result<()> {
        self.conn.execute(
            "INSERT INTO heuristic_weights (id, source, signal, weight)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(source, signal) DO UPDATE SET weight=excluded.weight",
            params![weight.id, weight.source, weight.signal, weight.weight],
        )?;
        Ok(())
    }

    pub fn seed_default_weights(&self) -> Result<()> {
        let defaults = vec![
            ("jira", "assigned_to_me", 3),
            ("jira", "priority_p1_blocker", 4),
            ("jira", "mentioned_in_comment", 2),
            ("jira", "deadline_24h", 3),
        ];
        for (source, signal, weight) in defaults {
            let hw = HeuristicWeight {
                id: format!("{}-{}", source, signal),
                source: source.to_string(),
                signal: signal.to_string(),
                weight,
            };
            self.upsert_weight(&hw)?;
        }
        Ok(())
    }
}
```

**Step 3: Register modules in `src-tauri/src/lib.rs`**

Add at the top of `lib.rs`:

```rust
mod db;
mod models;
```

**Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: Compiles with no errors (warnings about unused code are OK at this stage).

**Step 5: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/models.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add SQLite database layer with models and CRUD operations"
```

---

## Task 3: Tauri Commands (Rust ↔ Frontend Bridge)

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` (register commands + state)

**Step 1: Create `src-tauri/src/commands.rs`**

These are the Tauri IPC commands the React frontend will call.

```rust
use std::sync::Mutex;
use tauri::State;
use crate::db::Database;
use crate::models::{NexusItem, Notification, PluginConfig};

pub struct AppState {
    pub db: Mutex<Database>,
}

#[tauri::command]
pub fn get_items(
    state: State<AppState>,
    source: Option<String>,
    unread_only: bool,
    limit: Option<i64>,
) -> Result<Vec<NexusItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_items(source.as_deref(), unread_only, limit.unwrap_or(100))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_read(state: State<AppState>, item_id: String, read: bool) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.mark_item_read(&item_id, read).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_notifications(state: State<AppState>) -> Result<Vec<Notification>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_active_notifications().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn dismiss_notification(state: State<AppState>, notif_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.dismiss_notification(&notif_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_plugin_config(state: State<AppState>, plugin_id: String) -> Result<Option<PluginConfig>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_plugin_config(&plugin_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_plugin_config(state: State<AppState>, config: PluginConfig) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_plugin_config(&config).map_err(|e| e.to_string())
}
```

**Step 2: Update `src-tauri/src/lib.rs` to register state and commands**

```rust
mod commands;
mod db;
mod models;

use commands::AppState;
use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
            let db_path = app_dir.join("nexus-hub.db");
            let db = Database::new(db_path).expect("failed to init database");
            db.seed_default_weights().expect("failed to seed default weights");
            app.manage(AppState {
                db: std::sync::Mutex::new(db),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_items,
            commands::mark_read,
            commands::get_notifications,
            commands::dismiss_notification,
            commands::get_plugin_config,
            commands::save_plugin_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: Compiles cleanly.

**Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add Tauri IPC commands for frontend-backend communication"
```

---

## Task 4: Plugin Runtime with rustyscript

**Files:**
- Create: `src-tauri/src/plugin_runtime.rs`
- Create: `src-tauri/plugins/plugin_interface.ts` (shared types)
- Create: `src-tauri/plugins/jira.ts` (Jira plugin)
- Modify: `src-tauri/Cargo.toml` (add rustyscript)
- Modify: `src-tauri/src/lib.rs` (register module)

**Step 1: Add rustyscript to `src-tauri/Cargo.toml`**

```toml
[dependencies]
# ... existing deps ...
rustyscript = "0.9"
```

**Step 2: Create `src-tauri/plugins/plugin_interface.ts`**

This defines the contract every plugin must follow.

```typescript
// Plugin Interface — all plugins must export these functions

export interface Credentials {
  baseUrl?: string;
  token?: string;
  email?: string;
  apiKey?: string;
}

export interface NexusItem {
  id: string;
  source: string;
  sourceId: string;
  type: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  timestamp: number; // Unix timestamp (seconds)
  metadata: Record<string, unknown>;
  tags: string[];
}

export interface NexusNotification {
  itemId: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
}

export interface PluginResult {
  items: NexusItem[];
  notifications: NexusNotification[];
}
```

**Step 3: Create `src-tauri/plugins/jira.ts`**

The Jira plugin fetches assigned issues and generates notifications.

```typescript
// Jira Plugin for Nexus Hub
// Fetches issues assigned to the configured user from Jira REST API v3

interface JiraConfig {
  baseUrl: string;   // e.g. "https://mycompany.atlassian.net"
  email: string;     // Jira account email
  apiToken: string;  // Jira API token
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: { name: string };
    priority: { name: string; id: string };
    assignee: { displayName: string; emailAddress: string } | null;
    reporter: { displayName: string } | null;
    duedate: string | null;
    updated: string;
    created: string;
    labels: string[];
    comment?: { comments: Array<{ body: string; author: { displayName: string } }> };
  };
}

// Entry point — called by Rust plugin runtime
export async function fetch(configJson: string): Promise<string> {
  const config: JiraConfig = JSON.parse(configJson);
  const auth = btoa(`${config.email}:${config.apiToken}`);

  const jql = "assignee = currentUser() AND status != Done ORDER BY updated DESC";
  const url = `${config.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,description,status,priority,assignee,reporter,duedate,updated,created,labels,comment`;

  const response = await globalThis.fetch(url, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const issues: JiraIssue[] = data.issues || [];

  const items = issues.map((issue) => ({
    id: `jira-${issue.key}`,
    source: "jira",
    sourceId: issue.key,
    type: "ticket",
    title: `[${issue.key}] ${issue.fields.summary}`,
    summary: issue.fields.description
      ? issue.fields.description.substring(0, 200)
      : null,
    url: `${config.baseUrl}/browse/${issue.key}`,
    author: issue.fields.reporter?.displayName ?? null,
    timestamp: Math.floor(new Date(issue.fields.updated).getTime() / 1000),
    metadata: {
      status: issue.fields.status.name,
      priority: issue.fields.priority.name,
      priorityId: issue.fields.priority.id,
      duedate: issue.fields.duedate,
      assignee: issue.fields.assignee?.displayName ?? null,
    },
    tags: issue.fields.labels,
  }));

  const now = Math.floor(Date.now() / 1000);
  const notifications = issues
    .map((issue) => {
      const signals: Array<{ reason: string; weight: number }> = [];

      // Signal: assigned to me (always true since JQL filters for it)
      signals.push({ reason: "assigned_to_you", weight: 3 });

      // Signal: high priority (P1 or Blocker — priorityId "1" or "2")
      const pId = issue.fields.priority.id;
      if (pId === "1" || pId === "2") {
        signals.push({ reason: "priority_p1_blocker", weight: 4 });
      }

      // Signal: deadline within 24h
      if (issue.fields.duedate) {
        const due = Math.floor(new Date(issue.fields.duedate).getTime() / 1000);
        if (due - now < 86400 && due > now) {
          signals.push({ reason: "deadline_24h", weight: 3 });
        }
      }

      const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
      let urgency: "low" | "medium" | "high" | "critical";
      if (totalWeight >= 9) urgency = "critical";
      else if (totalWeight >= 6) urgency = "high";
      else if (totalWeight >= 3) urgency = "medium";
      else urgency = "low";

      return {
        itemId: `jira-${issue.key}`,
        reason: signals.map((s) => s.reason).join(","),
        urgency,
      };
    })
    .filter((n) => n.urgency !== "low"); // Only notify for medium+

  return JSON.stringify({ items, notifications });
}

// Validate connection
export async function validateConnection(configJson: string): Promise<string> {
  const config: JiraConfig = JSON.parse(configJson);
  const auth = btoa(`${config.email}:${config.apiToken}`);

  const response = await globalThis.fetch(`${config.baseUrl}/rest/api/3/myself`, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  return JSON.stringify({ ok: response.ok, status: response.status });
}
```

**Step 4: Create `src-tauri/src/plugin_runtime.rs`**

```rust
use rustyscript::{Runtime, RuntimeOptions, Module};
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginItem {
    pub id: String,
    pub source: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub author: Option<String>,
    pub timestamp: i64,
    pub metadata: serde_json::Value,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginNotification {
    #[serde(rename = "itemId")]
    pub item_id: String,
    pub reason: String,
    pub urgency: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginResult {
    pub items: Vec<PluginItem>,
    pub notifications: Vec<PluginNotification>,
}

pub fn execute_plugin(plugin_path: &Path, function: &str, config_json: &str) -> Result<String, String> {
    let source = std::fs::read_to_string(plugin_path)
        .map_err(|e| format!("Failed to read plugin file: {}", e))?;

    let module = Module::new(
        plugin_path.to_string_lossy().as_ref(),
        &source,
    );

    let mut runtime = Runtime::new(RuntimeOptions::default())
        .map_err(|e| format!("Failed to create runtime: {}", e))?;

    let handle = runtime.load_module(&module)
        .map_err(|e| format!("Failed to load module: {}", e))?;

    let result: String = runtime.call_entrypoint(&handle, &[config_json.into()])
        .map_err(|e| format!("Plugin execution failed: {}", e))?;

    Ok(result)
}

pub fn parse_plugin_result(json: &str) -> Result<PluginResult, String> {
    serde_json::from_str(json).map_err(|e| format!("Failed to parse plugin result: {}", e))
}
```

Note: The actual `rustyscript` API may differ slightly. Consult `docs.rs/rustyscript` when implementing. The key pattern is: load a TS module, call an exported function with a JSON string argument, get a JSON string back.

**Step 5: Register module in `src-tauri/src/lib.rs`**

Add:

```rust
mod plugin_runtime;
```

**Step 6: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: Compiles. If `rustyscript` API differs, adjust `plugin_runtime.rs` according to the docs.

**Step 7: Commit**

```bash
git add src-tauri/src/plugin_runtime.rs src-tauri/plugins/ src-tauri/Cargo.toml src-tauri/src/lib.rs
git commit -m "feat: add plugin runtime (rustyscript) with Jira plugin"
```

---

## Task 5: Polling Scheduler

**Files:**
- Create: `src-tauri/src/scheduler.rs`
- Modify: `src-tauri/src/lib.rs` (start scheduler on setup)
- Modify: `src-tauri/src/commands.rs` (add manual refresh command)

**Step 1: Create `src-tauri/src/scheduler.rs`**

```rust
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::path::PathBuf;
use tokio::time;
use tauri::{AppHandle, Emitter};
use crate::db::Database;
use crate::models::{NexusItem, Notification};
use crate::plugin_runtime;
use chrono::Utc;
use uuid::Uuid;

pub struct Scheduler {
    plugins_dir: PathBuf,
}

impl Scheduler {
    pub fn new(plugins_dir: PathBuf) -> Self {
        Self { plugins_dir }
    }

    pub fn poll_plugin(
        &self,
        plugin_id: &str,
        db: &Database,
    ) -> Result<usize, String> {
        let config = db.get_plugin_config(plugin_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Plugin {} not configured", plugin_id))?;

        if !config.is_enabled {
            return Err(format!("Plugin {} is disabled", plugin_id));
        }

        let credentials = config.credentials
            .ok_or_else(|| format!("Plugin {} has no credentials", plugin_id))?;

        let plugin_path = self.plugins_dir.join(format!("{}.ts", plugin_id));
        if !plugin_path.exists() {
            return Err(format!("Plugin file not found: {:?}", plugin_path));
        }

        let result_json = plugin_runtime::execute_plugin(&plugin_path, "fetch", &credentials)?;
        let result = plugin_runtime::parse_plugin_result(&result_json)?;

        let now = Utc::now().timestamp();

        // Upsert items
        for pi in &result.items {
            let item = NexusItem {
                id: pi.id.clone(),
                source: pi.source.clone(),
                source_id: pi.source_id.clone(),
                item_type: pi.item_type.clone(),
                title: pi.title.clone(),
                summary: pi.summary.clone(),
                url: pi.url.clone(),
                author: pi.author.clone(),
                timestamp: pi.timestamp,
                priority: 0,
                metadata: Some(serde_json::to_string(&pi.metadata).unwrap_or_default()),
                tags: Some(serde_json::to_string(&pi.tags).unwrap_or_default()),
                is_read: false,
                created_at: now,
                updated_at: now,
            };
            db.upsert_item(&item).map_err(|e| e.to_string())?;
        }

        // Insert notifications
        for pn in &result.notifications {
            let notif = Notification {
                id: Uuid::new_v4().to_string(),
                item_id: pn.item_id.clone(),
                reason: pn.reason.clone(),
                urgency: pn.urgency.clone(),
                is_dismissed: false,
                created_at: now,
            };
            db.insert_notification(&notif).map_err(|e| e.to_string())?;
        }

        // Update plugin last_poll_at and reset error count
        let mut updated_config = config.clone();
        updated_config.credentials = Some(credentials);
        updated_config.last_poll_at = Some(now);
        updated_config.last_error = None;
        updated_config.error_count = 0;
        db.upsert_plugin_config(&updated_config).map_err(|e| e.to_string())?;

        Ok(result.items.len())
    }
}

pub fn start_polling(app: AppHandle, db: Arc<Mutex<Database>>, plugins_dir: PathBuf) {
    let scheduler = Scheduler::new(plugins_dir);

    tauri::async_runtime::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(600)); // 10 min default

        loop {
            interval.tick().await;

            let db_lock = db.lock();
            if let Ok(db_ref) = db_lock {
                match scheduler.poll_plugin("jira", &db_ref) {
                    Ok(count) => {
                        println!("[scheduler] Jira: fetched {} items", count);
                        let _ = app.emit("items-updated", "jira");
                    }
                    Err(e) => {
                        eprintln!("[scheduler] Jira poll error: {}", e);
                    }
                }
            }
        }
    });
}
```

**Step 2: Add manual refresh command to `src-tauri/src/commands.rs`**

```rust
use std::sync::Arc;
use crate::scheduler::Scheduler;

#[tauri::command]
pub fn refresh_plugin(
    state: State<AppState>,
    plugin_id: String,
) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let plugins_dir = state.plugins_dir.clone();
    let scheduler = Scheduler::new(plugins_dir);
    scheduler.poll_plugin(&plugin_id, &db)
}
```

Update `AppState` to include `plugins_dir`:

```rust
pub struct AppState {
    pub db: Mutex<Database>,
    pub plugins_dir: std::path::PathBuf,
}
```

**Step 3: Update `src-tauri/src/lib.rs`**

Wire the scheduler into the app setup. Add `refresh_plugin` to `invoke_handler`. Store `plugins_dir` in `AppState`. Call `start_polling` in the setup closure.

```rust
mod scheduler;

// In setup closure:
let plugins_dir = app.path().resource_dir()
    .expect("failed to get resource dir")
    .join("plugins");

// Manage state with plugins_dir
app.manage(AppState {
    db: std::sync::Mutex::new(db),
    plugins_dir: plugins_dir.clone(),
});

// Start polling (needs Arc<Mutex<Database>> — restructure accordingly)
// For MVP, manual refresh is sufficient. Background polling can be wired later.
```

Note: The exact wiring of `start_polling` requires sharing the `Database` via `Arc<Mutex<>>`. For MVP, prioritize the manual `refresh_plugin` command and add background polling as a follow-up step once the manual flow works end-to-end.

**Step 4: Register the command**

Add `commands::refresh_plugin` to the `invoke_handler!` macro in `lib.rs`.

**Step 5: Verify compilation**

```bash
cd src-tauri && cargo check
```

**Step 6: Commit**

```bash
git add src-tauri/src/scheduler.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add polling scheduler with manual refresh command"
```

---

## Task 6: Frontend — Clean Slate + Design System

**Files:**
- Delete: default React boilerplate (`src/App.tsx`, `src/App.css`, `src/styles.css`)
- Create: `src/styles/theme.css` (CSS variables, fonts, RPG theme)
- Create: `src/App.tsx` (shell layout)
- Create: `src/main.tsx` (entry point — keep or update)
- Modify: `index.html` (add Google Fonts)

**Step 1: Update `index.html` to load fonts**

Add to `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200;400;700;800&family=JetBrains+Mono:wght@300;400;600&display=swap" rel="stylesheet">
```

**Step 2: Create `src/styles/theme.css`**

Define CSS variables for the RPG dark theme:

```css
:root {
  /* -- Background layers -- */
  --bg-deep: #0a0b0f;
  --bg-base: #12141c;
  --bg-surface: #1a1d2b;
  --bg-elevated: #232738;
  --bg-hover: #2c3148;

  /* -- Borders -- */
  --border-subtle: #2a2e42;
  --border-default: #3d4260;
  --border-ornate: #5c4f2e;

  /* -- Text -- */
  --text-primary: #e8e4d9;
  --text-secondary: #9a9585;
  --text-muted: #5e5a4e;

  /* -- Source accent colors -- */
  --color-jira: #4c9aff;
  --color-gmail: #ea4335;
  --color-slack: #7c3aed;
  --color-github: #3fb950;

  /* -- Urgency colors -- */
  --urgency-low: #5e5a4e;
  --urgency-medium: #d4a843;
  --urgency-high: #e67e22;
  --urgency-critical: #e74c3c;

  /* -- Typography -- */
  --font-display: 'Bricolage Grotesque', serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* -- Spacing -- */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* -- Radii -- */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  background: var(--bg-deep);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg-base);
}
::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 3px;
}

/* Ornate panel borders (RPG aesthetic) */
.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.panel-ornate {
  background: var(--bg-surface);
  border: 1px solid var(--border-ornate);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 0 rgba(212, 168, 67, 0.05),
              0 2px 8px rgba(0, 0, 0, 0.3);
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 800;
  color: var(--text-primary);
}
```

**Step 3: Create minimal `src/App.tsx` with 3-panel layout**

```tsx
import { useState } from "react";
import "./styles/theme.css";

type Source = "all" | "jira" | "gmail" | "slack" | "github";

function App() {
  const [activeSource, setActiveSource] = useState<Source>("all");

  const sources: { id: Source; label: string; color: string }[] = [
    { id: "all", label: "All", color: "var(--text-primary)" },
    { id: "jira", label: "Jira", color: "var(--color-jira)" },
    { id: "gmail", label: "Gmail", color: "var(--color-gmail)" },
    { id: "slack", label: "Slack", color: "var(--color-slack)" },
    { id: "github", label: "GitHub", color: "var(--color-github)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-sm) var(--space-md)",
        borderBottom: "1px solid var(--border-ornate)",
        background: "var(--bg-base)",
      }}>
        <h1 style={{ fontSize: "18px", letterSpacing: "0.05em" }}>
          Nexus Hub
        </h1>
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <button style={headerBtnStyle}>Refresh</button>
          <button style={headerBtnStyle}>Settings</button>
        </div>
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{
          width: "180px",
          padding: "var(--space-md)",
          borderRight: "1px solid var(--border-subtle)",
          background: "var(--bg-base)",
        }}>
          <h3 style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "var(--space-sm)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Sources
          </h3>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSource(s.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "var(--space-xs) var(--space-sm)",
                marginBottom: "2px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                color: activeSource === s.id ? s.color : "var(--text-secondary)",
                background: activeSource === s.id ? "var(--bg-elevated)" : "transparent",
              }}
            >
              {s.label}
            </button>
          ))}
        </aside>

        {/* Feed */}
        <main style={{
          flex: 1,
          padding: "var(--space-md)",
          overflowY: "auto",
        }}>
          <p style={{ color: "var(--text-muted)" }}>
            No items yet. Configure a plugin in Settings and click Refresh.
          </p>
        </main>

        {/* Detail panel */}
        <aside style={{
          width: "320px",
          padding: "var(--space-md)",
          borderLeft: "1px solid var(--border-subtle)",
          background: "var(--bg-base)",
        }}>
          <p style={{ color: "var(--text-muted)" }}>Select an item to see details.</p>
        </aside>
      </div>

      {/* Status bar */}
      <footer style={{
        padding: "var(--space-xs) var(--space-md)",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--bg-base)",
        fontSize: "11px",
        color: "var(--text-muted)",
      }}>
        Ready
      </footer>
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: "4px 12px",
  border: "1px solid var(--border-ornate)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  cursor: "pointer",
};

export default App;
```

**Step 4: Remove default boilerplate files**

```bash
rm -f src/App.css src/assets/react.svg
```

Update `src/main.tsx` to only import React + App (remove any CSS imports for deleted files).

**Step 5: Verify the app renders**

```bash
pnpm tauri dev
```

Expected: Dark-themed 3-panel layout with "Nexus Hub" header. No data yet — just the shell.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add RPG dark theme and 3-panel dashboard layout"
```

---

## Task 7: Frontend — Feed Component + Tauri IPC

**Files:**
- Create: `src/components/FeedItem.tsx`
- Create: `src/components/Feed.tsx`
- Create: `src/hooks/useItems.ts`
- Modify: `src/App.tsx` (integrate Feed)

**Step 1: Create `src/hooks/useItems.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface NexusItem {
  id: string;
  source: string;
  source_id: string;
  item_type: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  timestamp: number;
  priority: number;
  metadata: string | null;
  tags: string | null;
  is_read: boolean;
  created_at: number;
  updated_at: number;
}

export function useItems(source: string | null, unreadOnly: boolean) {
  const [items, setItems] = useState<NexusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<NexusItem[]>("get_items", {
        source: source === "all" ? null : source,
        unreadOnly,
        limit: 100,
      });
      setItems(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [source, unreadOnly]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const unlisten = listen("items-updated", () => {
      fetchItems();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchItems]);

  const refresh = useCallback(async (pluginId: string) => {
    setLoading(true);
    try {
      await invoke("refresh_plugin", { pluginId });
      await fetchItems();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  const markRead = useCallback(async (itemId: string, read: boolean) => {
    await invoke("mark_read", { itemId, read });
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, is_read: read } : item))
    );
  }, []);

  return { items, loading, error, refresh, markRead };
}
```

**Step 2: Create `src/components/FeedItem.tsx`**

```tsx
import type { NexusItem } from "../hooks/useItems";

const sourceColors: Record<string, string> = {
  jira: "var(--color-jira)",
  gmail: "var(--color-gmail)",
  slack: "var(--color-slack)",
  github: "var(--color-github)",
};

const urgencyColors: Record<string, string> = {
  low: "var(--urgency-low)",
  medium: "var(--urgency-medium)",
  high: "var(--urgency-high)",
  critical: "var(--urgency-critical)",
};

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface Props {
  item: NexusItem;
  isSelected: boolean;
  onClick: () => void;
}

export function FeedItem({ item, isSelected, onClick }: Props) {
  const metadata = item.metadata ? JSON.parse(item.metadata) : {};
  const accentColor = sourceColors[item.source] || "var(--text-secondary)";

  return (
    <div
      onClick={onClick}
      style={{
        padding: "var(--space-sm) var(--space-md)",
        borderLeft: `3px solid ${accentColor}`,
        marginBottom: "var(--space-xs)",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
        opacity: item.is_read ? 0.6 : 1,
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
        <span style={{ fontSize: "10px", color: accentColor, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
          {item.source}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {timeAgo(item.timestamp)}
        </span>
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: item.is_read ? 400 : 600 }}>
        {item.title}
      </div>
      {item.summary && (
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.summary}
        </div>
      )}
      {metadata.status && (
        <div style={{ marginTop: "4px" }}>
          <span style={{
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: "3px",
            background: "var(--bg-hover)",
            color: "var(--text-secondary)",
          }}>
            {metadata.status}
          </span>
          {metadata.priority && (
            <span style={{
              fontSize: "10px",
              padding: "1px 6px",
              borderRadius: "3px",
              background: "var(--bg-hover)",
              color: urgencyColors[metadata.priority?.toLowerCase()] || "var(--text-secondary)",
              marginLeft: "4px",
            }}>
              {metadata.priority}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create `src/components/Feed.tsx`**

```tsx
import { FeedItem } from "./FeedItem";
import type { NexusItem } from "../hooks/useItems";

interface Props {
  items: NexusItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (item: NexusItem) => void;
}

export function Feed({ items, loading, error, selectedId, onSelect }: Props) {
  if (loading && items.length === 0) {
    return (
      <div style={{ padding: "var(--space-lg)", color: "var(--text-muted)", textAlign: "center" }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--space-lg)", color: "var(--urgency-high)" }}>
        Error: {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: "var(--space-lg)", color: "var(--text-muted)", textAlign: "center" }}>
        No items yet. Configure a plugin in Settings, then click Refresh.
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => (
        <FeedItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedId}
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  );
}
```

**Step 4: Update `src/App.tsx` to use Feed**

Import and render `<Feed />` in the main panel. Pass `items`, `loading`, `error` from `useItems` hook. Track `selectedItem` state.

**Step 5: Verify**

```bash
pnpm tauri dev
```

Expected: App shows empty state message. No items because no plugin is configured yet.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add feed component with Tauri IPC integration"
```

---

## Task 8: Frontend — Detail Panel

**Files:**
- Create: `src/components/DetailPanel.tsx`
- Modify: `src/App.tsx` (integrate)

**Step 1: Create `src/components/DetailPanel.tsx`**

```tsx
import type { NexusItem } from "../hooks/useItems";

interface Props {
  item: NexusItem | null;
  onMarkRead: (id: string, read: boolean) => void;
  onOpenUrl: (url: string) => void;
}

export function DetailPanel({ item, onMarkRead, onOpenUrl }: Props) {
  if (!item) {
    return (
      <div style={{ padding: "var(--space-lg)", color: "var(--text-muted)" }}>
        Select an item to see details.
      </div>
    );
  }

  const metadata = item.metadata ? JSON.parse(item.metadata) : {};
  const tags = item.tags ? JSON.parse(item.tags) : [];

  return (
    <div style={{ padding: "var(--space-md)", overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: "16px", marginBottom: "var(--space-md)", lineHeight: 1.3 }}>
        {item.title}
      </h2>

      {/* Metadata grid */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-xs) var(--space-md)", fontSize: "12px", marginBottom: "var(--space-md)" }}>
        {item.author && (
          <>
            <span style={{ color: "var(--text-muted)" }}>Author</span>
            <span>{item.author}</span>
          </>
        )}
        {metadata.status && (
          <>
            <span style={{ color: "var(--text-muted)" }}>Status</span>
            <span>{metadata.status}</span>
          </>
        )}
        {metadata.priority && (
          <>
            <span style={{ color: "var(--text-muted)" }}>Priority</span>
            <span>{metadata.priority}</span>
          </>
        )}
        {metadata.assignee && (
          <>
            <span style={{ color: "var(--text-muted)" }}>Assignee</span>
            <span>{metadata.assignee}</span>
          </>
        )}
        {metadata.duedate && (
          <>
            <span style={{ color: "var(--text-muted)" }}>Due</span>
            <span>{metadata.duedate}</span>
          </>
        )}
      </div>

      {/* Summary */}
      {item.summary && (
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "var(--space-md)", padding: "var(--space-sm)", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }}>
          {item.summary}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
          {tags.map((tag: string) => (
            <span key={tag} style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-hover)",
              color: "var(--text-secondary)",
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        <button
          onClick={() => onOpenUrl(item.url)}
          style={{
            padding: "6px 16px",
            border: "1px solid var(--border-ornate)",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Open in {item.source}
        </button>
        <button
          onClick={() => onMarkRead(item.id, !item.is_read)}
          style={{
            padding: "6px 16px",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {item.is_read ? "Mark unread" : "Mark read"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Integrate into `src/App.tsx`**

Import `DetailPanel`. Add `selectedItem` state. Pass `onOpenUrl` using `@tauri-apps/plugin-opener`:

```typescript
import { openUrl } from "@tauri-apps/plugin-opener";
```

**Step 3: Verify**

```bash
pnpm tauri dev
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add detail panel with metadata display and actions"
```

---

## Task 9: Frontend — Settings Panel (Plugin Configuration)

**Files:**
- Create: `src/components/Settings.tsx`
- Modify: `src/App.tsx` (add settings view toggle)

**Step 1: Create `src/components/Settings.tsx`**

A form to configure Jira credentials (base URL, email, API token) and polling interval. Calls `save_plugin_config` Tauri command.

```tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PluginConfig {
  plugin_id: string;
  is_enabled: boolean;
  credentials: string | null;
  poll_interval_secs: number;
  last_poll_at: number | null;
  last_error: string | null;
  error_count: number;
  settings: string | null;
}

interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export function Settings() {
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [pollInterval, setPollInterval] = useState(600);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await invoke<PluginConfig | null>("get_plugin_config", { pluginId: "jira" });
      if (config?.credentials) {
        const creds: JiraCredentials = JSON.parse(config.credentials);
        setBaseUrl(creds.baseUrl || "");
        setEmail(creds.email || "");
        setApiToken(creds.apiToken || "");
      }
      if (config) {
        setPollInterval(config.poll_interval_secs);
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage(null);
    try {
      const credentials: JiraCredentials = { baseUrl, email, apiToken };
      const config: PluginConfig = {
        plugin_id: "jira",
        is_enabled: true,
        credentials: JSON.stringify(credentials),
        poll_interval_secs: pollInterval,
        last_poll_at: null,
        last_error: null,
        error_count: 0,
        settings: null,
      };
      await invoke("save_plugin_config", { config });
      setMessage("Saved successfully!");
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-deep)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    color: "var(--text-muted)",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ padding: "var(--space-lg)", maxWidth: "500px" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "var(--space-lg)" }}>
        Settings
      </h2>

      <div className="panel-ornate" style={{ padding: "var(--space-md)", marginBottom: "var(--space-md)" }}>
        <h3 style={{ fontSize: "14px", marginBottom: "var(--space-md)", color: "var(--color-jira)" }}>
          Jira Configuration
        </h3>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <label style={labelStyle}>Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://mycompany.atlassian.net"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <label style={labelStyle}>API Token</label>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Your Jira API token"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <label style={labelStyle}>Poll Interval (seconds)</label>
          <input
            type="number"
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            min={60}
            max={3600}
            style={{ ...inputStyle, width: "120px" }}
          />
        </div>

        <button
          onClick={saveConfig}
          disabled={saving}
          style={{
            padding: "8px 24px",
            border: "1px solid var(--border-ornate)",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>

        {message && (
          <p style={{
            marginTop: "var(--space-sm)",
            fontSize: "12px",
            color: message.startsWith("Error") ? "var(--urgency-high)" : "var(--color-github)",
          }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add view switching in `src/App.tsx`**

Add a `view` state (`"dashboard" | "settings"`). The Settings button in the header toggles it. Render `<Settings />` or `<Feed />` + `<DetailPanel />` based on view.

**Step 3: Verify**

```bash
pnpm tauri dev
```

Expected: Clicking "Settings" shows the Jira config form. Filling it and clicking Save should persist to SQLite.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add settings panel for Jira plugin configuration"
```

---

## Task 10: Native Notifications (Tauri Plugin)

**Files:**
- Modify: `src-tauri/Cargo.toml` (add tauri-plugin-notification)
- Create: `src-tauri/src/notifications.rs`
- Modify: `src-tauri/src/lib.rs` (register plugin)
- Modify: `src-tauri/capabilities/default.json` (add notification permission)

**Step 1: Add the notification plugin**

```bash
cd src-tauri
cargo add tauri-plugin-notification
cd ..
pnpm add @tauri-apps/plugin-notification
```

**Step 2: Create `src-tauri/src/notifications.rs`**

```rust
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use crate::models::Notification;

pub fn send_native_notification(app: &AppHandle, notif: &Notification, title: &str) {
    let urgency_label = match notif.urgency.as_str() {
        "critical" => "[CRITICAL]",
        "high" => "[HIGH]",
        "medium" => "",
        _ => return, // Don't send native notifs for "low"
    };

    let notif_title = if urgency_label.is_empty() {
        title.to_string()
    } else {
        format!("{} {}", urgency_label, title)
    };

    let _ = app.notification()
        .builder()
        .title(&notif_title)
        .body(&notif.reason.replace(",", ", "))
        .show();
}
```

**Step 3: Register plugin in `src-tauri/src/lib.rs`**

```rust
.plugin(tauri_plugin_notification::init())
```

**Step 4: Add capability permission**

In `src-tauri/capabilities/default.json`, add `"notification:default"` to the permissions array.

**Step 5: Wire notifications into the scheduler**

After inserting notifications in `scheduler.rs`, call `send_native_notification` for `medium`+ urgency notifications.

**Step 6: Verify**

```bash
pnpm tauri dev
```

Configure Jira credentials, click Refresh. If your Jira has assigned tickets, you should see a native notification for high-priority items.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add native OS notifications for high-priority items"
```

---

## Task 11: End-to-End Integration Test

**Files:**
- Verify the full flow works manually

**Step 1: Run the app**

```bash
pnpm tauri dev
```

**Step 2: Manual test checklist**

1. App opens with dark RPG theme, 3-panel layout
2. Go to Settings → fill Jira credentials → Save → success message
3. Go back to Dashboard → click Refresh
4. Feed populates with Jira tickets (if credentials are valid)
5. Click a ticket → detail panel shows metadata
6. Click "Open in jira" → opens browser to Jira ticket
7. Click "Mark read" → item opacity decreases
8. Native notification appears for high-priority tickets

**Step 3: Fix any issues found**

If any step fails, fix the bug before proceeding.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```

---

## Task 12: Polish and Cleanup

**Files:**
- Update: `src-tauri/tauri.conf.json` (finalize bundle config)
- Create: `README.md` (only if requested by user)

**Step 1: Update Tauri config for production**

Ensure `tauri.conf.json` has correct:
- `productName`
- `identifier`
- Window dimensions
- Bundle settings for the target platform

**Step 2: Build a release binary**

```bash
pnpm tauri build
```

Expected: Produces a distributable binary in `src-tauri/target/release/bundle/`.

**Step 3: Verify the built binary runs**

Run the binary from the bundle output directory. Verify it works the same as dev mode.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: finalize build config and cleanup for MVP release"
```

---

## Summary

| Task | What It Builds | Key Files |
|---|---|---|
| 1 | Project scaffold | Tauri + React + Vite + pnpm |
| 2 | SQLite database layer | `db.rs`, `models.rs` |
| 3 | Tauri IPC commands | `commands.rs` |
| 4 | Plugin runtime + Jira plugin | `plugin_runtime.rs`, `jira.ts` |
| 5 | Polling scheduler | `scheduler.rs` |
| 6 | Design system + layout shell | `theme.css`, `App.tsx` |
| 7 | Feed component + data hooks | `Feed.tsx`, `useItems.ts` |
| 8 | Detail panel | `DetailPanel.tsx` |
| 9 | Settings panel | `Settings.tsx` |
| 10 | Native notifications | `notifications.rs` |
| 11 | E2E integration test | Manual verification |
| 12 | Polish + build | `tauri.conf.json`, release binary |
