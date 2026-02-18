use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Utc;
use tauri::{AppHandle, Emitter};
use tokio::time;
use uuid::Uuid;

use crate::db::Database;
use crate::models::{NexusItem, Notification};
use crate::plugin_runtime;

pub struct Scheduler {
    plugins_dir: PathBuf,
}

impl Scheduler {
    pub fn new(plugins_dir: PathBuf) -> Self {
        Self { plugins_dir }
    }

    /// Poll a single plugin by ID, persist results to the database, and return the item count.
    /// `app` is used to fire native OS notifications for medium+ urgency items.
    pub fn poll_plugin(&self, plugin_id: &str, db: &Database, app: &AppHandle) -> Result<usize, String> {
        let config = db
            .get_plugin_config(plugin_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Plugin '{}' not configured", plugin_id))?;

        if !config.is_enabled {
            return Err(format!("Plugin '{}' is disabled", plugin_id));
        }

        // Clone credentials so `config` remains intact for the update below.
        let credentials = config
            .credentials
            .clone()
            .ok_or_else(|| format!("Plugin '{}' has no credentials", plugin_id))?;

        let plugin_path = self.plugins_dir.join(format!("{}.ts", plugin_id));
        if !plugin_path.exists() {
            return Err(format!("Plugin file not found: {:?}", plugin_path));
        }

        let result_json = plugin_runtime::execute_plugin(&plugin_path, "fetch", &credentials)?;
        let result = plugin_runtime::parse_plugin_result(&result_json)?;

        let now = Utc::now().timestamp();

        // Upsert items.
        for pi in &result.items {
            let item = NexusItem {
                id: pi.id.clone(),
                source: pi.source.clone(),
                source_id: pi.source_id.clone(),
                item_type: pi.item_type.clone(),
                title: pi.title.clone(),
                summary: pi.summary.clone(),
                url: pi.url.clone(),
                author: pi.author.clone(),
                timestamp: pi.timestamp,
                priority: 0,
                metadata: Some(
                    serde_json::to_string(&pi.metadata).unwrap_or_default(),
                ),
                tags: Some(serde_json::to_string(&pi.tags).unwrap_or_default()),
                is_read: false,
                created_at: now,
                updated_at: now,
            };
            db.upsert_item(&item).map_err(|e| e.to_string())?;
        }

        // Insert notifications and send native OS notifications for medium+ urgency.
        for pn in &result.notifications {
            let notif = Notification {
                id: Uuid::new_v4().to_string(),
                item_id: pn.item_id.clone(),
                reason: pn.reason.clone(),
                urgency: pn.urgency.clone(),
                is_dismissed: false,
                created_at: now,
            };
            db.insert_notification(&notif).map_err(|e| e.to_string())?;

            // Find the corresponding item title to use as the notification heading.
            if let Some(item) = result.items.iter().find(|i| i.id == pn.item_id) {
                crate::notifications::send_native_notification(app, &notif, &item.title);
            }
        }

        // Update last_poll_at and clear error state.
        let mut updated_config = config.clone();
        updated_config.last_poll_at = Some(now);
        updated_config.last_error = None;
        updated_config.error_count = 0;
        db.upsert_plugin_config(&updated_config)
            .map_err(|e| e.to_string())?;

        Ok(result.items.len())
    }
}

/// Spawn a background tokio task that polls each configured plugin every 10 minutes.
pub fn start_polling(app: AppHandle, db: Arc<Mutex<Database>>, plugins_dir: PathBuf) {
    let scheduler = Scheduler::new(plugins_dir);

    tauri::async_runtime::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(600));

        loop {
            interval.tick().await;

            if let Ok(db_ref) = db.lock() {
                match scheduler.poll_plugin("jira", &db_ref, &app) {
                    Ok(count) => {
                        println!("[scheduler] jira: fetched {} items", count);
                        let _ = app.emit("items-updated", "jira");
                    }
                    Err(e) => {
                        eprintln!("[scheduler] jira poll error: {}", e);
                    }
                }
            }
        }
    });
}
