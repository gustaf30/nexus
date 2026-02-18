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
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
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
    </div>
  );
}

/* ── Settings ────────────────────────────────────────────── */

interface Props {
  onBack: () => void;
}

export function Settings({ onBack }: Props) {
  const [baseUrl, setBaseUrl]         = useState("");
  const [email, setEmail]             = useState("");
  const [apiToken, setApiToken]       = useState("");
  const [pollInterval, setPollInterval] = useState(600);
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState<{ text: string; ok: boolean } | null>(null);

  // Preserved from loaded config — not exposed in form, kept on save.
  const [lastPoll, setLastPoll]       = useState<number | null>(null);
  const [lastError, setLastError]     = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await invoke<PluginConfig | null>("get_plugin_config", {
        pluginId: "jira",
      });
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
      const credentials: JiraCredentials = {
        baseUrl: baseUrl.trim(),
        email: email.trim(),
        apiToken,
      };
      const config: PluginConfig = {
        plugin_id: "jira",
        is_enabled: true,
        credentials: JSON.stringify(credentials),
        poll_interval_secs: pollInterval,
        last_poll_at: lastPoll,   // preserve existing sync history
        last_error: null,         // clear error on explicit save
        error_count: 0,
        settings: null,
      };
      await invoke("save_plugin_config", { config });
      setLastError(null);
      setMessage({ text: "Saved.", ok: true });
    } catch (e) {
      setMessage({ text: String(e), ok: false });
    } finally {
      setSaving(false);
    }
  }

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

      {/* ── Jira plugin card ── */}
      <div
        style={{
          maxWidth: 480,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-dim)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
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
            <circle cx="3.5" cy="3.5" r="3.5" fill="var(--source-jira)" />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--source-jira)",
            }}
          >
            Jira Plugin
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
          <FormField
            label="Base URL"
            type="text"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://company.atlassian.net"
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
          />
          <FormField
            label="API Token"
            type="password"
            value={apiToken}
            onChange={setApiToken}
            placeholder="••••••••••••••••••••"
          />
          <FormField
            label="Poll Interval (seconds)"
            type="number"
            value={String(pollInterval)}
            onChange={(v) => setPollInterval(Math.max(60, Number(v)))}
            placeholder="600"
          />
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

        {/* Footer: Save button + status */}
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
            onClick={saveConfig}
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
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-primary)";
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
    </div>
  );
}
