export type UrgencyLevel = "low" | "medium" | "high" | "critical";

/** Map a Jira-style priority name to an urgency tier for visual display. */
export function priorityToUrgency(priority: string): UrgencyLevel {
  const p = priority.toLowerCase();
  if (p === "highest" || p === "blocker") return "critical";
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}
