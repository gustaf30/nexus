use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::db::Database;
use crate::models::{NexusItem, Notification, PluginConfig};
use crate::scheduler::Scheduler;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub plugins_dir: PathBuf,
}

#[tauri::command]
pub fn get_items(
    state: State<AppState>,
    source: Option<String>,
    unread_only: bool,
    limit: Option<i64>,
) -> Result<Vec<NexusItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_items(source.as_deref(), unread_only, limit.unwrap_or(100))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_read(state: State<AppState>, item_id: String, read: bool) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.mark_item_read(&item_id, read).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_notifications(state: State<AppState>) -> Result<Vec<Notification>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_active_notifications().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn dismiss_notification(state: State<AppState>, notif_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.dismiss_notification(&notif_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_plugin_config(
    state: State<AppState>,
    plugin_id: String,
) -> Result<Option<PluginConfig>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_plugin_config(&plugin_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_plugin_config(state: State<AppState>, config: PluginConfig) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_plugin_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn refresh_plugin(state: State<AppState>, plugin_id: String) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let scheduler = Scheduler::new(state.plugins_dir.clone());
    scheduler.poll_plugin(&plugin_id, &db)
}
