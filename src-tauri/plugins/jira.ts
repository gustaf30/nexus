// Jira Plugin for Nexus Hub
// Fetches issues assigned to the configured user from Jira REST API v3

interface JiraConfig {
  baseUrl: string;   // e.g. "https://mycompany.atlassian.net"
  email: string;     // Jira account email
  apiToken: string;  // Jira API token
}

// Jira REST API v3 returns description as Atlassian Document Format (ADF), not plain text.
interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: AdfNode | null; // ADF object in API v3, not a plain string
    status: { name: string };
    priority: { name: string; id: string } | null;
    assignee: { displayName: string; emailAddress: string } | null;
    reporter: { displayName: string } | null;
    duedate: string | null;
    updated: string;
    created: string;
    labels: string[];
    comment?: { comments: Array<{ body: string; author: { displayName: string } }> };
  };
}

/** Recursively extract plain text from an ADF node tree. */
function adfToText(node: AdfNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text" && node.text) return node.text;
  if (node.content) return node.content.map(adfToText).join("");
  return "";
}

// Entry point — called by Rust plugin runtime
export async function fetch(configJson: string): Promise<string> {
  const config: JiraConfig = JSON.parse(configJson);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const auth = btoa(`${config.email}:${config.apiToken}`);

  const jql = "assignee = currentUser() AND status != Done ORDER BY updated DESC";

  // Use POST /rest/api/3/search/jql (the current Jira Cloud search endpoint).
  const response = await globalThis.fetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql,
      maxResults: 50,
      fields: ["summary", "description", "status", "priority", "assignee", "reporter", "duedate", "updated", "created", "labels", "comment"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const issues: JiraIssue[] = data.issues || [];

  const now = Math.floor(Date.now() / 1000);

  const items = issues.map((issue) => ({
    id: `jira-${issue.key}`,
    source: "jira",
    sourceId: issue.key,
    type: "ticket",
    title: `[${issue.key}] ${issue.fields.summary}`,
    summary: issue.fields.description
      ? adfToText(issue.fields.description).substring(0, 200) || null
      : null,
    url: `${baseUrl}/browse/${issue.key}`,
    author: issue.fields.reporter?.displayName ?? null,
    timestamp: Math.floor(new Date(issue.fields.updated).getTime() / 1000),
    metadata: {
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name ?? "None",
      priorityId: issue.fields.priority?.id ?? "",
      duedate: issue.fields.duedate,
      assignee: issue.fields.assignee?.displayName ?? null,
    },
    tags: issue.fields.labels,
  }));

  const notifications = issues
    .map((issue) => {
      const signals: Array<{ reason: string; weight: number }> = [];

      // Signal: assigned to me (always true since JQL filters for it)
      signals.push({ reason: "assigned_to_you", weight: 3 });

      // Signal: high priority (P1 or Blocker — priorityId "1" or "2")
      const pId = issue.fields.priority?.id;
      if (pId === "1" || pId === "2") {
        signals.push({ reason: "priority_p1_blocker", weight: 4 });
      }

      // Signal: deadline within 24h
      if (issue.fields.duedate) {
        const due = Math.floor(new Date(issue.fields.duedate).getTime() / 1000);
        if (due - now < 86400 && due > now) {
          signals.push({ reason: "deadline_24h", weight: 3 });
        }
      }

      const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
      let urgency: "low" | "medium" | "high" | "critical";
      if (totalWeight >= 9) urgency = "critical";
      else if (totalWeight >= 6) urgency = "high";
      else if (totalWeight >= 3) urgency = "medium";
      else urgency = "low";

      return {
        itemId: `jira-${issue.key}`,
        reason: signals.map((s) => s.reason).join(","),
        urgency,
      };
    })
    .filter((n) => n.urgency !== "low"); // Only notify for medium+

  return JSON.stringify({ items, notifications });
}

// Validate connection — called by Settings panel before saving credentials
export async function validateConnection(configJson: string): Promise<string> {
  const config: JiraConfig = JSON.parse(configJson);
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const auth = btoa(`${config.email}:${config.apiToken}`);

  const response = await globalThis.fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  return JSON.stringify({ ok: response.ok, status: response.status });
}
