import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface NexusItem {
  id: string;
  source: string;
  source_id: string;
  item_type: string;
  title: string;
  summary: string | null;
  url: string;
  author: string | null;
  timestamp: number;       // Unix seconds
  priority: number;
  metadata: string | null; // JSON string
  tags: string | null;     // JSON array string
  is_read: boolean;
  created_at: number;
  updated_at: number;
}

export function useItems(source: string | null, unreadOnly: boolean) {
  const [items, setItems]   = useState<NexusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<NexusItem[]>("get_items", {
        source,
        unreadOnly,
        limit: 100,
      });
      setItems(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [source, unreadOnly]);

  // Initial fetch and re-fetch on filter changes.
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Re-fetch whenever the scheduler emits items-updated.
  useEffect(() => {
    const unlisten = listen("items-updated", () => {
      fetchItems();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchItems]);

  /** Trigger a single plugin poll then refresh the list. */
  const refresh = useCallback(async (pluginId: string) => {
    setLoading(true);
    setError(null);
    try {
      await invoke("refresh_plugin", { pluginId });
      await fetchItems();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  /** Poll all given plugins sequentially, then refresh the list once. */
  const refreshAll = useCallback(async (pluginIds: string[]) => {
    setLoading(true);
    setError(null);
    const errors: string[] = [];
    for (const pluginId of pluginIds) {
      try {
        await invoke("refresh_plugin", { pluginId });
      } catch (e) {
        const msg = String(e);
        // Silently ignore unconfigured plugins.
        if (!msg.includes("no credentials") && !msg.includes("not configured")) {
          errors.push(`${pluginId}: ${msg}`);
        }
      }
    }
    await fetchItems();
    if (errors.length > 0) setError(errors.join(" | "));
    setLoading(false);
  }, [fetchItems]);

  /** Optimistically flip is_read, then persist via IPC. */
  const markRead = useCallback(async (itemId: string, read: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, is_read: read } : item))
    );
    try {
      await invoke("mark_read", { itemId, read });
    } catch (e) {
      // Roll back optimistic update on failure.
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, is_read: !read } : item))
      );
      console.error("markRead failed:", e);
    }
  }, []);

  return { items, loading, error, refresh, refreshAll, markRead };
}
