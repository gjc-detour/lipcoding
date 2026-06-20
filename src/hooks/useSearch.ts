import { useEffect, useMemo, useState } from "react";
import { fetchInboxItems } from "../lib/api";
import type { InboxItem } from "../lib/types";

interface UseSearchParams {
  query: string;
  type?: InboxItem["type"];
  tag?: string;
  from?: string;
  to?: string;
}

function toBoundaryIso(value: string | undefined, boundary: "start" | "end"): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const date = new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function useSearch({ query, type, tag, from, to }: UseSearchParams) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const normalized = useMemo(
    () => ({
      query: query.trim(),
      type,
      tag: tag?.trim() ?? "",
      from: from?.trim() ?? "",
      to: to?.trim() ?? "",
    }),
    [from, query, tag, to, type]
  );

  const hasActiveSearch = Boolean(
    normalized.query || normalized.type || normalized.tag || normalized.from || normalized.to
  );

  useEffect(() => {
    if (!hasActiveSearch) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await fetchInboxItems(normalized.query, {
            type: normalized.type,
            tag: normalized.tag || undefined,
            from: toBoundaryIso(normalized.from, "start"),
            to: toBoundaryIso(normalized.to, "end"),
          });

          if (!isCancelled) {
            setItems(response.items);
            setTotal(response.total);
          }
        } catch (caughtError) {
          if (!isCancelled) {
            const message =
              caughtError instanceof Error ? caughtError.message : "Failed to search inbox.";
            setError(message);
            setItems([]);
            setTotal(0);
          }
        } finally {
          if (!isCancelled) {
            setLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [hasActiveSearch, normalized, refreshToken]);

  return {
    items,
    total,
    loading,
    error,
    refetch: () => setRefreshToken((current) => current + 1),
  };
}
