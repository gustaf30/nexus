use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::models::Notification;

/// Send a native OS notification for medium+ urgency items.
/// Low-urgency notifications are silently skipped (badge only in the UI).
pub fn send_native_notification(app: &AppHandle, notif: &Notification, title: &str) {
    let urgency_label = match notif.urgency.as_str() {
        "critical" => "[CRITICAL]",
        "high"     => "[HIGH]",
        "medium"   => "",
        _          => return, // low — no native notification
    };

    let notif_title = if urgency_label.is_empty() {
        title.to_string()
    } else {
        format!("{} {}", urgency_label, title)
    };

    let _ = app
        .notification()
        .builder()
        .title(&notif_title)
        .body(&notif.reason.replace(",", ", "))
        .show();
}
