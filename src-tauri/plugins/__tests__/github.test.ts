// Tests for GitHub plugin — src-tauri/plugins/github.ts
import { fetch, validateConnection } from "../github.ts";

const BASE_CONFIG = { token: "ghp_test123" };

function configJson(overrides = {}) {
  return JSON.stringify({ ...BASE_CONFIG, ...overrides });
}

/** Build a GitHubIssue (PR variant by default). */
function makePR(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    number: 42,
    title: "Add feature X",
    html_url: "https://github.com/owner/repo/pull/42",
    state: "open",
    body: "PR description",
    user: { login: "alice" },
    assignees: [{ login: "bob" }],
    labels: [{ name: "enhancement" }],
    created_at: "2026-02-18T10:00:00Z",
    updated_at: "2026-02-19T10:00:00Z",
    pull_request: {
      url: "https://api.github.com/repos/owner/repo/pulls/42",
    },
    repository_url: "https://api.github.com/repos/owner/repo",
    ...overrides,
  };
}

/** Build an issue (no pull_request field). */
function makeIssue(overrides: Record<string, unknown> = {}) {
  const base = makePR(overrides);
  delete (base as any).pull_request;
  return {
    ...base,
    id: 2001,
    number: 99,
    title: "Bug in login",
    html_url: "https://github.com/owner/repo/issues/99",
    body: "Issue body",
    ...overrides,
  };
}

/**
 * Mock globalThis.fetch for GitHub API:
 *  - GET /search/issues?q=is:pr... → reviewPRs
 *  - GET /search/issues?q=is:issue... → assignedIssues
 *  - GET /user → validate connection
 */
function mockGitHubFetch(
  reviewPRs: unknown[],
  assignedIssues: unknown[],
) {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    const urlStr = typeof url === "string" ? url : String(url);

    if (urlStr.includes("/search/issues") && urlStr.includes("is%3Apr") || urlStr.includes("is:pr")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            total_count: reviewPRs.length,
            items: reviewPRs,
          }),
      });
    }

    if (urlStr.includes("/search/issues") && (urlStr.includes("is%3Aissue") || urlStr.includes("is:issue"))) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            total_count: assignedIssues.length,
            items: assignedIssues,
          }),
      });
    }

    if (urlStr.endsWith("/user")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ login: "testuser" }),
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
  });
}

describe("GitHub plugin — fetch()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-19T12:00:00Z"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("maps PR with review_requested to NexusItem", async () => {
    mockGitHubFetch([makePR()], []);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.id).toBe("github-1001");
    expect(item.source).toBe("github");
    expect(item.type).toBe("pr");
    expect(item.title).toBe("[owner/repo#42] Add feature X");
    expect(item.url).toBe("https://github.com/owner/repo/pull/42");
    expect(item.author).toBe("alice");
  });

  it("maps assigned issue (no pull_request field) → type 'issue'", async () => {
    const issue = makeIssue();
    mockGitHubFetch([], [issue]);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.type).toBe("issue");
  });

  it("deduplication: same ID in both results → 1 item", async () => {
    const pr = makePR({ id: 5000 });
    const duplicate = { ...pr }; // same id in both lists
    mockGitHubFetch([pr], [duplicate]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items).toHaveLength(1);
  });

  it("review requested → medium urgency (weight 4)", async () => {
    mockGitHubFetch([makePR()], []);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.notifications).toHaveLength(1);
    const notif = result.notifications[0];
    expect(notif.urgency).toBe("medium");
    expect(notif.reason).toBe("review_requested");
  });

  it("assigned issue → low, filtered out (weight 2)", async () => {
    mockGitHubFetch([], [makeIssue()]);
    const result = JSON.parse(await fetch(configJson()));

    // Item is in feed
    expect(result.items).toHaveLength(1);
    // But no notification (weight 2 → low → filtered)
    expect(result.notifications).toHaveLength(0);
  });

  it("repoFromUrl() extracts 'owner/repo'", async () => {
    mockGitHubFetch([makePR()], []);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items[0].metadata.repo).toBe("owner/repo");
  });

  it("empty search results → {items:[], notifications:[]}", async () => {
    mockGitHubFetch([], []);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toEqual([]);
    expect(result.notifications).toEqual([]);
  });
});

describe("GitHub plugin — validateConnection()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns success on valid token", async () => {
    mockGitHubFetch([], []);
    const result = JSON.parse(await validateConnection(configJson()));
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it("returns failure on invalid token", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const result = JSON.parse(await validateConnection(configJson()));
    expect(result).toEqual({ ok: false, status: 401 });
  });
});
