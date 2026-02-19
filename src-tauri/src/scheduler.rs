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
    /// Acquires and releases the DB lock internally so callers don't need to hold it.
    /// `app` is used to fire native OS notifications for medium+ urgency items.
    pub fn poll_plugin(
        &self,
        plugin_id: &str,
        db: &Arc<Mutex<Database>>,
        app: &AppHandle,
    ) -> Result<usize, String> {
        // -- Phase 1: read config (short lock) --
        let (credentials, config) = {
            let db_ref = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
            let config = db_ref
                .get_plugin_config(plugin_id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| format!("Plugin '{}' not configured", plugin_id))?;

            if !config.is_enabled {
                return Err(format!("Plugin '{}' is disabled", plugin_id));
            }

            let credentials = config
                .credentials
                .clone()
                .ok_or_else(|| format!("Plugin '{}' has no credentials", plugin_id))?;

            (credentials, config)
            // db_ref dropped here — lock released before subprocess call
        };

        let plugin_path = self.plugins_dir.join(format!("{}.ts", plugin_id));
        if !plugin_path.exists() {
            return Err(format!("Plugin file not found: {:?}", plugin_path));
        }

        // -- Phase 2: execute plugin (NO lock held — subprocess may take seconds) --
        let result_json = plugin_runtime::execute_plugin(&plugin_path, "fetch", &credentials)?;
        let result = plugin_runtime::parse_plugin_result(&result_json)?;

        let now = Utc::now().timestamp();

        // -- Phase 3: persist results (short lock) --
        {
            let db_ref = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

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
                        serde_json::to_string(&pi.metadata).unwrap_or_else(|e| {
                            eprintln!("[scheduler] {}: metadata serialization failed: {}", plugin_id, e);
                            "{}".to_string()
                        }),
                    ),
                    tags: Some(
                        serde_json::to_string(&pi.tags).unwrap_or_else(|e| {
                            eprintln!("[scheduler] {}: tags serialization failed: {}", plugin_id, e);
                            "[]".to_string()
                        }),
                    ),
                    is_read: false,
                    created_at: now,
                    updated_at: now,
                };
                db_ref.upsert_item(&item).map_err(|e| e.to_string())?;
            }

            for pn in &result.notifications {
                // Skip if an active notification already exists for this item+reason
                if db_ref
                    .has_active_notification(&pn.item_id, &pn.reason)
                    .unwrap_or(false)
                {
                    continue;
                }

                let notif = Notification {
                    id: Uuid::new_v4().to_string(),
                    item_id: pn.item_id.clone(),
                    reason: pn.reason.clone(),
                    urgency: pn.urgency.clone(),
                    is_dismissed: false,
                    created_at: now,
                };
                db_ref.insert_notification(&notif).map_err(|e| e.to_string())?;

                if let Some(item) = result.items.iter().find(|i| i.id == pn.item_id) {
                    if crate::notifications::should_send_notification(&db_ref, &pn.urgency) {
                        crate::notifications::send_native_notification(app, &notif, &item.title);
                    }
                }
            }

            let mut updated_config = config.clone();
            updated_config.last_poll_at = Some(now);
            updated_config.last_error = None;
            updated_config.error_count = 0;
            db_ref
                .upsert_plugin_config(&updated_config)
                .map_err(|e| e.to_string())?;
            // db_ref dropped here — lock released
        }

        Ok(result.items.len())
    }
}

/// Spawn a background tokio task that checks plugins every 30 seconds
/// and polls each one when its configured `poll_interval_secs` has elapsed.
pub fn start_polling(app: AppHandle, db: Arc<Mutex<Database>>, plugins_dir: PathBuf) {
    let scheduler = Scheduler::new(plugins_dir);

    tauri::async_runtime::spawn(async move {
        // Short heartbeat: check which plugins are due every 30s.
        let mut heartbeat = time::interval(Duration::from_secs(30));

        loop {
            heartbeat.tick().await;

            let now = Utc::now().timestamp();

            // Get enabled plugin configs (short lock, then release).
            let configs = match db.lock() {
                Ok(db_ref) => db_ref.get_enabled_plugin_configs().unwrap_or_default(),
                Err(e) => {
                    eprintln!("[scheduler] DB lock error: {}", e);
                    continue;
                }
            };

            // Poll each plugin only if its interval has elapsed since last_poll_at.
            for config in &configs {
                let elapsed = match config.last_poll_at {
                    Some(last) => now - last,
                    None => i64::MAX, // never polled → poll immediately
                };

                if elapsed < config.poll_interval_secs {
                    continue;
                }

                match scheduler.poll_plugin(&config.plugin_id, &db, &app) {
                    Ok(count) => {
                        println!("[scheduler] {}: fetched {} items", config.plugin_id, count);
                        let _ = app.emit("items-updated", config.plugin_id.as_str());
                    }
                    Err(e) => {
                        let silent = e.contains("no credentials")
                            || e.contains("not configured")
                            || e.contains("disabled");
                        if !silent {
                            eprintln!("[scheduler] {} poll error: {}", config.plugin_id, e);
                        }
                    }
                }
            }
        }
    });
}
