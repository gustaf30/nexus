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
