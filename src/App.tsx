import { useState } from "react";
import { Bell, RefreshCw, Settings } from "lucide-react";
import "./styles/theme.css";

import { useItems, type NexusItem } from "./hooks/useItems";
import { Feed } from "./components/Feed";

type View   = "dashboard" | "settings";
type Source = "all" | "jira" | "gmail" | "slack" | "github";

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

  const source = activeSource === "all" ? null : activeSource;
  const { items, loading, error, refresh, markRead } = useItems(source, unreadOnly);

  const handleRefresh = () => refresh("jira");

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
        <SettingsPlaceholder onBack={() => setView("dashboard")} />
      )}

      <StatusBar />
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
          icon={<Settings size={15} />}
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

/* ── Detail panel (placeholder — fully implemented in Task 8) */

function DetailPanel({
  item,
  onMarkRead,
}: {
  item: NexusItem | null;
  onMarkRead: (id: string, read: boolean) => void;
}) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-dim)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {item ? (
        <div style={{ padding: "var(--sp-4)" }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "var(--sp-2)",
              lineHeight: 1.4,
            }}
          >
            {item.title}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--sp-4)" }}>
            {item.source_id} · {item.source}
          </p>
          <button
            onClick={() => onMarkRead(item.id, !item.is_read)}
            style={{
              padding: "5px 12px",
              border: "1px solid var(--border-mid)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-raised)",
              color: "var(--text-secondary)",
              fontSize: 11,
              fontFamily: "var(--font-data)",
              cursor: "pointer",
            }}
          >
            {item.is_read ? "Mark unread" : "Mark read"}
          </button>
          <p
            style={{
              marginTop: "var(--sp-6)",
              fontSize: 10,
              color: "var(--text-muted)",
              fontFamily: "var(--font-data)",
            }}
          >
            Full detail panel — Task 8
          </p>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "var(--text-muted)",
            padding: "var(--sp-4)",
            textAlign: "center",
          }}
        >
          Select an item to see details.
        </div>
      )}
    </aside>
  );
}

/* ── Settings placeholder ─────────────────────────────────── */

function SettingsPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        padding: "var(--sp-6)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: "var(--sp-4)",
        }}
      >
        Settings
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
        Plugin configuration — Task 9.
      </p>
      <button
        onClick={onBack}
        style={{
          marginTop: "var(--sp-4)",
          padding: "6px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-mid)",
          background: "var(--bg-raised)",
          color: "var(--text-secondary)",
          fontSize: 12,
          fontFamily: "var(--font-data)",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        ← Back to dashboard
      </button>
    </div>
  );
}

/* ── Status bar ───────────────────────────────────────────── */

function StatusBar() {
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
      <span>◷ No sync yet</span>
      <span style={{ color: "var(--border-mid)" }}>·</span>
      <span>0 plugins active</span>
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
