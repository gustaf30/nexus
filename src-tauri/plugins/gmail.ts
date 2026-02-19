// Gmail Plugin for Nexus Hub
// Fetches unread emails from INBOX via Gmail API using OAuth2 refresh token
//
// Config JSON shape:
//   {
//     "clientId": "...",
//     "clientSecret": "...",
//     "refreshToken": "...",
//     "vipSenders": ["boss@company.com"]   // optional
//   }
//
// Setup: generate a refresh token via https://developers.google.com/oauthplayground
//   1) Create a 'Web application' OAuth client in Google Cloud Console
//   2) Add https://developers.google.com/oauthplayground to Authorized redirect URIs
//   3) In the Playground, gear ⚙ → 'Use your own OAuth credentials' → paste Client ID & Secret
//   4) Authorize scope: https://www.googleapis.com/auth/gmail.readonly
//   5) Exchange authorization code → copy the Refresh token
//
// Signals:
//   vip_sender      +3
//   unread_over_4h  +1
//   has_attachment  +1

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  vipSenders?: string[];
}

interface MessageListItem {
  id: string;
  threadId: string;
}

interface MessageHeader {
  name: string;
  value: string;
}

interface MessagePart {
  mimeType: string;
  parts?: MessagePart[];
  body?: { size: number };
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string; // ms since epoch as string
  payload?: {
    headers?: MessageHeader[];
    mimeType: string;
    parts?: MessagePart[];
    body?: { size: number };
  };
}

/** Exchange the refresh token for a short-lived access token. */
async function getAccessToken(config: GmailConfig): Promise<string> {
  const res = await globalThis.fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let hint = "";
    try {
      const err = JSON.parse(body) as { error?: string; error_description?: string };
      if (err.error === "unauthorized_client") {
        hint = " — The refresh token is bound to a different Client ID. You must generate the token with the SAME credentials used in Nexus Hub. Steps: 1) In Google Cloud Console → Credentials, create an OAuth client of type 'Web application'. 2) Add 'https://developers.google.com/oauthplayground' to Authorized redirect URIs. 3) In OAuth Playground, gear icon ⚙ → 'Use your own OAuth credentials' → paste your Client ID & Secret. 4) Authorize scope 'https://www.googleapis.com/auth/gmail.readonly' → Exchange → copy the Refresh token. 5) Use the same Client ID + Secret + Refresh token in Nexus Hub.";
      } else if (err.error === "redirect_uri_mismatch") {
        hint = " — Add 'https://developers.google.com/oauthplayground' to Authorized redirect URIs in your Google Cloud Console OAuth client (must be type 'Web application', not 'Desktop app').";
      } else if (err.error === "invalid_grant") {
        hint = " — The refresh token has been revoked or expired. Re-generate it in OAuth Playground with the same Client ID & Secret configured in Nexus Hub.";
      }
    } catch { /* ignore parse errors */ }
    throw new Error(`Failed to refresh Gmail access token: ${res.status}${hint}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function getHeader(headers: MessageHeader[] | undefined, name: string): string {
  if (!headers) return "";
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Recursively check if a message part tree contains an attachment. */
function hasAttachment(part: MessagePart): boolean {
  if (part.mimeType.startsWith("multipart/") && part.parts) {
    return part.parts.some(hasAttachment);
  }
  // A part with a non-zero body that isn't text or html is an attachment.
  if (
    !part.mimeType.startsWith("text/") &&
    !part.mimeType.startsWith("multipart/") &&
    (part.body?.size ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

export async function fetch(configJson: string): Promise<string> {
  let config: GmailConfig;
  try {
    config = JSON.parse(configJson);
  } catch (e) {
    throw new Error(`Invalid Gmail credentials JSON: ${e instanceof Error ? e.message : e}`);
  }
  const vipSet = new Set((config.vipSenders ?? []).map((s) => s.toLowerCase()));

  const accessToken = await getAccessToken(config);

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // List up to 30 unread messages in INBOX (keep request count low).
  const listRes = await globalThis.fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&q=is:unread&maxResults=30",
    { headers: authHeader },
  );
  if (!listRes.ok) {
    throw new Error(`Gmail list error: ${listRes.status} ${listRes.statusText}`);
  }
  const listData = await listRes.json() as { messages?: MessageListItem[] };
  const messageList: MessageListItem[] = listData.messages ?? [];

  // Fetch metadata in batches of 5 to avoid Gmail 429 rate limiting.
  const messages: GmailMessage[] = [];
  for (let i = 0; i < messageList.length; i += 5) {
    const batch = messageList.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (m): Promise<GmailMessage> => {
        const params = new URLSearchParams();
        params.append("format", "metadata");
        params.append("metadataHeaders", "From");
        params.append("metadataHeaders", "Subject");
        params.append("metadataHeaders", "Date");
        const res = await globalThis.fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?${params}`,
          { headers: authHeader },
        );
        if (!res.ok) throw new Error(`Gmail message fetch error: ${res.status}`);
        return res.json() as Promise<GmailMessage>;
      }),
    );
    messages.push(...batchResults);
  }

  const now = Math.floor(Date.now() / 1000);

  const items = messages.map((msg) => {
    const headers = msg.payload?.headers;
    const from = getHeader(headers, "From");
    const subject = getHeader(headers, "Subject") || "(no subject)";
    const date = getHeader(headers, "Date");
    const timestampMs = parseInt(msg.internalDate, 10);
    const timestamp = Math.floor(timestampMs / 1000);

    // Extract plain email address from "Name <email>" format
    const fromEmail = (from.match(/<([^>]+)>/) ?? [, from])[1]?.toLowerCase() ?? from.toLowerCase();
    const fromName = from.replace(/<[^>]+>/, "").trim() || fromEmail;

    const attachment = msg.payload?.parts ? msg.payload.parts.some(hasAttachment) : false;

    return {
      id: `gmail-${msg.id}`,
      source: "gmail",
      sourceId: msg.id,
      type: "email",
      title: subject,
      summary: msg.snippet || null,
      url: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`,
      author: fromName,
      timestamp,
      metadata: {
        from,
        fromEmail,
        date,
        hasAttachment: attachment,
        threadId: msg.threadId,
      },
      tags: [] as string[],
    };
  });

  const notifications = messages
    .map((msg, i) => {
      const item = items[i];
      const signals: Array<{ reason: string; weight: number }> = [];

      const fromEmail = (item.metadata as { fromEmail: string }).fromEmail;
      if (vipSet.has(fromEmail)) {
        signals.push({ reason: "vip_sender", weight: 3 });
      }

      const ageSeconds = now - item.timestamp;
      if (ageSeconds > 4 * 3600) {
        signals.push({ reason: "unread_over_4h", weight: 1 });
      }

      if ((item.metadata as { hasAttachment: boolean }).hasAttachment) {
        signals.push({ reason: "has_attachment", weight: 1 });
      }

      const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
      let urgency: "low" | "medium" | "high" | "critical";
      if (totalWeight >= 9) urgency = "critical";
      else if (totalWeight >= 6) urgency = "high";
      else if (totalWeight >= 3) urgency = "medium";
      else urgency = "low";

      return {
        itemId: item.id,
        reason: signals.map((s) => s.reason).join(","),
        urgency,
      };
    })
    .filter((n) => n.urgency !== "low");

  return JSON.stringify({ items, notifications });
}

export async function validateConnection(configJson: string): Promise<string> {
  let config: GmailConfig;
  try {
    config = JSON.parse(configJson);
  } catch (e) {
    throw new Error(`Invalid Gmail credentials JSON: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const accessToken = await getAccessToken(config);
    const res = await globalThis.fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return JSON.stringify({ ok: res.ok, status: res.status });
  } catch {
    return JSON.stringify({ ok: false, status: 0 });
  }
}
