import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useItems } from "./useItems";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { makeItem } from "../test/fixtures";

describe("useItems", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(listen).mockReset();
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  it("fetches items on mount via invoke('get_items')", async () => {
    const items = [makeItem({ id: "a" })];
    vi.mocked(invoke).mockResolvedValue(items);

    const { result } = renderHook(() => useItems(null, false));

    await waitFor(() => {
      expect(result.current.items).toEqual(items);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_items", {
      source: null,
      unreadOnly: false,
      limit: 100,
    });
  });

  it("sets error state on invoke failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("DB unavailable"));

    const { result } = renderHook(() => useItems(null, false));

    await waitFor(() => {
      expect(result.current.error).toBe("Error: DB unavailable");
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("refresh() calls invoke('refresh_plugin') then refetches", async () => {
    const items = [makeItem()];
    vi.mocked(invoke).mockResolvedValue(items);

    const { result } = renderHook(() => useItems(null, false));

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.items).toEqual(items);
    });

    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockResolvedValue(items);

    await act(async () => {
      await result.current.refresh("jira");
    });

    const calls = vi.mocked(invoke).mock.calls;
    expect(calls.some((c) => c[0] === "refresh_plugin" && (c[1] as Record<string, string>).pluginId === "jira")).toBe(true);
    expect(calls.some((c) => c[0] === "get_items")).toBe(true);
  });

  it("markRead() optimistically updates state", async () => {
    const item = makeItem({ id: "x1", is_read: false });
    // First call: get_items returns unread item. Subsequent calls resolve.
    vi.mocked(invoke).mockResolvedValue([item]);

    const { result } = renderHook(() => useItems(null, false));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    // Make mark_read hang so we can check optimistic state
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "mark_read") return new Promise(() => {}); // never resolves
      return Promise.resolve([item]);
    });

    act(() => {
      result.current.markRead("x1", true);
    });

    // Optimistic update should happen synchronously
    await waitFor(() => {
      expect(result.current.items[0].is_read).toBe(true);
    });
  });

  it("markRead() rolls back on invoke failure", async () => {
    const item = makeItem({ id: "x2", is_read: false });
    vi.mocked(invoke).mockResolvedValue([item]);

    const { result } = renderHook(() => useItems(null, false));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    // Make mark_read reject
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "mark_read") return Promise.reject(new Error("write failed"));
      return Promise.resolve([item]);
    });

    await act(async () => {
      await result.current.markRead("x2", true);
    });

    // Should have rolled back
    await waitFor(() => {
      expect(result.current.items[0].is_read).toBe(false);
    });
  });
});
