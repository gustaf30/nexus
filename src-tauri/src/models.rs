use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NexusItem {
    pub id: String,
    pub source: String,
    pub source_id: String,
    pub item_type: String,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub author: Option<String>,
    pub timestamp: i64,
    pub priority: i32,
    pub metadata: Option<String>, // JSON string
    pub tags: Option<String>,     // JSON array string
    pub is_read: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub item_id: String,
    pub reason: String,
    pub urgency: String,
    pub is_dismissed: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub plugin_id: String,
    pub is_enabled: bool,
    pub credentials: Option<String>, // Encrypted JSON
    pub poll_interval_secs: i64,
    pub last_poll_at: Option<i64>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub settings: Option<String>, // JSON
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeuristicWeight {
    pub id: String,
    pub source: String,
    pub signal: String,
    pub weight: i32,
}
