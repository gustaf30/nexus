//! Plugin runtime — executes TypeScript plugins via Deno subprocess.
//!
//! Each plugin is a TypeScript module that exports two async functions:
//!   - `fetch(configJson: string): Promise<string>` — returns PluginResult JSON
//!   - `validateConnection(configJson: string): Promise<string>` — returns `{ok, status}` JSON
//!
//! Requires `deno` to be installed and available in PATH.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginItem {
    pub id: String,
    pub source: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub author: Option<String>,
    pub timestamp: i64,
    pub metadata: serde_json::Value,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginNotification {
    #[serde(rename = "itemId")]
    pub item_id: String,
    pub reason: String,
    pub urgency: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginResult {
    pub items: Vec<PluginItem>,
    pub notifications: Vec<PluginNotification>,
}

/// Execute a named export from a TypeScript plugin file via `deno eval`.
/// The function receives `config_json` as its argument and must return a JSON string.
pub fn execute_plugin(
    plugin_path: &Path,
    function: &str,
    config_json: &str,
) -> Result<String, String> {
    let canonical = plugin_path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve plugin path: {}", e))?;

    #[cfg(windows)]
    let plugin_url = {
        let path_str = canonical.to_string_lossy().replace('\\', "/");
        // Strip UNC prefix \\?\ that canonicalize() adds on Windows
        let path_str = path_str.trim_start_matches("//?/");
        format!("file:///{}", path_str)
    };
    #[cfg(not(windows))]
    let plugin_url = format!("file://{}", canonical.display());

    // Deno eval script: import the function, call it with the config JSON, print the result.
    let script = format!(
        r#"import {{ {function} }} from "{plugin_url}";
const result = await {function}(Deno.env.get("NEXUS_CONFIG") ?? "{{}}");
console.log(result);"#
    );

    let mut cmd = Command::new("deno");
    cmd.args(["eval", &script])
        .env("NEXUS_CONFIG", config_json);

    // On Windows, prevent a visible CMD window from flashing on each plugin execution.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output().map_err(|e| {
            format!(
                "Failed to launch deno: {}. Install Deno: https://deno.com \
                 (Windows: winget install Deno.Deno)",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Plugin '{}' failed: {}", function, stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn parse_plugin_result(json: &str) -> Result<PluginResult, String> {
    serde_json::from_str(json).map_err(|e| {
        let preview = if json.len() > 200 { &json[..200] } else { json };
        format!("Failed to parse plugin result: {} (received: {}...)", e, preview)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_json() {
        let json = r#"{
            "items": [{
                "id": "jira-TEST-1",
                "source": "jira",
                "sourceId": "TEST-1",
                "type": "ticket",
                "title": "Fix login bug",
                "summary": "Users cannot log in",
                "url": "https://jira.example.com/browse/TEST-1",
                "author": "alice",
                "timestamp": 1000,
                "metadata": {},
                "tags": ["bug"]
            }],
            "notifications": [{
                "itemId": "jira-TEST-1",
                "reason": "assigned",
                "urgency": "medium"
            }]
        }"#;
        let result = parse_plugin_result(json).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.notifications.len(), 1);
        assert_eq!(result.items[0].id, "jira-TEST-1");
        assert_eq!(result.items[0].source_id, "TEST-1");
        assert_eq!(result.items[0].item_type, "ticket");
        assert_eq!(result.items[0].title, "Fix login bug");
        assert_eq!(result.items[0].summary, Some("Users cannot log in".to_string()));
    }

    #[test]
    fn parse_empty_arrays() {
        let json = r#"{"items":[],"notifications":[]}"#;
        let result = parse_plugin_result(json).unwrap();
        assert!(result.items.is_empty());
        assert!(result.notifications.is_empty());
    }

    #[test]
    fn parse_invalid_json() {
        let result = parse_plugin_result("not json at all");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse plugin result"));
    }

    #[test]
    fn parse_missing_items() {
        let json = r#"{"notifications":[]}"#;
        let result = parse_plugin_result(json);
        assert!(result.is_err());
    }

    #[test]
    fn parse_missing_notifications() {
        let json = r#"{"items":[]}"#;
        let result = parse_plugin_result(json);
        assert!(result.is_err());
    }

    #[test]
    fn parse_with_notifications() {
        let json = r#"{
            "items": [],
            "notifications": [{
                "itemId": "jira-PROJ-99",
                "reason": "mentioned_in_comment",
                "urgency": "high"
            }]
        }"#;
        let result = parse_plugin_result(json).unwrap();
        assert_eq!(result.notifications.len(), 1);
        // Verify serde rename: itemId JSON -> item_id Rust field
        assert_eq!(result.notifications[0].item_id, "jira-PROJ-99");
        assert_eq!(result.notifications[0].reason, "mentioned_in_comment");
        assert_eq!(result.notifications[0].urgency, "high");
    }

    #[test]
    fn parse_with_metadata() {
        let json = r#"{
            "items": [{
                "id": "jira-META-1",
                "source": "jira",
                "sourceId": "META-1",
                "type": "ticket",
                "title": "Metadata test",
                "summary": null,
                "url": "https://example.com",
                "author": null,
                "timestamp": 2000,
                "metadata": {"status": "in_progress", "sprint": 42, "labels": ["backend", "api"]},
                "tags": ["infra"]
            }],
            "notifications": []
        }"#;
        let result = parse_plugin_result(json).unwrap();
        let meta = &result.items[0].metadata;
        assert!(meta.is_object());
        assert_eq!(meta["status"], "in_progress");
        assert_eq!(meta["sprint"], 42);
        assert!(meta["labels"].is_array());
        assert_eq!(meta["labels"][0], "backend");
        assert_eq!(meta["labels"][1], "api");
    }
}
