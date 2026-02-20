import { useState, useRef, useEffect } from "react";
import { Bell, X } from "lucide-react";
import type { Notification } from "../types";
import { URGENCY_COLOR, humanizeReason } from "../constants/design";
import { timeAgo } from "../utils/time";

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onOpenItem: (itemId: string) => void;
}

export function NotificationCenter({ notifications, onDismiss, onDismissAll, onOpenItem }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const count = notifications.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-md)",
          color: open ? "var(--accent-primary)" : "var(--text-muted)",
          background: open ? "var(--bg-raised)" : "transparent",
          transition: "color var(--transition-fast), background var(--transition-fast)",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <Bell size={15} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: count > 9 ? 16 : 14,
              height: 14,
              borderRadius: 7,
              background: "var(--urgency-critical)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "var(--font-data)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: 34,
            right: 0,
            width: 340,
            maxHeight: 400,
            overflowY: "auto",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-mid)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "var(--sp-3)",
              borderBottom: "1px solid var(--border-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Notifications
            </span>
            {count > 0 && (
              <button
                onClick={() => { onDismissAll(); setOpen(false); }}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                Dismiss all
              </button>
            )}
          </div>

          {/* Notification list */}
          {count === 0 ? (
            <div
              style={{
                padding: "var(--sp-6) var(--sp-4)",
                textAlign: "center",
                fontFamily: "var(--font-data)",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              No active notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                role="menuitem"
                style={{
                  padding: "var(--sp-2) var(--sp-3)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--sp-2)",
                  borderBottom: "1px solid var(--border-dim)",
                  cursor: "pointer",
                }}
                onClick={() => { onOpenItem(n.item_id); setOpen(false); }}
              >
                {/* Urgency dot */}
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0, marginTop: 4 }}>
                  <circle cx="4" cy="4" r="4" fill={URGENCY_COLOR[n.urgency] ?? "var(--text-muted)"} />
                </svg>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 12,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {humanizeReason(n.reason)}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {timeAgo(n.created_at)}
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  aria-label="Dismiss notification"
                  onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
