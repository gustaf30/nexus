import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface Notification {
  id: string;
  item_id: string;
  reason: string;
  urgency: string;
  is_dismissed: boolean;
  created_at: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await invoke<Notification[]>("get_notifications");
      setNotifications(result);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Re-fetch when items update (new notifications may have been created)
  useEffect(() => {
    const unlisten = listen("items-updated", () => {
      fetchNotifications();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchNotifications]);

  const dismiss = useCallback(async (notifId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await invoke("dismiss_notification", { notifId });
    } catch (e) {
      console.error("Failed to dismiss notification:", e);
      fetchNotifications(); // rollback
    }
  }, [fetchNotifications]);

  const dismissAll = useCallback(async () => {
    setNotifications([]);
    try {
      await invoke("dismiss_all_notifications");
    } catch (e) {
      console.error("Failed to dismiss all:", e);
      fetchNotifications(); // rollback
    }
  }, [fetchNotifications]);

  return { notifications, dismiss, dismissAll, refresh: fetchNotifications };
}
