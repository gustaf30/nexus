/** Source-specific accent colors (CSS variable references). */
export const SOURCE_COLOR: Record<string, string> = {
  jira:   "var(--source-jira)",
  gmail:  "var(--source-gmail)",
  slack:  "var(--source-slack)",
  github: "var(--source-github)",
};

/** Urgency tier foreground colors. */
export const URGENCY_COLOR: Record<string, string> = {
  low:      "var(--urgency-low)",
  medium:   "var(--urgency-medium)",
  high:     "var(--urgency-high)",
  critical: "var(--urgency-critical)",
};

/** Urgency tier background colors (translucent). */
export const URGENCY_BG: Record<string, string> = {
  low:      "var(--urgency-low-bg)",
  medium:   "var(--urgency-medium-bg)",
  high:     "var(--urgency-high-bg)",
  critical: "var(--urgency-critical-bg)",
};

/** Human-readable labels for notification signal reasons. */
export const REASON_LABELS: Record<string, string> = {
  assigned_to_me: "Assigned to you",
  assigned: "Assigned to you",
  assigned_to_you: "Assigned to you",
  high_priority: "High priority",
  priority_p1_blocker: "High priority",
  deadline_approaching: "Deadline approaching",
  deadline_24h: "Deadline approaching",
  mentioned_in_comment: "You were mentioned",
  mentioned: "You were mentioned",
  vip_sender: "VIP sender",
  unread_over_4h: "Unread for 4+ hours",
  has_attachment: "Has attachment",
  pr_review_requested: "Review requested",
  review_requested: "Review requested",
  ci_failed: "CI failed",
  pr_comment: "Comment on your PR",
  assigned_issue: "Assigned to you",
};

/** Convert a comma-separated reason string to human-readable labels. */
export function humanizeReason(reason: string): string {
  return reason
    .split(",")
    .map((s) => REASON_LABELS[s.trim()] ?? s.trim())
    .join(", ");
}
