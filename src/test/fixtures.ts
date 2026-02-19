import type { NexusItem } from "../hooks/useItems";

const now = Math.floor(Date.now() / 1000);

/** Factory for NexusItem with sensible defaults. Override any field. */
export function makeItem(overrides: Partial<NexusItem> = {}): NexusItem {
  return {
    id: "jira-TEST-1",
    source: "jira",
    source_id: "TEST-1",
    item_type: "ticket",
    title: "[TEST-1] Fix login bug",
    summary: "Users cannot log in with SSO",
    url: "https://myco.atlassian.net/browse/TEST-1",
    author: "Alice",
    timestamp: now - 3600,
    priority: 0,
    metadata: JSON.stringify({
      status: "In Progress",
      priority: "High",
      assignee: "Bob",
      duedate: null,
    }),
    tags: JSON.stringify(["backend", "auth"]),
    is_read: false,
    created_at: now - 7200,
    updated_at: now - 3600,
    ...overrides,
  };
}
