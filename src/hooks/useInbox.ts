import { useCallback, useEffect, useState } from "react";
import { completeInboxItem, deleteInboxItem, fetchInboxItems } from "../lib/api";
import type { InboxItem, PriorityFilter } from "../lib/types";

const REFRESH_INTERVAL_MS = 30_000;

export function useInbox(search = "", priority?: PriorityFilter) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetchInboxItems(search, {
        tag: priority ? `priority:${priority}` : undefined,
      });
      setItems(response.items);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to load inbox items.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [priority, search]);

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        await deleteInboxItem(id);
        setItems((currentItems) => currentItems.filter((item) => item.id !== id));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to delete inbox item.";
        setError(message);
        throw caughtError;
      }
    },
    []
  );

  const markItemComplete = useCallback(
    async (id: string) => {
      const previousItems = items;
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === id
            ? {
                ...item,
                completed: true,
              }
            : item
        )
      );

      try {
        await completeInboxItem(id);
      } catch (caughtError) {
        setItems(previousItems);
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to complete inbox item.";
        setError(message);
        throw caughtError;
      }
    },
    [items]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refetch();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refetch]);

  return {
    items,
    loading,
    error,
    refetch,
    deleteItem,
    markItemComplete,
  };
}
