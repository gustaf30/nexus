// Tests for Gmail plugin — src-tauri/plugins/gmail.ts
import { fetch, validateConnection } from "../gmail.ts";

const BASE_CONFIG = {
  clientId: "cid",
  clientSecret: "csec",
  refreshToken: "rtok",
  vipSenders: ["boss@company.com"],
};

function configJson(overrides = {}) {
  return JSON.stringify({ ...BASE_CONFIG, ...overrides });
}

/** Build a GmailMessage with sensible defaults. */
function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    threadId: "t1",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Preview text",
    internalDate: "1739959200000", // some fixed ms-since-epoch
    payload: {
      headers: [
        { name: "From", value: "Boss <boss@company.com>" },
        { name: "Subject", value: "Important meeting" },
        { name: "Date", value: "Wed, 19 Feb 2026 10:00:00 +0000" },
      ],
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", body: { size: 100 } },
        { mimeType: "application/pdf", body: { size: 5000 } },
      ],
    },
    ...overrides,
  };
}

/**
 * Build a mock globalThis.fetch that handles:
 *  1. Token exchange (POST oauth2.googleapis.com/token)
 *  2. Message list (GET .../users/me/messages?...)
 *  3. Individual message detail (GET .../users/me/messages/{id}?format=metadata...)
 *  4. Profile (GET .../users/me/profile) for validateConnection
 */
function mockGmailFetch(
  messages: unknown[],
  messageList?: Array<{ id: string; threadId: string }>,
) {
  // Derive message list from messages if not explicitly provided
  const list =
    messageList ??
    messages.map((m: any) => ({ id: m.id, threadId: m.threadId }));

  const messageMap = new Map<string, unknown>();
  for (const m of messages) {
    messageMap.set((m as any).id, m);
  }

  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: any) => {
    const urlStr = typeof url === "string" ? url : String(url);

    // Token exchange
    if (urlStr.includes("oauth2.googleapis.com/token")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: "at123" }),
      });
    }

    // Message list
    if (
      urlStr.includes("/users/me/messages") &&
      !urlStr.includes("/users/me/messages/")
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            messages: list.length > 0 ? list : undefined,
          }),
      });
    }

    // Individual message detail
    const msgMatch = urlStr.match(/\/users\/me\/messages\/([^?]+)/);
    if (msgMatch) {
      const msgId = msgMatch[1];
      const msg = messageMap.get(msgId);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(msg ?? {}),
      });
    }

    // Profile endpoint for validateConnection
    if (urlStr.includes("/users/me/profile")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ emailAddress: "user@test.com" }),
      });
    }

    // Fallback
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found" });
  });
}

describe("Gmail plugin — fetch()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
    // Fixed "now": 2026-02-19T12:00:00Z
    vi.setSystemTime(new Date("2026-02-19T12:00:00Z"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("maps a normal email to NexusItem", async () => {
    // internalDate = now - 1h (recent, in ms)
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    const recentMs = String(nowMs - 3600 * 1000);

    mockGmailFetch([makeMessage({ internalDate: recentMs })]);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.id).toBe("gmail-m1");
    expect(item.source).toBe("gmail");
    expect(item.type).toBe("email");
    expect(item.title).toBe("Important meeting");
    expect(item.url).toContain("mail.google.com");
    expect(item.author).toBe("Boss");
  });

  it("missing payload → no crash (regression)", async () => {
    const msg = makeMessage({ payload: undefined });
    // remove payload entirely
    delete (msg as any).payload;
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items).toHaveLength(1);
    // Should still produce an item, just with empty header values
    expect(result.items[0].title).toBe("(no subject)");
  });

  it("missing payload.headers → no crash (regression)", async () => {
    const msg = makeMessage();
    // payload exists but no headers
    (msg as any).payload = { mimeType: "text/plain" };
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("(no subject)");
  });

  it('extracts email from "Name <email>" format', async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    const msg = makeMessage({ internalDate: String(nowMs - 3600 * 1000) });
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items[0].metadata.fromEmail).toBe("boss@company.com");
  });

  it("handles plain email (no angle brackets)", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    const msg = makeMessage({ internalDate: String(nowMs - 3600 * 1000) });
    (msg as any).payload.headers[0] = {
      name: "From",
      value: "plain@email.com",
    };
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items[0].metadata.fromEmail).toBe("plain@email.com");
  });

  it("VIP sender detection (case-insensitive)", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    // internalDate >4h ago to also trigger unread_over_4h to push above low threshold
    const oldMs = String(nowMs - 5 * 3600 * 1000);
    const msg = makeMessage({ internalDate: oldMs });
    // From header with mixed case
    (msg as any).payload.headers[0] = {
      name: "From",
      value: "Boss <BOSS@Company.COM>",
    };
    mockGmailFetch([msg]);

    const result = JSON.parse(
      await fetch(configJson({ vipSenders: ["boss@company.com"] })),
    );
    const notif = result.notifications.find(
      (n: any) => n.itemId === "gmail-m1",
    );
    expect(notif).toBeDefined();
    expect(notif.reason).toContain("vip_sender");
  });

  it("unread_over_4h signal for old messages", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    // Message from 5 hours ago
    const oldMs = String(nowMs - 5 * 3600 * 1000);
    // Use a VIP sender to also get a notification (unread_over_4h alone = weight 1 = low = filtered)
    const msg = makeMessage({ internalDate: oldMs });
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    // VIP (3) + unread_over_4h (1) + has_attachment (1) = 5 → medium
    const notif = result.notifications.find(
      (n: any) => n.itemId === "gmail-m1",
    );
    expect(notif).toBeDefined();
    expect(notif.reason).toContain("unread_over_4h");
  });

  it("no unread_over_4h for recent messages", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    // Message from 30 min ago
    const recentMs = String(nowMs - 30 * 60 * 1000);
    const msg = makeMessage({ internalDate: recentMs });
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    // VIP (3) + attachment (1) = 4, medium — but should NOT have unread_over_4h
    const notif = result.notifications.find(
      (n: any) => n.itemId === "gmail-m1",
    );
    expect(notif).toBeDefined();
    expect(notif.reason).not.toContain("unread_over_4h");
  });

  it("attachment detection via recursive part tree", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    const msg = makeMessage({ internalDate: String(nowMs - 3600 * 1000) });
    // Nested multipart with attachment
    (msg as any).payload.parts = [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { size: 50 } },
          { mimeType: "text/html", body: { size: 200 } },
        ],
      },
      { mimeType: "application/pdf", body: { size: 8000 } },
    ];
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items[0].metadata.hasAttachment).toBe(true);
  });

  it("text-only message → hasAttachment false", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    const msg = makeMessage({ internalDate: String(nowMs - 3600 * 1000) });
    (msg as any).payload.parts = [
      { mimeType: "text/plain", body: { size: 100 } },
    ];
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    expect(result.items[0].metadata.hasAttachment).toBe(false);
  });

  it("urgency calc: VIP + attachment + old (weight 5 = medium)", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    // >4h ago to trigger unread_over_4h
    const oldMs = String(nowMs - 5 * 3600 * 1000);
    const msg = makeMessage({ internalDate: oldMs });
    // Has attachment (via default makeMessage parts) + VIP sender + old
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    const notif = result.notifications.find(
      (n: any) => n.itemId === "gmail-m1",
    );
    expect(notif).toBeDefined();
    // vip_sender(3) + unread_over_4h(1) + has_attachment(1) = 5
    expect(notif.urgency).toBe("medium");
    expect(notif.reason).toContain("vip_sender");
    expect(notif.reason).toContain("unread_over_4h");
    expect(notif.reason).toContain("has_attachment");
  });

  it("no signals → filtered out (low urgency)", async () => {
    const nowMs = new Date("2026-02-19T12:00:00Z").getTime();
    // Recent message, non-VIP, no attachment
    const recentMs = String(nowMs - 30 * 60 * 1000);
    const msg = makeMessage({ internalDate: recentMs });
    (msg as any).payload.headers[0] = {
      name: "From",
      value: "nobody@random.com",
    };
    (msg as any).payload.parts = [
      { mimeType: "text/plain", body: { size: 50 } },
    ];
    mockGmailFetch([msg]);

    const result = JSON.parse(await fetch(configJson()));
    // Item exists but no notification (all signals = 0 weight → low → filtered)
    expect(result.items).toHaveLength(1);
    expect(result.notifications).toHaveLength(0);
  });

  it("empty message list → {items:[], notifications:[]}", async () => {
    mockGmailFetch([], []);
    const result = JSON.parse(await fetch(configJson()));

    expect(result.items).toEqual([]);
    expect(result.notifications).toEqual([]);
  });
});

describe("Gmail plugin — validateConnection()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns success when token exchange and profile fetch succeed", async () => {
    mockGmailFetch([]);
    const result = JSON.parse(await validateConnection(configJson()));
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("returns failure when token exchange fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("oauth2.googleapis.com/token")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve(JSON.stringify({ error: "invalid_grant" })),
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });

    const result = JSON.parse(await validateConnection(configJson()));
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
  });
});
