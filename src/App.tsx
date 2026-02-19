import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bell, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import "./styles/theme.css";

import { useItems, type NexusItem } from "./hooks/useItems";
import { Feed } from "./components/Feed";
import { DetailPanel } from "./components/DetailPanel";
import { Settings } from "./components/Settings";

type View   = "dashboard" | "settings";
type Source = "all" | "jira" | "gmail" | "slack" | "github";

interface PluginConfig {
  plugin_id: string;
  is_enabled: boolean;
  credentials: string | null;
  poll_interval_secs: number;
  last_poll_at: number | null;
}

const SOURCES: { id: Source; label: string; color: string }[] = [
  { id: "all",    label: "All",    color: "var(--text-primary)" },
  { id: "jira",   label: "Jira",   color: "var(--source-jira)" },
  { id: "gmail",  label: "Gmail",  color: "var(--source-gmail)" },
  { id: "slack",  label: "Slack",  color: "var(--source-slack)" },
  { id: "github", label: "GitHub", color: "var(--source-github)" },
];

/* ── Root ─────────────────────────────────────────────────── */

export default function App() {
  const [view, setView]               = useState<View>("dashboard");
  const [activeSource, setActiveSource] = useState<Source>("all");
  const [unreadOnly, setUnreadOnly]   = useState(false);
  const [selectedItem, setSelectedItem] = useState<NexusItem | null>(null);
  const [pluginConfigs, setPluginConfigs] = useState<PluginConfig[]>([]);

  const source = activeSource === "all" ? null : activeSource;
  const { items, loading, error, refresh, refreshAll, markRead } = useItems(source, unreadOnly);

  const ALL_PLUGINS = ["jira", "github", "gmail"] as const;

  useEffect(() => {
    loadAllConfigs();
  }, []);

  /* ── Disable browser context menu (desktop app) ── */
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+R — refresh plugins
      if (mod && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }

      // Ctrl+, — toggle settings
      if (mod && e.key === ",") {
        e.preventDefault();
        setView((v) => (v === "settings" ? "dashboard" : "settings"));
      }

      // Escape — deselect item or close settings
      if (e.key === "Escape") {
        if (view === "settings") {
          setView("dashboard");
        } else {
          setSelectedItem(null);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, source, loading]);

  // Reload configs when returning from settings so status bar updates immediately.
  useEffect(() => {
    if (view === "dashboard") loadAllConfigs();
  }, [view]);

  async function loadAllConfigs() {
    const configs: PluginConfig[] = [];
    for (const pluginId of ALL_PLUGINS) {
      try {
        const config = await invoke<PluginConfig | null>("get_plugin_config", { pluginId });
        if (config) configs.push(config);
      } catch {
        // no-op
      }
    }
    setPluginConfigs(configs);
  }

  const handleRefresh = () => {
    if (source) {
      refresh(source);
    } else {
      refreshAll([...ALL_PLUGINS]);
    }
  };

  const activePlugins = pluginConfigs.filter((c) => c.is_enabled && c.credentials).length;
  const lastSyncAt    = pluginConfigs.reduce<number | null>((latest, c) => {
    if (c.last_poll_at === null) return latest;
    return latest === null ? c.last_poll_at : Math.max(latest, c.last_poll_at);
  }, null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Titlebar
        view={view}
        loading={loading}
        onToggleSettings={() =>
          setView((v) => (v === "settings" ? "dashboard" : "settings"))
        }
        onRefresh={handleRefresh}
      />

      {view === "dashboard" ? (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar
            activeSource={activeSource}
            onSourceChange={(s) => {
              setActiveSource(s);
              setSelectedItem(null);
            }}
            unreadOnly={unreadOnly}
            onUnreadOnlyChange={setUnreadOnly}
          />

          <main
            className="feed-panel"
            style={{ flex: 1, minWidth: 320, overflowY: "auto", display: "flex", flexDirection: "column" }}
          >
            <Feed
              items={items}
              loading={loading}
              error={error}
              selectedId={selectedItem?.id ?? null}
              onSelect={setSelectedItem}
            />
          </main>

          <DetailPanel item={selectedItem} onMarkRead={markRead} />
        </div>
      ) : (
        <Settings onBack={() => setView("dashboard")} />
      )}

      <StatusBar activePlugins={activePlugins} lastSyncAt={lastSyncAt} />
    </div>
  );
}

/* ── Titlebar ─────────────────────────────────────────────── */

function Titlebar({
  view,
  loading,
  onToggleSettings,
  onRefresh,
}: {
  view: View;
  loading: boolean;
  onToggleSettings: () => void;
  onRefresh: () => void;
}) {
  return (
    <header
      style={{
        height: 36,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--sp-4)",
        background: "var(--bg-void)",
        borderBottom: "1px solid var(--border-mid)",
      }}
    >
      {/* Sigil + App name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 15,
            color: "var(--accent-primary)",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          ◈
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            userSelect: "none",
          }}
        >
          NEXUS HUB
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
        <IconButton label="Notifications" icon={<Bell size={15} />} />
        <IconButton
          label={view === "settings" ? "Dashboard" : "Settings"}
          icon={<SettingsIcon size={15} />}
          active={view === "settings"}
          onClick={onToggleSettings}
        />
        <IconButton
          label="Refresh all plugins"
          icon={
            <RefreshCw
              size={15}
              style={loading ? { animation: "spin 1s linear infinite" } : undefined}
            />
          }
          onClick={onRefresh}
          disabled={loading}
        />
      </div>
    </header>
  );
}

/* ── Sidebar ──────────────────────────────────────────────── */

function Sidebar({
  activeSource,
  onSourceChange,
  unreadOnly,
  onUnreadOnlyChange,
}: {
  activeSource: Source;
  onSourceChange: (s: Source) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (v: boolean) => void;
}) {
  return (
    <aside
      style={{
        width: 180,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-dim)",
        overflowY: "auto",
      }}
    >
      <div className="section-header">Sources</div>

      <div style={{ padding: "var(--sp-1) var(--sp-2)" }}>
        {SOURCES.map((s) => {
          const isActive = activeSource === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSourceChange(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                width: "100%",
                height: 28,
                padding: "0 var(--sp-3)",
                borderRadius: "var(--radius-md)",
                textAlign: "left",
                fontSize: 12,
                fontFamily: "var(--font-data)",
                color: isActive ? s.color : "var(--text-secondary)",
                background: isActive ? "var(--bg-raised)" : "transparent",
                transition:
                  "background var(--transition-fast), color var(--transition-fast)",
              }}
            >
              <svg width="7" height="7" viewBox="0 0 7 7" style={{ flexShrink: 0 }}>
                <circle
                  cx="3.5"
                  cy="3.5"
                  r="3.5"
                  fill={s.color}
                  opacity={isActive ? 1 : 0.4}
                />
              </svg>
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="section-header" style={{ marginTop: "var(--sp-2)" }}>
        Filters
      </div>

      <div style={{ padding: "var(--sp-1) var(--sp-2)" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            height: 28,
            padding: "0 var(--sp-3)",
            fontSize: 12,
            color: unreadOnly ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "pointer",
            borderRadius: "var(--radius-md)",
          }}
        >
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => onUnreadOnlyChange(e.target.checked)}
            style={{ accentColor: "var(--accent-primary)", cursor: "pointer" }}
          />
          Unread only
        </label>

        {(["Critical only", "Today"] as const).map((label) => (
          <label
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              height: 28,
              padding: "0 var(--sp-3)",
              fontSize: 12,
              color: "var(--text-muted)",
              cursor: "not-allowed",
              borderRadius: "var(--radius-md)",
              opacity: 0.5,
            }}
          >
            <input type="checkbox" disabled style={{ cursor: "not-allowed" }} />
            {label}
          </label>
        ))}
      </div>
    </aside>
  );
}

/* ── Status bar ───────────────────────────────────────────── */

function timeAgoShort(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusBar({ activePlugins, lastSyncAt }: { activePlugins: number; lastSyncAt: number | null }) {
  const syncLabel = lastSyncAt !== null ? `◷ Synced ${timeAgoShort(lastSyncAt)}` : "◷ No sync yet";
  const pluginsLabel = `${activePlugins} plugin${activePlugins !== 1 ? "s" : ""} active`;

  return (
    <footer
      style={{
        height: 24,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 var(--sp-3)",
        background: "var(--bg-void)",
        borderTop: "1px solid var(--border-dim)",
        fontSize: 10,
        fontFamily: "var(--font-data)",
        color: "var(--text-muted)",
        gap: "var(--sp-3)",
      }}
    >
      <span>{syncLabel}</span>
      <span style={{ color: "var(--border-mid)" }}>·</span>
      <span style={{ color: activePlugins > 0 ? "var(--accent-primary)" : "var(--text-muted)" }}>
        {pluginsLabel}
      </span>
    </footer>
  );
}

/* ── Icon button ──────────────────────────────────────────── */

function IconButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "var(--radius-md)",
        color: active ? "var(--accent-primary)" : "var(--text-muted)",
        background: active ? "var(--bg-raised)" : "transparent",
        transition: "color var(--transition-fast), background var(--transition-fast)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
      }}
    >
      {icon}
    </button>
  );
}
