use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::db::Database;
use crate::models::Notification;

/// Map machine-readable signal names to human-readable labels.
/// Comma-separated reasons are each mapped independently.
pub fn humanize_reason(reason: &str) -> String {
    reason
        .split(',')
        .map(|signal| match signal.trim() {
            "assigned_to_me" | "assigned" => "Assigned to you",
            "high_priority" | "priority_p1_blocker" => "High priority",
            "deadline_approaching" | "deadline_24h" => "Deadline approaching",
            "mentioned_in_comment" | "mentioned" => "You were mentioned",
            "vip_sender" => "VIP sender",
            "unread_over_4h" => "Unread for 4+ hours",
            "has_attachment" => "Has attachment",
            "pr_review_requested" => "Review requested",
            "ci_failed" => "CI failed",
            "pr_comment" => "Comment on your PR",
            other => other,
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// Determine whether a native notification should be sent, considering
/// focus mode and quiet hours settings.
pub fn should_send_notification(db: &Database, urgency: &str) -> bool {
    // Check quiet hours first
    if let (Ok(Some(start)), Ok(Some(end))) = (
        db.get_app_setting("quiet_hours_start"),
        db.get_app_setting("quiet_hours_end"),
    ) {
        if is_in_quiet_hours(&start, &end) {
            return false;
        }
    }

    // Check focus mode
    let focus_enabled = db
        .get_app_setting("focus_mode_enabled")
        .ok()
        .flatten()
        .unwrap_or_default();

    if focus_enabled == "1" {
        let threshold = db
            .get_app_setting("focus_mode_threshold")
            .ok()
            .flatten()
            .unwrap_or_else(|| "high".to_string());

        return urgency_meets_threshold(urgency, &threshold);
    }

    true
}

fn urgency_level(urgency: &str) -> u8 {
    match urgency {
        "critical" => 4,
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

fn urgency_meets_threshold(urgency: &str, threshold: &str) -> bool {
    urgency_level(urgency) >= urgency_level(threshold)
}

fn is_in_quiet_hours(start: &str, end: &str) -> bool {
    let now = chrono::Local::now().format("%H:%M").to_string();
    let now = now.as_str();
    if start <= end {
        // Same-day range: e.g. 09:00 - 17:00
        now >= start && now < end
    } else {
        // Overnight range: e.g. 22:00 - 08:00
        now >= start || now < end
    }
}

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
        .body(&humanize_reason(&notif.reason))
        .show();
}
