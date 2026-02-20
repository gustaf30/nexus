// Shared TypeScript types for Nexus Hub frontend

export type { NexusItem } from "../hooks/useItems";
export type { Notification } from "../hooks/useNotifications";

export interface PluginConfig {
  plugin_id: string;
  is_enabled: boolean;
  credentials: string | null;
  poll_interval_secs: number;
  last_poll_at: number | null;
  last_error: string | null;
  error_count: number;
  settings: string | null;
}

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface GitHubCredentials {
  token: string;
}

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  vipSenders: string[]; // stored as JSON array; UI converts to/from comma-separated string
}
