import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, ArrowLeft, Shield } from "lucide-react";
import type { PluginConfig, JiraCredentials, GitHubCredentials, GmailCredentials } from "../types";
import { timeAgo } from "../utils/time";

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
          className="btn-primary"
          onClick={onSave}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1 }}
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
      setMessage({ text: "Credentials saved. Syncing now...", ok: true });
    } catch {
      setMessage({ text: "Couldn't save settings. Please check your connection and try again.", ok: false });
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
      setMessage({ text: "Credentials saved. Syncing now...", ok: true });
    } catch {
      setMessage({ text: "Couldn't save settings. Please check your connection and try again.", ok: false });
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
      setMessage({ text: "Credentials saved. Syncing now...", ok: true });
    } catch {
      setMessage({ text: "Couldn't save settings. Please check your connection and try again.", ok: false });
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

/* ── Preferences section ─────────────────────────────────── */

function PreferencesSection() {
  const [focusThreshold, setFocusThreshold] = useState("high");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const threshold = await invoke<string | null>("get_app_setting", { key: "focus_mode_threshold" });
      if (threshold) setFocusThreshold(threshold);

      const start = await invoke<string | null>("get_app_setting", { key: "quiet_hours_start" });
      if (start) setQuietStart(start);

      const end = await invoke<string | null>("get_app_setting", { key: "quiet_hours_end" });
      if (end) setQuietEnd(end);
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      await invoke("set_app_setting", { key: "focus_mode_threshold", value: focusThreshold });
      if (quietStart) {
        await invoke("set_app_setting", { key: "quiet_hours_start", value: quietStart });
      }
      if (quietEnd) {
        await invoke("set_app_setting", { key: "quiet_hours_end", value: quietEnd });
      }
      setMessage({ text: "Preferences saved.", ok: true });
    } catch {
      setMessage({ text: "Couldn't save settings. Please check your connection and try again.", ok: false });
    } finally {
      setSaving(false);
    }
  }

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
      {/* Header */}
      <div
        style={{
          padding: "var(--sp-3) var(--sp-4)",
          borderBottom: "1px solid var(--border-dim)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
        }}
      >
        <Shield size={14} style={{ color: "var(--accent-primary)" }} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--accent-primary)",
          }}
        >
          Preferences
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "var(--sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-3)",
        }}
      >
        {/* Focus mode threshold */}
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
            Focus Mode Threshold
          </label>
          <select
            value={focusThreshold}
            onChange={(e) => setFocusThreshold(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: "var(--bg-base)",
              border: "1px solid var(--border-mid)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-data)",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="low">Show all</option>
            <option value="medium">Medium+</option>
            <option value="high">High+</option>
            <option value="critical">Critical only</option>
          </select>
          <p style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
            When focus mode is active, only notifications at or above this level trigger native alerts.
          </p>
        </div>

        {/* Quiet hours */}
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
            Quiet Hours
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              style={{
                flex: 1,
                padding: "7px 10px",
                background: "var(--bg-base)",
                border: "1px solid var(--border-mid)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-data)",
                fontSize: 12,
                outline: "none",
              }}
            />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>to</span>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              style={{
                flex: 1,
                padding: "7px 10px",
                background: "var(--bg-base)",
                border: "1px solid var(--border-mid)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-data)",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>
          <p style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
            Suppress ALL native notifications during this time window. Leave empty to disable.
          </p>
        </div>
      </div>

      {/* Footer with save */}
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
          className="btn-primary"
          onClick={saveSettings}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          <Save size={12} />
          {saving ? "Saving..." : "Save"}
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

/* ── Settings ────────────────────────────────────────────── */

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
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
          className="btn-back"
          onClick={onBack}
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
      <PreferencesSection />
    </div>
  );
}
