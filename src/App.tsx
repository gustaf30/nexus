import { useState } from "react";
import { Bell, RefreshCw, Settings } from "lucide-react";
import "./styles/theme.css";

type View = "dashboard" | "settings";
type Source = "all" | "jira" | "gmail" | "slack" | "github";

const SOURCES: { id: Source; label: string; color: string }[] = [
  { id: "all",    label: "All",    color: "var(--text-primary)" },
  { id: "jira",   label: "Jira",   color: "var(--source-jira)" },
  { id: "gmail",  label: "Gmail",  color: "var(--source-gmail)" },
  { id: "slack",  label: "Slack",  color: "var(--source-slack)" },
  { id: "github", label: "GitHub", color: "var(--source-github)" },
];

export default function App() {
  const [view, setView]               = useState<View>("dashboard");
  const [activeSource, setActiveSource] = useState<Source>("all");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Titlebar
        view={view}
        onToggleSettings={() =>
          setView((v) => (v === "settings" ? "dashboard" : "settings"))
        }
      />

      {view === "dashboard" ? (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar activeSource={activeSource} onSourceChange={setActiveSource} />
          <FeedPanel />
          <DetailPanel />
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
  onToggleSettings,
}: {
  view: View;
  onToggleSettings: () => void;
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
      <div style={{ display: "flex", alignItems: "center", gap: var_sp(2) }}>
        <IconButton label="Notifications" icon={<Bell size={15} />} />
        <IconButton
          label={view === "settings" ? "Dashboard" : "Settings"}
          icon={<Settings size={15} />}
          active={view === "settings"}
          onClick={onToggleSettings}
        />
        <IconButton label="Refresh all plugins" icon={<RefreshCw size={15} />} />
      </div>
    </header>
  );
}

/* ── Sidebar ──────────────────────────────────────────────── */

function Sidebar({
  activeSource,
  onSourceChange,
}: {
  activeSource: Source;
  onSourceChange: (s: Source) => void;
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
                gap: var_sp(2),
                width: "100%",
                height: 28,
                padding: "0 var(--sp-3)",
                borderRadius: "var(--radius-md)",
                textAlign: "left",
                fontSize: 12,
                fontFamily: "var(--font-data)",
                color: isActive ? s.color : "var(--text-secondary)",
                background: isActive ? "var(--bg-raised)" : "transparent",
                transition: "background var(--transition-fast), color var(--transition-fast)",
              }}
            >
              {/* Source dot */}
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
        {["Critical only", "Today", "Unread"].map((label) => (
          <label
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: var_sp(2),
              height: 28,
              padding: "0 var(--sp-3)",
              fontSize: 12,
              color: "var(--text-secondary)",
              cursor: "pointer",
              borderRadius: "var(--radius-md)",
            }}
          >
            <input
              type="checkbox"
              style={{ accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            {label}
          </label>
        ))}
      </div>
    </aside>
  );
}

/* ── Feed panel ───────────────────────────────────────────── */

function FeedPanel() {
  return (
    <main
      className="feed-panel"
      style={{
        flex: 1,
        minWidth: 320,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Empty state */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--sp-3)",
          padding: "var(--sp-6)",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ fontSize: 36, color: "var(--text-muted)", lineHeight: 1 }}>
          ◈
        </span>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          All clear, adventurer.
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Configure a plugin in Settings, then click Refresh.
        </p>
      </div>
    </main>
  );
}

/* ── Detail panel ─────────────────────────────────────────── */

function DetailPanel() {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-dim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 11,
        padding: "var(--sp-4)",
        textAlign: "center",
      }}
    >
      Select an item to see details.
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
        Plugin configuration coming in Task 9.
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
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
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
      }}
    >
      {icon}
    </button>
  );
}

/* ── Utility: CSS variable shorthand for gap/padding values ── */
function var_sp(n: 1 | 2 | 3 | 4 | 5 | 6): string {
  return `var(--sp-${n})`;
}
