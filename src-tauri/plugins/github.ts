// GitHub Plugin for Nexus Hub
// Fetches PRs needing review and assigned issues via GitHub REST API v3

import { computeUrgency, fetchWithTimeout, parseCredentials } from "./plugin_interface.ts";
//
// Config JSON shape:
//   { "token": "ghp_xxxx" }
//
// Signals:
//   review_requested  +4  → urgency high (alone)
//   assigned_issue    +2  → low/no notification, but shows in feed

interface GitHubConfig {
  token: string; // Classic PAT or fine-grained PAT with read:user, repo, notifications scopes
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  body: string | null;
  user: { login: string };
  assignees: { login: string }[];
  labels: { name: string }[];
  created_at: string;
  updated_at: string;
  pull_request?: { url: string };
  repository_url: string;
}

interface SearchResult {
  total_count: number;
  items: GitHubIssue[];
}

async function githubGet(token: string, path: string): Promise<unknown> {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

/** Extract "owner/repo" from a repository_url like https://api.github.com/repos/owner/repo */
function repoFromUrl(repositoryUrl: string): string {
  const parts = repositoryUrl.split("/");
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

export async function fetch(configJson: string): Promise<string> {
  const config = parseCredentials<GitHubConfig>(configJson, "GitHub");
  const { token } = config;

  const now = Math.floor(Date.now() / 1000);

  // 1. PRs where review is requested from me
  const reviewPRs = (await githubGet(
    token,
    "/search/issues?q=is:pr+is:open+review-requested:@me&per_page=50&sort=updated",
  )) as SearchResult;

  // 2. Issues assigned to me
  const assignedIssues = (await githubGet(
    token,
    "/search/issues?q=is:issue+is:open+assignee:@me&per_page=50&sort=updated",
  )) as SearchResult;

  // Merge, deduplicate by id
  const seen = new Set<number>();
  const all: Array<{ issue: GitHubIssue; isReviewRequest: boolean }> = [];

  for (const issue of (reviewPRs.items ?? [])) {
    if (!seen.has(issue.id)) {
      seen.add(issue.id);
      all.push({ issue, isReviewRequest: true });
    }
  }
  for (const issue of (assignedIssues.items ?? [])) {
    if (!seen.has(issue.id)) {
      seen.add(issue.id);
      all.push({ issue, isReviewRequest: false });
    }
  }

  const items = all.map(({ issue }) => {
    const repo = repoFromUrl(issue.repository_url);
    const isPR = !!issue.pull_request;
    return {
      id: `github-${issue.id}`,
      source: "github",
      sourceId: String(issue.number),
      type: isPR ? "pr" : "issue",
      title: `[${repo}#${issue.number}] ${issue.title}`,
      summary: issue.body ? issue.body.substring(0, 200) : null,
      url: issue.html_url,
      author: issue.user.login,
      timestamp: Math.floor(new Date(issue.updated_at).getTime() / 1000),
      metadata: {
        repo,
        state: issue.state,
        labels: issue.labels.map((l) => l.name),
        isPR,
      },
      tags: issue.labels.map((l) => l.name),
    };
  });

  const notifications = all
    .map(({ issue, isReviewRequest }) => {
      const signals: Array<{ reason: string; weight: number }> = [];

      if (isReviewRequest) {
        signals.push({ reason: "review_requested", weight: 4 });
      } else {
        // Assigned issue — only a signal, no standalone notification (weight 2 < 3)
        signals.push({ reason: "assigned_issue", weight: 2 });
      }

      const urgency = computeUrgency(signals);

      return {
        itemId: `github-${issue.id}`,
        reason: signals.map((s) => s.reason).join(","),
        urgency,
      };
    })
    .filter((n) => n.urgency !== "low");

  return JSON.stringify({ items, notifications });
}

export async function validateConnection(configJson: string): Promise<string> {
  const config = parseCredentials<GitHubConfig>(configJson, "GitHub");
  try {
    await githubGet(config.token, "/user");
    return JSON.stringify({ ok: true, status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ ok: false, status: 0, error: message });
  }
}
