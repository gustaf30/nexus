use rusqlite::{params, Connection, Result};
use std::path::PathBuf;

use crate::models::{HeuristicWeight, NexusItem, Notification, PluginConfig};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        // Enable foreign key enforcement (off by default in SQLite).
        self.conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT,
                url TEXT NOT NULL,
                author TEXT,
                timestamp INTEGER NOT NULL,
                priority INTEGER DEFAULT 0,
                metadata TEXT,
                tags TEXT,
                is_read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(source, source_id)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                urgency TEXT NOT NULL,
                is_dismissed INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plugin_config (
                plugin_id TEXT PRIMARY KEY,
                is_enabled INTEGER DEFAULT 1,
                credentials TEXT,
                poll_interval_secs INTEGER DEFAULT 600,
                last_poll_at INTEGER,
                last_error TEXT,
                error_count INTEGER DEFAULT 0,
                settings TEXT
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS heuristic_weights (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                signal TEXT NOT NULL,
                weight INTEGER NOT NULL,
                UNIQUE(source, signal)
            );

            CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
            CREATE INDEX IF NOT EXISTS idx_items_timestamp ON items(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority DESC);
            CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read);
            CREATE INDEX IF NOT EXISTS idx_notifications_urgency ON notifications(urgency);
            CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(is_dismissed);
        ",
        )?;

        // Migration: recreate notifications table with ON DELETE CASCADE if it exists
        // without it. This handles existing dev databases created before the CASCADE was added.
        self.migrate_notifications_cascade()?;

        Ok(())
    }

    /// Recreate the notifications table with ON DELETE CASCADE if the FK lacks it.
    fn migrate_notifications_cascade(&self) -> Result<()> {
        // Check if the table's FK already has CASCADE by inspecting the schema SQL.
        let schema: String = self
            .conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_default();

        if schema.contains("ON DELETE CASCADE") {
            return Ok(()); // already migrated
        }

        // Recreate via the standard SQLite migration pattern: rename → create → copy → drop.
        self.conn.execute_batch(
            "
            ALTER TABLE notifications RENAME TO _notifications_old;

            CREATE TABLE notifications (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                urgency TEXT NOT NULL,
                is_dismissed INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            INSERT INTO notifications SELECT * FROM _notifications_old;
            DROP TABLE _notifications_old;

            CREATE INDEX IF NOT EXISTS idx_notifications_urgency ON notifications(urgency);
            CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(is_dismissed);
        ",
        )?;

        Ok(())
    }

    // -- Items --

    pub fn upsert_item(&self, item: &NexusItem) -> Result<()> {
        self.conn.execute(
            "INSERT INTO items (id, source, source_id, item_type, title, summary, url, author,
                               timestamp, priority, metadata, tags, is_read, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
             ON CONFLICT(source, source_id) DO UPDATE SET
                title=excluded.title, summary=excluded.summary, url=excluded.url,
                author=excluded.author, timestamp=excluded.timestamp, priority=excluded.priority,
                metadata=excluded.metadata, tags=excluded.tags, updated_at=excluded.updated_at",
            params![
                item.id,
                item.source,
                item.source_id,
                item.item_type,
                item.title,
                item.summary,
                item.url,
                item.author,
                item.timestamp,
                item.priority,
                item.metadata,
                item.tags,
                item.is_read as i32,
                item.created_at,
                item.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_items(
        &self,
        source: Option<&str>,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<NexusItem>> {
        let mut sql = String::from("SELECT * FROM items WHERE 1=1");
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

        if let Some(s) = source {
            sql.push_str(" AND source = ?");
            param_values.push(Box::new(s.to_string()));
        }
        if unread_only {
            sql.push_str(" AND is_read = 0");
        }
        sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
        param_values.push(Box::new(limit));

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = self.conn.prepare(&sql)?;
        let items = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(NexusItem {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    source_id: row.get(2)?,
                    item_type: row.get(3)?,
                    title: row.get(4)?,
                    summary: row.get(5)?,
                    url: row.get(6)?,
                    author: row.get(7)?,
                    timestamp: row.get(8)?,
                    priority: row.get(9)?,
                    metadata: row.get(10)?,
                    tags: row.get(11)?,
                    is_read: row.get::<_, i32>(12)? != 0,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(items)
    }

    pub fn mark_item_read(&self, item_id: &str, read: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE items SET is_read = ?1 WHERE id = ?2",
            params![read as i32, item_id],
        )?;
        Ok(())
    }

    // -- Notifications --

    pub fn insert_notification(&self, notif: &Notification) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO notifications (id, item_id, reason, urgency, is_dismissed, created_at)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                notif.id,
                notif.item_id,
                notif.reason,
                notif.urgency,
                notif.is_dismissed as i32,
                notif.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_active_notifications(&self) -> Result<Vec<Notification>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM notifications WHERE is_dismissed = 0 ORDER BY created_at DESC",
        )?;
        let notifs = stmt
            .query_map([], |row| {
                Ok(Notification {
                    id: row.get(0)?,
                    item_id: row.get(1)?,
                    reason: row.get(2)?,
                    urgency: row.get(3)?,
                    is_dismissed: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(notifs)
    }

    pub fn dismiss_notification(&self, notif_id: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE notifications SET is_dismissed = 1 WHERE id = ?1",
            params![notif_id],
        )?;
        Ok(())
    }

    /// Returns true if an active (non-dismissed) notification already exists
    /// for the given item_id and reason combination.
    pub fn has_active_notification(&self, item_id: &str, reason: &str) -> Result<bool> {
        let count: i32 = self.conn.query_row(
            "SELECT COUNT(*) FROM notifications WHERE item_id = ?1 AND reason = ?2 AND is_dismissed = 0",
            params![item_id, reason],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn dismiss_all_notifications(&self) -> Result<()> {
        self.conn.execute(
            "UPDATE notifications SET is_dismissed = 1 WHERE is_dismissed = 0",
            [],
        )?;
        Ok(())
    }

    // -- App Settings --

    pub fn get_app_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn set_app_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // -- Plugin Config --

    pub fn get_plugin_config(&self, plugin_id: &str) -> Result<Option<PluginConfig>> {
        let mut stmt = self
            .conn
            .prepare("SELECT * FROM plugin_config WHERE plugin_id = ?1")?;
        let mut rows = stmt.query_map(params![plugin_id], |row| {
            Ok(PluginConfig {
                plugin_id: row.get(0)?,
                is_enabled: row.get::<_, i32>(1)? != 0,
                credentials: row.get(2)?,
                poll_interval_secs: row.get(3)?,
                last_poll_at: row.get(4)?,
                last_error: row.get(5)?,
                error_count: row.get(6)?,
                settings: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn upsert_plugin_config(&self, config: &PluginConfig) -> Result<()> {
        self.conn.execute(
            "INSERT INTO plugin_config (plugin_id, is_enabled, credentials, poll_interval_secs,
                                        last_poll_at, last_error, error_count, settings)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
             ON CONFLICT(plugin_id) DO UPDATE SET
                is_enabled=excluded.is_enabled, credentials=excluded.credentials,
                poll_interval_secs=excluded.poll_interval_secs, last_poll_at=excluded.last_poll_at,
                last_error=excluded.last_error, error_count=excluded.error_count,
                settings=excluded.settings",
            params![
                config.plugin_id,
                config.is_enabled as i32,
                config.credentials,
                config.poll_interval_secs,
                config.last_poll_at,
                config.last_error,
                config.error_count,
                config.settings,
            ],
        )?;
        Ok(())
    }

    /// Return full configs for enabled plugins with credentials.
    pub fn get_enabled_plugin_configs(&self) -> Result<Vec<PluginConfig>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM plugin_config WHERE is_enabled = 1 AND credentials IS NOT NULL",
        )?;
        let configs = stmt
            .query_map([], |row| {
                Ok(PluginConfig {
                    plugin_id: row.get(0)?,
                    is_enabled: row.get::<_, i32>(1)? != 0,
                    credentials: row.get(2)?,
                    poll_interval_secs: row.get(3)?,
                    last_poll_at: row.get(4)?,
                    last_error: row.get(5)?,
                    error_count: row.get(6)?,
                    settings: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<PluginConfig>>>()?;
        Ok(configs)
    }

    // -- Heuristic Weights --

    pub fn get_weights(&self, source: &str) -> Result<Vec<HeuristicWeight>> {
        let mut stmt = self
            .conn
            .prepare("SELECT * FROM heuristic_weights WHERE source = ?1")?;
        let weights = stmt
            .query_map(params![source], |row| {
                Ok(HeuristicWeight {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    signal: row.get(2)?,
                    weight: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(weights)
    }

    pub fn upsert_weight(&self, weight: &HeuristicWeight) -> Result<()> {
        self.conn.execute(
            "INSERT INTO heuristic_weights (id, source, signal, weight)
             VALUES (?1,?2,?3,?4)
             ON CONFLICT(source, signal) DO UPDATE SET weight=excluded.weight",
            params![weight.id, weight.source, weight.signal, weight.weight],
        )?;
        Ok(())
    }

    pub fn seed_default_weights(&self) -> Result<()> {
        let defaults = vec![
            ("jira", "assigned_to_me", 3),
            ("jira", "priority_p1_blocker", 4),
            ("jira", "mentioned_in_comment", 2),
            ("jira", "deadline_24h", 3),
        ];
        for (source, signal, weight) in defaults {
            let hw = HeuristicWeight {
                id: format!("{}-{}", source, signal),
                source: source.to_string(),
                signal: signal.to_string(),
                weight,
            };
            self.upsert_weight(&hw)?;
        }
        Ok(())
    }

    #[cfg(test)]
    pub fn new_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{NexusItem, Notification, PluginConfig};

    fn make_item() -> NexusItem {
        NexusItem {
            id: "jira-TEST-1".to_string(),
            source: "jira".to_string(),
            source_id: "TEST-1".to_string(),
            item_type: "ticket".to_string(),
            title: "Fix login bug".to_string(),
            summary: Some("Users cannot log in with SSO".to_string()),
            url: "https://jira.example.com/browse/TEST-1".to_string(),
            author: Some("alice".to_string()),
            timestamp: 1000,
            priority: 3,
            metadata: Some(r#"{"status":"open"}"#.to_string()),
            tags: Some(r#"["bug","auth"]"#.to_string()),
            is_read: false,
            created_at: 900,
            updated_at: 950,
        }
    }

    fn make_notification() -> Notification {
        Notification {
            id: "notif-1".to_string(),
            item_id: "jira-TEST-1".to_string(),
            reason: "assigned".to_string(),
            urgency: "medium".to_string(),
            is_dismissed: false,
            created_at: 1000,
        }
    }

    #[test]
    fn new_creates_tables() {
        let db = Database::new_in_memory().expect("in-memory db should succeed");
        let items = db.get_items(None, false, 100).unwrap();
        assert!(items.is_empty());
    }

    #[test]
    fn upsert_and_get_roundtrip() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        let items = db.get_items(None, false, 100).unwrap();
        assert_eq!(items.len(), 1);
        let got = &items[0];
        assert_eq!(got.id, item.id);
        assert_eq!(got.source, item.source);
        assert_eq!(got.source_id, item.source_id);
        assert_eq!(got.item_type, item.item_type);
        assert_eq!(got.title, item.title);
        assert_eq!(got.summary, item.summary);
        assert_eq!(got.url, item.url);
        assert_eq!(got.author, item.author);
        assert_eq!(got.timestamp, item.timestamp);
        assert_eq!(got.priority, item.priority);
        assert_eq!(got.metadata, item.metadata);
        assert_eq!(got.tags, item.tags);
        assert_eq!(got.is_read, item.is_read);
        assert_eq!(got.created_at, item.created_at);
        assert_eq!(got.updated_at, item.updated_at);
    }

    #[test]
    fn upsert_conflict_preserves_is_read() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        // Mark as read
        db.mark_item_read(&item.id, true).unwrap();

        // Upsert same source+source_id with updated title
        let mut updated = item.clone();
        updated.title = "Updated title".to_string();
        updated.is_read = false; // plugin sends is_read=false
        updated.updated_at = 2000;
        db.upsert_item(&updated).unwrap();

        let items = db.get_items(None, false, 100).unwrap();
        assert_eq!(items.len(), 1);
        // is_read should still be true (ON CONFLICT does not update is_read)
        assert!(items[0].is_read, "is_read should be preserved on conflict");
        assert_eq!(items[0].title, "Updated title");
    }

    #[test]
    fn get_items_filters_by_source() {
        let db = Database::new_in_memory().unwrap();

        let jira_item = make_item();
        db.upsert_item(&jira_item).unwrap();

        let mut gh_item = make_item();
        gh_item.id = "github-PR-42".to_string();
        gh_item.source = "github".to_string();
        gh_item.source_id = "PR-42".to_string();
        db.upsert_item(&gh_item).unwrap();

        let jira_only = db.get_items(Some("jira"), false, 100).unwrap();
        assert_eq!(jira_only.len(), 1);
        assert_eq!(jira_only[0].source, "jira");
    }

    #[test]
    fn get_items_filters_unread_only() {
        let db = Database::new_in_memory().unwrap();

        let item1 = make_item();
        db.upsert_item(&item1).unwrap();

        let mut item2 = make_item();
        item2.id = "jira-TEST-2".to_string();
        item2.source_id = "TEST-2".to_string();
        item2.timestamp = 2000;
        db.upsert_item(&item2).unwrap();

        // Mark item1 as read
        db.mark_item_read(&item1.id, true).unwrap();

        let unread = db.get_items(None, true, 100).unwrap();
        assert_eq!(unread.len(), 1);
        assert_eq!(unread[0].id, "jira-TEST-2");
    }

    #[test]
    fn get_items_respects_limit() {
        let db = Database::new_in_memory().unwrap();

        for i in 0..5 {
            let mut item = make_item();
            item.id = format!("jira-TEST-{}", i);
            item.source_id = format!("TEST-{}", i);
            item.timestamp = 1000 + i;
            db.upsert_item(&item).unwrap();
        }

        let items = db.get_items(None, false, 2).unwrap();
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn get_items_orders_by_timestamp_desc() {
        let db = Database::new_in_memory().unwrap();

        for (i, ts) in [(0, 100i64), (1, 300), (2, 200)] {
            let mut item = make_item();
            item.id = format!("jira-TEST-{}", i);
            item.source_id = format!("TEST-{}", i);
            item.timestamp = ts;
            db.upsert_item(&item).unwrap();
        }

        let items = db.get_items(None, false, 100).unwrap();
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].timestamp, 300);
        assert_eq!(items[1].timestamp, 200);
        assert_eq!(items[2].timestamp, 100);
    }

    #[test]
    fn mark_item_read_toggles() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();
        assert!(!db.get_items(None, false, 1).unwrap()[0].is_read);

        db.mark_item_read(&item.id, true).unwrap();
        assert!(db.get_items(None, false, 1).unwrap()[0].is_read);

        db.mark_item_read(&item.id, false).unwrap();
        assert!(!db.get_items(None, false, 1).unwrap()[0].is_read);

        db.mark_item_read(&item.id, true).unwrap();
        assert!(db.get_items(None, false, 1).unwrap()[0].is_read);
    }

    #[test]
    fn insert_and_get_notifications() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        let notif = make_notification();
        db.insert_notification(&notif).unwrap();

        let active = db.get_active_notifications().unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, notif.id);
        assert_eq!(active[0].item_id, notif.item_id);
        assert_eq!(active[0].reason, notif.reason);
        assert_eq!(active[0].urgency, notif.urgency);
        assert!(!active[0].is_dismissed);
    }

    #[test]
    fn insert_notification_duplicate_ignored() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        let notif = make_notification();
        db.insert_notification(&notif).unwrap();
        db.insert_notification(&notif).unwrap(); // duplicate — INSERT OR IGNORE

        let active = db.get_active_notifications().unwrap();
        assert_eq!(active.len(), 1);
    }

    #[test]
    fn dismiss_excludes_from_active() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        let notif = make_notification();
        db.insert_notification(&notif).unwrap();

        db.dismiss_notification(&notif.id).unwrap();

        let active = db.get_active_notifications().unwrap();
        assert!(active.is_empty());
    }

    #[test]
    fn has_active_notification_detects_existing() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        // No notification yet
        assert!(!db.has_active_notification(&item.id, "assigned").unwrap());

        // Insert one
        let notif = make_notification();
        db.insert_notification(&notif).unwrap();
        assert!(db.has_active_notification(&item.id, "assigned").unwrap());

        // Different reason — should be false
        assert!(!db.has_active_notification(&item.id, "deadline_approaching").unwrap());

        // Dismiss it — should become false
        db.dismiss_notification(&notif.id).unwrap();
        assert!(!db.has_active_notification(&item.id, "assigned").unwrap());
    }

    #[test]
    fn dismiss_all_notifications_clears_active() {
        let db = Database::new_in_memory().unwrap();
        let item = make_item();
        db.upsert_item(&item).unwrap();

        // Insert two notifications
        let n1 = make_notification();
        db.insert_notification(&n1).unwrap();

        let n2 = Notification {
            id: "notif-2".to_string(),
            item_id: item.id.clone(),
            reason: "high_priority".to_string(),
            urgency: "high".to_string(),
            is_dismissed: false,
            created_at: 1000,
        };
        db.insert_notification(&n2).unwrap();

        assert_eq!(db.get_active_notifications().unwrap().len(), 2);

        db.dismiss_all_notifications().unwrap();
        assert_eq!(db.get_active_notifications().unwrap().len(), 0);
    }

    #[test]
    fn app_settings_roundtrip() {
        let db = Database::new_in_memory().unwrap();

        assert!(db.get_app_setting("focus_mode_enabled").unwrap().is_none());

        db.set_app_setting("focus_mode_enabled", "1").unwrap();
        assert_eq!(
            db.get_app_setting("focus_mode_enabled").unwrap(),
            Some("1".to_string())
        );

        // Update existing
        db.set_app_setting("focus_mode_enabled", "0").unwrap();
        assert_eq!(
            db.get_app_setting("focus_mode_enabled").unwrap(),
            Some("0".to_string())
        );
    }

    #[test]
    fn get_plugin_config_none() {
        let db = Database::new_in_memory().unwrap();
        let config = db.get_plugin_config("nonexistent").unwrap();
        assert!(config.is_none());
    }

    #[test]
    fn plugin_config_roundtrip() {
        let db = Database::new_in_memory().unwrap();
        let config = PluginConfig {
            plugin_id: "jira".to_string(),
            is_enabled: true,
            credentials: Some(r#"{"token":"abc"}"#.to_string()),
            poll_interval_secs: 300,
            last_poll_at: Some(5000),
            last_error: None,
            error_count: 0,
            settings: Some(r#"{"project":"PROJ"}"#.to_string()),
        };
        db.upsert_plugin_config(&config).unwrap();

        let got = db.get_plugin_config("jira").unwrap().expect("should exist");
        assert_eq!(got.plugin_id, config.plugin_id);
        assert_eq!(got.is_enabled, config.is_enabled);
        assert_eq!(got.credentials, config.credentials);
        assert_eq!(got.poll_interval_secs, config.poll_interval_secs);
        assert_eq!(got.last_poll_at, config.last_poll_at);
        assert_eq!(got.last_error, config.last_error);
        assert_eq!(got.error_count, config.error_count);
        assert_eq!(got.settings, config.settings);
    }

    #[test]
    fn plugin_config_updates_on_conflict() {
        let db = Database::new_in_memory().unwrap();
        let config = PluginConfig {
            plugin_id: "jira".to_string(),
            is_enabled: true,
            credentials: Some(r#"{"token":"old"}"#.to_string()),
            poll_interval_secs: 300,
            last_poll_at: None,
            last_error: None,
            error_count: 0,
            settings: None,
        };
        db.upsert_plugin_config(&config).unwrap();

        let mut updated = config.clone();
        updated.credentials = Some(r#"{"token":"new"}"#.to_string());
        db.upsert_plugin_config(&updated).unwrap();

        let got = db.get_plugin_config("jira").unwrap().expect("should exist");
        assert_eq!(got.credentials, Some(r#"{"token":"new"}"#.to_string()));
    }

    #[test]
    fn seed_default_weights() {
        let db = Database::new_in_memory().unwrap();
        db.seed_default_weights().unwrap();

        let weights = db.get_weights("jira").unwrap();
        assert_eq!(weights.len(), 4);

        let find = |signal: &str| weights.iter().find(|w| w.signal == signal).unwrap();
        assert_eq!(find("assigned_to_me").weight, 3);
        assert_eq!(find("priority_p1_blocker").weight, 4);
        assert_eq!(find("mentioned_in_comment").weight, 2);
        assert_eq!(find("deadline_24h").weight, 3);
    }

    #[test]
    fn seed_weights_idempotent() {
        let db = Database::new_in_memory().unwrap();
        db.seed_default_weights().unwrap();
        db.seed_default_weights().unwrap();

        let weights = db.get_weights("jira").unwrap();
        assert_eq!(weights.len(), 4);
    }
}
