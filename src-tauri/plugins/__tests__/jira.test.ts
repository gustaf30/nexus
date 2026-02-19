// Tests for Jira plugin — src-tauri/plugins/jira.ts
import { fetch, validateConnection } from "../jira.ts";

const BASE_CONFIG = {
  baseUrl: "https://test.atlassian.net",
  email: "user@test.com",
  apiToken: "token123",
};

function configJson(overrides = {}) {
  return JSON.stringify({ ...BASE_CONFIG, ...overrides });
}

/** Build a minimal JiraIssue with sensible defaults; override any field path. */
function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "10001",
    key: "TEST-1",
    fields: {
      summary: "Fix bug",
      description: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Description text" }],
          },
        ],
      },
      status: { name: "In Progress" },
      priority: { name: "High", id: "2" },
      assignee: { displayName: "Bob", emailAddress: "bob@test.com" },
      reporter: { displayName: "Alice" },
      duedate: null as string | null,
      updated: "2026-02-19T10:00:00.000Z",
      created: "2026-02-18T10:00:00.000Z",
      labels: ["backend"],
      comment: { comments: [] },
    },
    ...overrides,
  };
}

function mockFetchOk(issues: unknown[]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ issues }),
  });
}

describe("Jira plugin — fetch()", () => {
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

  it("maps a normal issue to NexusItem", async () => {
    mockFetchOk([makeIssue()]);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.id).toBe("jira-TEST-1");
    expect(item.source).toBe("jira");
    expect(item.type).toBe("ticket");
    expect(item.title).toBe("[TEST-1] Fix bug");
    expect(item.url).toBe("https://test.atlassian.net/browse/TEST-1");
    expect(item.author).toBe("Alice");
    expect(item.tags).toEqual(["backend"]);
  });

  it("null priority → 'None', priorityId '' (regression)", async () => {
    const issue = makeIssue();
    issue.fields.priority = null;
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    const meta = result.items[0].metadata;

    expect(meta.priority).toBe("None");
    expect(meta.priorityId).toBe("");
  });

  it("extracts text from nested ADF description", async () => {
    const issue = makeIssue();
    issue.fields.description = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
        },
      ],
    };
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items[0].summary).toBe("Hello world");
  });

  it("null description → summary is null", async () => {
    const issue = makeIssue();
    issue.fields.description = null;
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items[0].summary).toBeNull();
  });

  it("medium urgency: assigned_to_you only (weight 3)", async () => {
    const issue = makeIssue();
    // priority "Medium" id "3" — not P1/blocker, no due date
    issue.fields.priority = { name: "Medium", id: "3" };
    issue.fields.duedate = null;
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    const notif = result.notifications[0];

    expect(notif.urgency).toBe("medium");
    expect(notif.reason).toBe("assigned_to_you");
  });

  it("high urgency: assigned + P1 (weight 7)", async () => {
    const issue = makeIssue();
    issue.fields.priority = { name: "Highest", id: "1" };
    issue.fields.duedate = null;
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    const notif = result.notifications[0];

    expect(notif.urgency).toBe("high");
    expect(notif.reason).toBe("assigned_to_you,priority_p1_blocker");
  });

  it("critical urgency: assigned + P1 + deadline_24h (weight 10)", async () => {
    const issue = makeIssue();
    issue.fields.priority = { name: "Highest", id: "1" };
    // Due date: 12 hours from now (within 24h and in the future)
    issue.fields.duedate = "2026-02-20T00:00:00.000Z";
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    const notif = result.notifications[0];

    expect(notif.urgency).toBe("critical");
    expect(notif.reason).toContain("deadline_24h");
  });

  it("past due date does NOT trigger deadline_24h", async () => {
    const issue = makeIssue();
    issue.fields.priority = { name: "Highest", id: "1" };
    // Due date is in the past
    issue.fields.duedate = "2026-02-18T00:00:00.000Z";
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    const notif = result.notifications[0];

    // Should be high (assigned=3 + P1=4 = 7) but not critical (no deadline_24h)
    expect(notif.urgency).toBe("high");
    expect(notif.reason).not.toContain("deadline_24h");
  });

  it("future due date >24h does NOT trigger deadline_24h", async () => {
    const issue = makeIssue();
    issue.fields.priority = { name: "Highest", id: "1" };
    // Due date is 3 days from now
    issue.fields.duedate = "2026-02-22T12:00:00.000Z";
    mockFetchOk([issue]);

    const result = JSON.parse(await fetch(configJson()));
    const notif = result.notifications[0];

    expect(notif.urgency).toBe("high");
    expect(notif.reason).not.toContain("deadline_24h");
  });

  it("empty issues array → {items:[], notifications:[]}", async () => {
    mockFetchOk([]);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toEqual([]);
    expect(result.notifications).toEqual([]);
  });

  it("missing issues field → empty arrays", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}), // no "issues" key
    });

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items).toEqual([]);
    expect(result.notifications).toEqual([]);
  });

  it("throws on non-OK response (401)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(fetch(configJson())).rejects.toThrow("Jira API error: 401 Unauthorized");
  });
});

describe("Jira plugin — validateConnection()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns {ok, status}", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = JSON.parse(await validateConnection(configJson()));
    expect(result).toEqual({ ok: true, status: 200 });

    // Verify it hit the /myself endpoint
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://test.atlassian.net/rest/api/3/myself",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic "),
        }),
      }),
    );
  });
});
