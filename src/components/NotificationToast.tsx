import { useEffect, useRef } from "react";
import { formatDateTime, formatRelativeTime } from "../lib/time";
import type { NotificationPayload } from "../lib/types";

const AUTO_DISMISS_MS = 10_000;

interface NotificationToastProps {
  notifications: NotificationPayload[];
  onDismiss: (eventId: string) => Promise<void> | void;
}

export default function NotificationToast({
  notifications,
  onDismiss,
}: NotificationToastProps) {
  const timeoutIdsRef = useRef(new Map<string, number>());

  useEffect(() => {
    for (const timeoutId of timeoutIdsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    timeoutIdsRef.current.clear();

    for (const notification of notifications) {
      const timeoutId = window.setTimeout(() => {
        void onDismiss(notification.eventId);
      }, AUTO_DISMISS_MS);
      timeoutIdsRef.current.set(notification.eventId, timeoutId);
    }

    return () => {
      for (const timeoutId of timeoutIdsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutIdsRef.current.clear();
    };
  }, [notifications, onDismiss]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {notifications.map((notification) => (
        <article
          key={notification.eventId}
          role="status"
          aria-live="polite"
          className="pointer-events-auto overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-lg ring-1 ring-black/5"
          style={{ animation: "notification-slide-in 180ms ease-out" }}
        >
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg text-amber-700">
                🔔
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-700">
                      Event reminder
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void onDismiss(notification.eventId)}
                    className="rounded-full p-1 text-gray-400 transition hover:bg-amber-50 hover:text-amber-700"
                    aria-label={`Dismiss reminder for ${notification.title}`}
                  >
                    ✕
                  </button>
                </div>

                {notification.description ? (
                  <p
                    className="mt-2 text-sm text-gray-600"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                    }}
                  >
                    {notification.description}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-gray-500">
                  {formatRelativeTime(notification.due_at)} · {formatDateTime(notification.due_at)}
                </p>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
