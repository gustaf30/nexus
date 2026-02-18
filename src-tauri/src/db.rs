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
                item_id TEXT NOT NULL REFERENCES items(id),
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
}
