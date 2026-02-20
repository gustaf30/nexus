import { useEffect } from "react";
import type { NexusItem } from "../types";

interface Options {
  view: "dashboard" | "settings";
  filteredItems: NexusItem[];
  selectedItem: NexusItem | null;
  setSelectedItem: (item: NexusItem | null) => void;
  setView: (view: "dashboard" | "settings") => void;
  setPaletteOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  markRead: (id: string, read: boolean) => void;
  onRefresh: () => void;
}

/**
 * Global keyboard shortcuts for Nexus Hub.
 *
 * - Ctrl+R: refresh plugins
 * - Ctrl+,: toggle settings
 * - Ctrl+K: command palette
 * - j/k: navigate feed items
 * - Enter: open selected item URL
 * - m: toggle read/unread
 * - Escape: deselect or close settings
 */
export function useKeyboardNavigation({
  view,
  filteredItems,
  selectedItem,
  setSelectedItem,
  setView,
  setPaletteOpen,
  markRead,
  onRefresh,
}: Options) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+R — refresh plugins
      if (mod && e.key === "r") {
        e.preventDefault();
        onRefresh();
      }

      // Ctrl+, — toggle settings
      if (mod && e.key === ",") {
        e.preventDefault();
        setView(view === "settings" ? "dashboard" : "settings");
      }

      // Ctrl+K — command palette
      if (mod && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v: boolean) => !v);
      }

      // j/k/Enter/m — feed navigation (only on dashboard, not when typing)
      if (view === "dashboard" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        if (e.key === "j") {
          e.preventDefault();
          const idx = selectedItem ? filteredItems.findIndex((i) => i.id === selectedItem.id) : -1;
          const next = idx + 1 < filteredItems.length ? idx + 1 : 0;
          setSelectedItem(filteredItems[next] ?? null);
          return;
        }
        if (e.key === "k") {
          e.preventDefault();
          const idx = selectedItem ? filteredItems.findIndex((i) => i.id === selectedItem.id) : 0;
          const next = idx > 0 ? idx - 1 : filteredItems.length - 1;
          setSelectedItem(filteredItems[next] ?? null);
          return;
        }
        if (e.key === "Enter" && selectedItem?.url) {
          e.preventDefault();
          import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
            openUrl(selectedItem.url).catch(console.error);
          });
          return;
        }
        if (e.key === "m" && selectedItem) {
          e.preventDefault();
          markRead(selectedItem.id, !selectedItem.is_read);
          return;
        }
      }

      // Escape — deselect item or close settings
      if (e.key === "Escape") {
        if (view === "settings") {
          setView("dashboard");
        } else {
          setSelectedItem(null);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view, filteredItems, selectedItem, setSelectedItem, setView, setPaletteOpen, markRead, onRefresh]);
}
