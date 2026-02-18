import { ExternalLink, Check } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { NexusItem } from "../hooks/useItems";

/* ── Design system helpers ───────────────────────────────── */

const SOURCE_COLOR: Record<string, string> = {
  jira:   "var(--source-jira)",
  gmail:  "var(--source-gmail)",
  slack:  "var(--source-slack)",
  github: "var(--source-github)",
};

const URGENCY_COLOR: Record<string, string> = {
  low:      "var(--urgency-low)",
  medium:   "var(--urgency-medium)",
  high:     "var(--urgency-high)",
  critical: "var(--urgency-critical)",
};

function priorityToUrgency(priority: string): "low" | "medium" | "high" | "critical" {
  const p = priority.toLowerCase();
  if (p === "highest" || p === "blocker") return "critical";
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

/** Colorize a due-date string based on how close it is. */
function dueDateColor(duedate: string): string | undefined {
  const due  = new Date(duedate);
  const diff = Math.ceil((due.getTime() - Date.now()) / 86_400_000); // days
  if (diff < 0)  return "var(--urgency-critical)";
  if (diff === 0) return "var(--urgency-high)";
  if (diff <= 2) return "var(--urgency-medium)";
  return undefined; // let MetaRow default to --text-primary
}

/* ── Sub-components ──────────────────────────────────────── */

function MetaRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "76px 1fr",
        gap: "var(--sp-2)",
        marginBottom: "var(--sp-1)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          fontWeight: 500,
          color: "var(--text-muted)",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 12,
          color: color ?? "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── DetailPanel ─────────────────────────────────────────── */

interface Props {
  item: NexusItem | null;
  onMarkRead: (id: string, read: boolean) => void;
}

export function DetailPanel({ item, onMarkRead }: Props) {
  /* ── Empty state ── */
  if (!item) {
    return (
      <aside style={panelStyle}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontFamily: "var(--font-data)",
            color: "var(--text-muted)",
            padding: "var(--sp-4)",
            textAlign: "center",
          }}
        >
          Select an item to see details.
        </div>
      </aside>
    );
  }

  const meta        = item.metadata ? (JSON.parse(item.metadata) as Record<string, string>) : {};
  const tags        = item.tags ? (JSON.parse(item.tags) as string[]) : [];
  const sourceColor = SOURCE_COLOR[item.source] ?? "var(--border-dim)";
  const urgency     = meta.priority ? priorityToUrgency(meta.priority) : "low";
  const assignee    = meta.assignee ?? item.author ?? null;

  const handleOpen = async () => {
    try {
      await openUrl(item.url);
    } catch (e) {
      console.error("openUrl failed:", e);
    }
  };

  return (
    <aside style={panelStyle}>
      {/* ── Header: ID + title ── */}
      <div
        style={{
          padding: "var(--sp-4)",
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            fontWeight: 600,
            color: sourceColor,
            letterSpacing: "0.05em",
            marginBottom: "var(--sp-1)",
          }}
        >
          {item.source_id}
        </p>

        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 800,
            color: "var(--text-primary)",
            lineHeight: 1.3,
            marginBottom: item.summary ? "var(--sp-2)" : 0,
          }}
        >
          {item.title}
        </p>

        {item.summary && (
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              lineHeight: 1.4,
            }}
          >
            {item.summary}
          </p>
        )}
      </div>

      {/* ── Metadata grid ── */}
      <div
        style={{
          padding: "var(--sp-3) var(--sp-4)",
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <div className="section-header" style={{ marginBottom: "var(--sp-3)" }}>
          Details
        </div>

        <MetaRow label="SOURCE" value={item.source.toUpperCase()} color={sourceColor} />

        {meta.status && (
          <MetaRow label="STATUS" value={meta.status} />
        )}

        {meta.priority && (
          <MetaRow
            label="PRIORITY"
            value={meta.priority}
            color={URGENCY_COLOR[urgency]}
          />
        )}

        {assignee && (
          <MetaRow label="ASSIGNED" value={assignee} />
        )}

        {meta.duedate && (
          <MetaRow
            label="DUE"
            value={meta.duedate}
            color={dueDateColor(meta.duedate)}
          />
        )}
      </div>

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <div
          style={{
            padding: "var(--sp-3) var(--sp-4)",
            borderBottom: "1px solid var(--border-dim)",
          }}
        >
          <div className="section-header" style={{ marginBottom: "var(--sp-3)" }}>
            Tags
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1)" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-raised)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions (pinned to bottom) ── */}
      <div
        style={{
          marginTop: "auto",
          padding: "var(--sp-3) var(--sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-2)",
          borderTop: "1px solid var(--border-dim)",
        }}
      >
        {item.url && (
          <button
            onClick={handleOpen}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--sp-2)",
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--accent-primary)",
              color: "var(--text-inverse)",
              border: "none",
              fontSize: 12,
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-primary)")
            }
          >
            <ExternalLink size={13} />
            Open in {item.source}
          </button>
        )}

        <button
          onClick={() => onMarkRead(item.id, !item.is_read)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-2)",
            width: "100%",
            padding: "7px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-raised)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-mid)",
            fontSize: 12,
            fontFamily: "var(--font-data)",
            cursor: "pointer",
            transition:
              "background var(--transition-fast), color var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--bg-overlay)";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--bg-raised)";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-secondary)";
          }}
        >
          <Check size={13} />
          {item.is_read ? "Mark unread" : "Mark read"}
        </button>
      </div>
    </aside>
  );
}

/* ── Shared aside style ──────────────────────────────────── */

const panelStyle: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  background: "var(--bg-surface)",
  borderLeft: "1px solid var(--border-dim)",
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
};
