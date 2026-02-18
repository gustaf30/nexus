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

    let output = Command::new("deno")
        .args([
            "eval",
            "--allow-net",
            "--allow-env=NEXUS_CONFIG",
            &script,
        ])
        .env("NEXUS_CONFIG", config_json)
        .output()
        .map_err(|e| {
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
    serde_json::from_str(json).map_err(|e| format!("Failed to parse plugin result: {}", e))
}
