// Plugin Interface — all plugins must export these functions

export interface Credentials {
  baseUrl?: string;
  token?: string;
  email?: string;
  apiKey?: string;
}

export interface NexusItem {
  id: string;
  source: string;
  sourceId: string;
  type: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  timestamp: number; // Unix timestamp (seconds)
  metadata: Record<string, unknown>;
  tags: string[];
}

export interface NexusNotification {
  itemId: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
}

export interface PluginResult {
  items: NexusItem[];
  notifications: NexusNotification[];
}

/** Signal used in urgency computation. */
export interface Signal {
  reason: string;
  weight: number;
}

/** Compute urgency tier from accumulated signal weights. */
export function computeUrgency(signals: Signal[]): "low" | "medium" | "high" | "critical" {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight >= 9) return "critical";
  if (totalWeight >= 6) return "high";
  if (totalWeight >= 3) return "medium";
  return "low";
}

/** Fetch with a configurable timeout using AbortController. */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Safely parse credentials JSON, throwing a descriptive error on failure. */
export function parseCredentials<T>(json: string, pluginName: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    throw new Error(`Invalid ${pluginName} credentials JSON: ${e instanceof Error ? e.message : e}`);
  }
}
