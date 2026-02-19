# Nexus Hub

**Unified developer dashboard with heuristic-based smart notifications.**

![Platform: Windows + Linux](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue)
![Built with Tauri v2](https://img.shields.io/badge/built%20with-Tauri%20v2-orange)
![Rust](https://img.shields.io/badge/core-Rust-red)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

---

Nexus Hub aggregates Jira, GitHub, and Gmail into a single native desktop window — no browser tabs, no notification fatigue. A weighted heuristic engine (not AI) computes urgency scores from configurable signals, escalating from silent badge to sound to dock blink. Data is stored locally in SQLite; no telemetry, no cloud sync.

The interface follows a Dark Scriptorium aesthetic: dense, keyboard-first, with RPG-inspired urgency tiers (Common → Legendary) that make priority feel visceral rather than bureaucratic.

---

## Layout

<img width="1202" height="797" alt="image" src="https://github.com/user-attachments/assets/32ed6a32-ee52-4088-b75a-56275e1823ba" />

---

## Features

- **Unified feed** — Jira issues, GitHub PRs/reviews, and Gmail threads in one scrollable list
- **Heuristic urgency** — configurable weighted signals compute low / medium / high / critical scores
- **Native OS notifications** — silent badge → notification → sound → dock blink, matching urgency tier
- **Plugin architecture** — TypeScript plugins executed via Deno; add new sources without touching Rust
- **Mark read / open in browser** — per-item actions; state persisted in SQLite
- **Keyboard-first** — `j/k` navigation, `m` mark read, `o` open, `r` refresh, `Escape` close detail
- **Local-only** — all data stored in SQLite, no cloud sync, no telemetry

---

## Prerequisites

| Dependency | Purpose | Install |
|------------|---------|---------|
| Rust stable | Tauri core (compiled binary) | [rustup.rs](https://rustup.rs) |
| Deno v2.x | Plugin runtime — required at runtime | [deno.com/install](https://deno.com/install) |
| Node.js 18+ + pnpm | Frontend build toolchain | [nodejs.org](https://nodejs.org) + `npm i -g pnpm` |
| Linux only: system libs | WebKit, appindicator, SSL, xdo | see below |

**Linux system dependencies (one-liner):**

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libxdo-dev \
  libssl-dev \
  pkg-config
```

Windows requires no additional system dependencies — WebView2 ships with Windows 10/11.

---

## Run in development

```bash
pnpm install
pnpm tauri dev
```

Rust and Deno must both be in `PATH`. In a fresh shell on Linux:

```bash
source ~/.cargo/env   # if rustc not found
```

---

## Plugin setup

Credentials are stored locally in SQLite. Open Settings (⚙ icon) to configure each plugin.

### GitHub

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
2. Required scopes: `repo`, `read:user`, `notifications`
3. In Nexus Hub: **Settings → GitHub** → paste token → Save

### Gmail

1. [Google Cloud Console](https://console.cloud.google.com) → create a project → enable **Gmail API**
2. Create **OAuth 2.0 credentials** (Desktop application type) — note `clientId` and `clientSecret`
3. Get a refresh token via [OAuth Playground](https://developers.google.com/oauthplayground):
   - Scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Exchange authorization code for tokens — copy `refresh_token`
4. In Nexus Hub: **Settings → Gmail** → paste clientId, clientSecret, refreshToken → Save
5. Optional: add comma-separated VIP sender emails (each VIP sender adds +3 urgency weight)

### Jira

1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) → **Create API token**
2. In Nexus Hub: **Settings → Jira** → paste:
   - **Base URL**: `https://yourcompany.atlassian.net`
   - **Email**: your Atlassian account email
   - **API Token**: the token you just created
3. Save — the plugin validates the connection immediately

---

## Notification urgency

Urgency is computed as a sum of active signal weights. Weights are configurable in Settings.

| Score | Level | Behavior |
|-------|-------|---------|
| 0–2 | low | Badge count only |
| 3–5 | medium | Silent OS notification |
| 6–8 | high | Notification + sound |
| 9+ | critical | Sound + dock blink |

**Default signals:**

| Source | Signal | Default weight |
|--------|--------|---------------|
| Jira | Issue assigned to you | +3 |
| Jira | Priority P1 / Blocker | +4 |
| Jira | Deadline within 24h | +3 |
| GitHub | Review requested from you | +4 |
| GitHub | PR merged into your branch | +2 |
| Gmail | Sender in VIP list | +3 |
| Gmail | Unread for more than 4 hours | +1 |
| Gmail | Has attachment | +1 |

---

## Build release binary

```bash
pnpm tauri build
# Output: src-tauri/target/release/bundle/
#   Linux:   *.deb
#   Windows: *.msi
```

---

## Automated releases (GitHub Actions)

Push a version tag to trigger a parallel Windows (.msi) + Linux (.deb) build:

```bash
git tag v0.1.0 && git push --tags
```

The workflow (`.github/workflows/release.yml`) builds on `windows-latest` and `ubuntu-22.04` in parallel and attaches artifacts to a GitHub Release.

Trigger manually without a tag:

```bash
gh workflow run release.yml
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | [Tauri v2](https://v2.tauri.app) |
| Frontend framework | React 19 |
| Frontend language | TypeScript |
| Backend language | Rust (stable) |
| Plugin runtime | Deno v2 |
| Local database | SQLite via rusqlite |
| Async runtime | Tokio |
| Build tool | Vite |
| Package manager | pnpm |
| Test runner | Vitest |
| Icons | Lucide React |
| Fonts | Bricolage Grotesque + JetBrains Mono |

---

## Project layout

```
nexus-hub/
├── src/                        # React frontend
│   ├── components/
│   │   ├── Feed.tsx            # Item list with loading/error/empty states
│   │   ├── FeedItem.tsx        # Single row: source accent bar, urgency badge, time-ago
│   │   ├── DetailPanel.tsx     # Metadata grid, summary, Open + Mark Read actions
│   │   └── Settings.tsx        # Credentials forms per plugin
│   ├── hooks/
│   │   └── useItems.ts         # get_items invoke, items-updated listener, refresh, markRead
│   ├── styles/
│   │   └── theme.css           # CSS custom properties (Dark Scriptorium token set)
│   └── App.tsx                 # 3-panel layout shell, view switching
├── src-tauri/
│   ├── src/
│   │   ├── commands.rs         # #[tauri::command] handlers + AppState
│   │   ├── db.rs               # rusqlite wrapper, all CRUD, seed_default_weights
│   │   ├── lib.rs              # App entry: setup, plugin registration, invoke_handler
│   │   ├── models.rs           # Shared structs: NexusItem, Notification, PluginConfig
│   │   ├── notifications.rs    # tauri-plugin-notification wrapper
│   │   ├── plugin_runtime.rs   # Deno subprocess executor (deno eval)
│   │   └── scheduler.rs        # Tokio polling loop, calls plugin runtime
│   ├── plugins/
│   │   ├── plugin_interface.ts # Shared types: Credentials, NexusItem, PluginResult
│   │   ├── github.ts           # GitHub REST API plugin
│   │   ├── gmail.ts            # Gmail API plugin (OAuth refresh token flow)
│   │   └── jira.ts             # Jira REST API v3 plugin
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       └── release.yml         # Windows .msi + Linux .deb parallel build
└── docs/
    └── plans/                  # Architecture, design system, implementation tasks
```

---

## Adding a plugin

1. Create `src-tauri/plugins/{name}.ts` — export two functions:

```typescript
// Required contract — see plugin_interface.ts
export async function fetch(configJson: string): Promise<string> {
  // parse credentials from configJson
  // call your API
  // return JSON.stringify({ items: NexusItem[], notifications: Notification[] })
}

export async function validateConnection(configJson: string): Promise<string> {
  // return JSON.stringify({ ok: boolean, status: string })
}
```

2. Add a credentials form card to `src/components/Settings.tsx`
3. Register the plugin ID in the `ALL_PLUGINS` list in `src/App.tsx`
4. Add the plugin to the scheduler loop in `src-tauri/src/scheduler.rs`
5. List the plugin file under `bundle.resources` in `src-tauri/tauri.conf.json`

Credentials are passed to plugins via the `NEXUS_CONFIG` environment variable (not as CLI args) to prevent leaking secrets in process listings.
