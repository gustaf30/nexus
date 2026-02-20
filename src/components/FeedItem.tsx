import type { NexusItem } from "../types";
import { SOURCE_COLOR, URGENCY_COLOR, URGENCY_BG } from "../constants/design";
import { priorityToUrgency } from "../utils/urgency";
import { timeAgo } from "../utils/time";
import { safeParseJson } from "../utils/json";

/* ── Component ───────────────────────────────────────────── */

interface Props {
  item: NexusItem;
  isSelected: boolean;
  onClick: () => void;
}

export function FeedItem({ item, isSelected, onClick }: Props) {
  const meta        = safeParseJson<Record<string, string>>(item.metadata, {});
  const sourceColor = SOURCE_COLOR[item.source] ?? "var(--border-dim)";
  const urgency     = meta.priority ? priorityToUrgency(meta.priority) : "low";

  return (
    <div
      className="feed-item"
      role="listitem"
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
          <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0 }} aria-label={`Urgency: ${urgency}`}>
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
