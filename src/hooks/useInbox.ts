import { useCallback, useEffect, useState } from "react";
import { deleteInboxItem, fetchInboxItems } from "../lib/api";
import type { InboxItem } from "../lib/types";

const REFRESH_INTERVAL_MS = 30_000;

export function useInbox(search = "") {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetchInboxItems(search);
      setItems(response.items);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to load inbox items.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

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
  };
}
