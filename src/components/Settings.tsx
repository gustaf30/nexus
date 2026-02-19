import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, ArrowLeft } from "lucide-react";

/* ── Types ────────────────────────────────────────────────── */

interface PluginConfig {
  plugin_id: string;
  is_enabled: boolean;
  credentials: string | null;
  poll_interval_secs: number;
  last_poll_at: number | null;
  last_error: string | null;
  error_count: number;
  settings: string | null;
}

interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface GitHubCredentials {
  token: string;
}

interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  vipSenders: string; // comma-separated in the form
}

/* ── Helpers ─────────────────────────────────────────────── */

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Sub-components ──────────────────────────────────────── */

function FormField({
  label,
  type,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        style={{
          display: "block",
          fontFamily: "var(--font-data)",
          fontSize: 10,
          fontWeight: 500,
          color: "var(--text-muted)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "var(--sp-1)",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "7px 10px",
          background: "var(--bg-base)",
          border: `1px solid ${focused ? "var(--border-lit)" : "var(--border-mid)"}`,
          borderRadius: "var(--radius-md)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-data)",
          fontSize: 12,
          outline: "none",
          boxSizing: "border-box",
          boxShadow: focused ? "0 0 0 2px var(--accent-focus)" : "none",
          transition:
            "border-color var(--transition-fast), box-shadow var(--transition-fast)",
        }}
      />
      {hint && (
        <p style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function PluginCard({
  accentVar,
  label,
  lastPoll,
  lastError,
  children,
  onSave,
  saving,
  message,
}: {
  accentVar: string;
  label: string;
  lastPoll: number | null;
  lastError: string | null;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  message: { text: string; ok: boolean } | null;
}) {
  return (
    <div
      style={{
        maxWidth: 480,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        marginBottom: "var(--sp-4)",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "var(--sp-3) var(--sp-4)",
          borderBottom: "1px solid var(--border-dim)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
        }}
      >
        <svg width="7" height="7" viewBox="0 0 7 7">
          <circle cx="3.5" cy="3.5" r="3.5" fill={`var(${accentVar})`} />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 700,
            color: `var(${accentVar})`,
          }}
        >
          {label}
        </span>
        {lastPoll !== null && (
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-data)",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            Last sync {timeAgo(lastPoll)}
          </span>
        )}
      </div>

      {/* Form fields */}
      <div
        style={{
          padding: "var(--sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-3)",
        }}
      >
        {children}
      </div>

      {/* Last error */}
      {lastError && (
        <div
          style={{
            margin: "0 var(--sp-4) var(--sp-3)",
            padding: "var(--sp-2) var(--sp-3)",
            background: "var(--urgency-high-bg)",
            border: "1px solid var(--urgency-high)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              color: "var(--urgency-high)",
              lineHeight: 1.5,
            }}
          >
            Last error: {lastError}
          </p>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "var(--sp-3) var(--sp-4)",
          borderTop: "1px solid var(--border-dim)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
        }}
      >
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            padding: "7px 20px",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-primary)",
            color: "var(--text-inverse)",
            border: "none",
            fontSize: 12,
            fontFamily: "var(--font-data)",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            transition: "background var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            if (!saving)
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-primary)";
          }}
        >
          <Save size={12} />
          {saving ? "Saving…" : "Save"}
        </button>

        {message && (
          <p
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              color: message.ok ? "var(--accent-primary)" : "var(--urgency-high)",
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Jira section ────────────────────────────────────────── */

function JiraSection() {
  const [baseUrl, setBaseUrl]       = useState("");
  const [email, setEmail]           = useState("");
  const [apiToken, setApiToken]     = useState("");
  const [pollInterval, setPollInterval] = useState(600);
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState<{ text: string; ok: boolean } | null>(null);
  const [lastPoll, setLastPoll]     = useState<number | null>(null);
  const [lastError, setLastError]   = useState<string | null>(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try {
      const config = await invoke<PluginConfig | null>("get_plugin_config", { pluginId: "jira" });
      if (config?.credentials) {
        const creds: JiraCredentials = JSON.parse(config.credentials);
        setBaseUrl(creds.baseUrl ?? "");
        setEmail(creds.email ?? "");
        setApiToken(creds.apiToken ?? "");
      }
      if (config) {
        setPollInterval(config.poll_interval_secs);
        setLastPoll(config.last_poll_at);
        setLastError(config.last_error);
      }
    } catch (e) {
      console.error("Failed to load Jira config:", e);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage(null);
    try {
      const credentials: JiraCredentials = { baseUrl: baseUrl.trim(), email: email.trim(), apiToken };
      await invoke("save_plugin_config", {
        config: {
          plugin_id: "jira",
          is_enabled: true,
          credentials: JSON.stringify(credentials),
          poll_interval_secs: pollInterval,
          last_poll_at: lastPoll,
          last_error: null,
          error_count: 0,
          settings: null,
        } satisfies PluginConfig,
      });
      setLastError(null);
      setMessage({ text: "Saved.", ok: true });
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PluginCard
      accentVar="--source-jira"
      label="Jira Plugin"
      lastPoll={lastPoll}
      lastError={lastError}
      onSave={saveConfig}
      saving={saving}
      message={message}
    >
      <FormField label="Base URL" type="text" value={baseUrl} onChange={setBaseUrl} placeholder="https://company.atlassian.net" />
      <FormField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
      <FormField label="API Token" type="password" value={apiToken} onChange={setApiToken} placeholder="••••••••••••••••••••" />
      <FormField
        label="Poll Interval (seconds)"
        type="number"
        value={String(pollInterval)}
        onChange={(v) => setPollInterval(Math.max(60, Number(v)))}
        placeholder="600"
      />
    </PluginCard>
  );
}

/* ── GitHub section ──────────────────────────────────────── */

function GitHubSection() {
  const [token, setToken]           = useState("");
  const [pollInterval, setPollInterval] = useState(600);
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState<{ text: string; ok: boolean } | null>(null);
  const [lastPoll, setLastPoll]     = useState<number | null>(null);
  const [lastError, setLastError]   = useState<string | null>(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try {
      const config = await invoke<PluginConfig | null>("get_plugin_config", { pluginId: "github" });
      if (config?.credentials) {
        const creds: GitHubCredentials = JSON.parse(config.credentials);
        setToken(creds.token ?? "");
      }
      if (config) {
        setPollInterval(config.poll_interval_secs);
        setLastPoll(config.last_poll_at);
        setLastError(config.last_error);
      }
    } catch (e) {
      console.error("Failed to load GitHub config:", e);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage(null);
    try {
      const credentials: GitHubCredentials = { token: token.trim() };
      await invoke("save_plugin_config", {
        config: {
          plugin_id: "github",
          is_enabled: true,
          credentials: JSON.stringify(credentials),
          poll_interval_secs: pollInterval,
          last_poll_at: lastPoll,
          last_error: null,
          error_count: 0,
          settings: null,
        } satisfies PluginConfig,
      });
      setLastError(null);
      setMessage({ text: "Saved.", ok: true });
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PluginCard
      accentVar="--source-github"
      label="GitHub Plugin"
      lastPoll={lastPoll}
      lastError={lastError}
      onSave={saveConfig}
      saving={saving}
      message={message}
    >
      <FormField
        label="Personal Access Token"
        type="password"
        value={token}
        onChange={setToken}
        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        hint="Requires scopes: repo, read:user, notifications"
      />
      <FormField
        label="Poll Interval (seconds)"
        type="number"
        value={String(pollInterval)}
        onChange={(v) => setPollInterval(Math.max(60, Number(v)))}
        placeholder="600"
      />
    </PluginCard>
  );
}

/* ── Gmail section ───────────────────────────────────────── */

function GmailSection() {
  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [vipSenders, setVipSenders]     = useState("");
  const [pollInterval, setPollInterval] = useState(600);
  const [saving, setSaving]             = useState(false);
  const [message, setMessage]           = useState<{ text: string; ok: boolean } | null>(null);
  const [lastPoll, setLastPoll]         = useState<number | null>(null);
  const [lastError, setLastError]       = useState<string | null>(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    try {
      const config = await invoke<PluginConfig | null>("get_plugin_config", { pluginId: "gmail" });
      if (config?.credentials) {
        const creds: GmailCredentials = JSON.parse(config.credentials);
        setClientId(creds.clientId ?? "");
        setClientSecret(creds.clientSecret ?? "");
        setRefreshToken(creds.refreshToken ?? "");
        setVipSenders(
          Array.isArray(creds.vipSenders)
            ? creds.vipSenders.join(", ")
            : (creds.vipSenders ?? ""),
        );
      }
      if (config) {
        setPollInterval(config.poll_interval_secs);
        setLastPoll(config.last_poll_at);
        setLastError(config.last_error);
      }
    } catch (e) {
      console.error("Failed to load Gmail config:", e);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage(null);
    try {
      // Store vipSenders as a JSON array, parsed from the comma-separated input
      const vipArray = vipSenders
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const credentials = {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        refreshToken: refreshToken.trim(),
        vipSenders: vipArray,
      };
      await invoke("save_plugin_config", {
        config: {
          plugin_id: "gmail",
          is_enabled: true,
          credentials: JSON.stringify(credentials),
          poll_interval_secs: pollInterval,
          last_poll_at: lastPoll,
          last_error: null,
          error_count: 0,
          settings: null,
        } satisfies PluginConfig,
      });
      setLastError(null);
      setMessage({ text: "Saved.", ok: true });
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PluginCard
      accentVar="--source-gmail"
      label="Gmail Plugin"
      lastPoll={lastPoll}
      lastError={lastError}
      onSave={saveConfig}
      saving={saving}
      message={message}
    >
      <FormField
        label="Client ID"
        type="text"
        value={clientId}
        onChange={setClientId}
        placeholder="xxxx.apps.googleusercontent.com"
        hint="From Google Cloud Console → Credentials → OAuth 2.0 Client ID"
      />
      <FormField
        label="Client Secret"
        type="password"
        value={clientSecret}
        onChange={setClientSecret}
        placeholder="••••••••••••••••••••"
      />
      <FormField
        label="Refresh Token"
        type="password"
        value={refreshToken}
        onChange={setRefreshToken}
        placeholder="1//xxxx..."
        hint="Generate at developers.google.com/oauthplayground (scope: gmail.readonly)"
      />
      <FormField
        label="VIP Senders (comma-separated emails)"
        type="text"
        value={vipSenders}
        onChange={setVipSenders}
        placeholder="boss@company.com, cto@company.com"
        hint="Emails from these senders get +3 urgency weight"
      />
      <FormField
        label="Poll Interval (seconds)"
        type="number"
        value={String(pollInterval)}
        onChange={(v) => setPollInterval(Math.max(60, Number(v)))}
        placeholder="600"
      />
    </PluginCard>
  );
}

/* ── Settings ────────────────────────────────────────────── */

interface Props {
  onBack: () => void;
}

export function Settings({ onBack }: Props) {
  return (
    <div
      style={{
        flex: 1,
        background: "var(--bg-base)",
        overflowY: "auto",
        padding: "var(--sp-6)",
      }}
    >
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-6)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-1)",
            padding: "4px 10px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-dim)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 11,
            fontFamily: "var(--font-data)",
            cursor: "pointer",
            transition: "color var(--transition-fast), border-color var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-mid)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-dim)";
          }}
        >
          <ArrowLeft size={12} />
          Back
        </button>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 800,
            color: "var(--text-primary)",
          }}
        >
          Settings
        </h2>
      </div>

      <JiraSection />
      <GitHubSection />
      <GmailSection />
    </div>
  );
}
