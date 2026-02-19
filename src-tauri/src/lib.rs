mod commands;
mod db;
mod models;
mod notifications;
mod plugin_runtime;
mod scheduler;

use std::sync::{Arc, Mutex};

use commands::AppState;
use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            std::fs::create_dir_all(&app_dir)
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;

            let db_path = app_dir.join("nexus-hub.db");
            let db = Arc::new(Mutex::new(
                Database::new(db_path)
                    .map_err(|e| format!("Failed to init database: {}", e))?,
            ));
            db.lock()
                .map_err(|e| format!("DB lock poisoned during setup: {}", e))?
                .seed_default_weights()
                .map_err(|e| format!("Failed to seed default weights: {}", e))?;

            let plugins_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource dir: {}", e))?
                .join("plugins");

            app.manage(AppState {
                db: Arc::clone(&db),
                plugins_dir: plugins_dir.clone(),
            });

            scheduler::start_polling(app.handle().clone(), Arc::clone(&db), plugins_dir);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_items,
            commands::mark_read,
            commands::get_notifications,
            commands::dismiss_notification,
            commands::dismiss_all_notifications,
            commands::get_app_setting,
            commands::set_app_setting,
            commands::get_plugin_config,
            commands::save_plugin_config,
            commands::refresh_plugin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
