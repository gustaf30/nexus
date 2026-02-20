import { FeedItem } from "./FeedItem";
import type { NexusItem } from "../types";

interface Props {
  items: NexusItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (item: NexusItem) => void;
}

export function Feed({ items, loading, error, selectedId, onSelect }: Props) {
  /* ── Skeleton: only when no items have been loaded yet ── */
  if (loading && items.length === 0) {
    return (
      <div style={{ padding: "var(--sp-2) var(--sp-1)" }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{
              height: 58,
              marginBottom: "var(--sp-1)",
              animationDelay: `${i * 80}ms`,
              borderRadius: "var(--radius-md)",
            }}
          />
        ))}
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--sp-2)",
          padding: "var(--sp-6)",
        }}
      >
        <span style={{ fontSize: 28, color: "var(--urgency-high)" }}>⚠</span>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--urgency-high)",
          }}
        >
          Failed to load items
        </p>
        <details
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
            maxWidth: 280,
          }}
        >
          <summary style={{ cursor: "pointer", marginBottom: "var(--sp-1)" }}>Show details</summary>
          <p>{error}</p>
        </details>
      </div>
    );
  }

  /* ── Empty state ── */
  if (items.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--sp-3)",
          padding: "var(--sp-6)",
        }}
      >
        <span style={{ fontSize: 40, color: "var(--text-muted)", lineHeight: 1 }}>◈</span>
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
          Items will appear here when your plugins sync.
        </p>
      </div>
    );
  }

  /* ── Item list ── */
  return (
    <div role="list" aria-live="polite">
      {items.map((item) => (
        <FeedItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedId}
          onClick={() => onSelect(item)}
        />
      ))}

      {/* Inline loading indicator when refreshing with existing items */}
      {loading && (
        <div
          style={{
            padding: "var(--sp-2) var(--sp-4)",
            fontSize: 10,
            fontFamily: "var(--font-data)",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Refreshing…
        </div>
      )}
    </div>
  );
}
