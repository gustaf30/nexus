import type { NexusItem } from "../hooks/useItems";

/* ── Design system mappings ──────────────────────────────── */

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

const URGENCY_BG: Record<string, string> = {
  low:      "var(--urgency-low-bg)",
  medium:   "var(--urgency-medium-bg)",
  high:     "var(--urgency-high-bg)",
  critical: "var(--urgency-critical-bg)",
};

/** Map Jira priority name → urgency tier for visual display. */
function priorityToUrgency(priority: string): "low" | "medium" | "high" | "critical" {
  const p = priority.toLowerCase();
  if (p === "highest" || p === "blocker") return "critical";
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Component ───────────────────────────────────────────── */

interface Props {
  item: NexusItem;
  isSelected: boolean;
  onClick: () => void;
}

export function FeedItem({ item, isSelected, onClick }: Props) {
  const meta        = item.metadata ? (JSON.parse(item.metadata) as Record<string, string>) : {};
  const sourceColor = SOURCE_COLOR[item.source] ?? "var(--border-dim)";
  const urgency     = meta.priority ? priorityToUrgency(meta.priority) : "low";

  return (
    <div
      className="feed-item"
      data-selected={String(isSelected)}
      onClick={onClick}
      style={{
        "--source-color": sourceColor,
        padding: "var(--sp-2) var(--sp-3)",
        opacity: item.is_read ? 0.55 : 1,
      } as React.CSSProperties}
    >
      {/* ── Top row: urgency dot · source tag · id · priority badge · timestamp ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 3,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", minWidth: 0 }}>
          {/* Urgency dot */}
          <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0 }}>
            <circle cx="3" cy="3" r="3" fill={URGENCY_COLOR[urgency]} />
          </svg>

          {/* Source tag */}
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              fontWeight: 600,
              color: sourceColor,
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            [{item.source.toUpperCase()}]
          </span>

          {/* Source ID */}
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.source_id}
          </span>

          {/* Priority badge — only for medium and above */}
          {meta.priority && urgency !== "low" && (
            <span
              className="urgency-badge"
              data-urgency={urgency}
              style={{
                color: URGENCY_COLOR[urgency],
                background: URGENCY_BG[urgency],
                flexShrink: 0,
              }}
            >
              {meta.priority}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            color: "var(--text-muted)",
            flexShrink: 0,
            marginLeft: "var(--sp-2)",
          }}
        >
          {timeAgo(item.timestamp)}
        </span>
      </div>

      {/* ── Title ── */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: item.is_read ? 400 : 600,
          color: item.is_read ? "var(--text-secondary)" : "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.4,
        }}
      >
        {item.title}
      </div>

      {/* ── Summary (optional second line) ── */}
      {item.summary && (
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.4,
          }}
        >
          {item.summary}
        </div>
      )}
    </div>
  );
}
