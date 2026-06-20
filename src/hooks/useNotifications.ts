import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationPayload } from "../lib/types";

const AUTO_DISMISS_MS = 10_000;

export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const timeoutIdsRef = useRef(new Map<string, number>());

  const dismiss = useCallback((eventId: string) => {
    const timeoutId = timeoutIdsRef.current.get(eventId);

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(eventId);
    }

    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.eventId !== eventId)
    );
  }, []);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") {
      return;
    }

    const eventSource = new EventSource("/api/notifications");

    const handleNotification = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as NotificationPayload;

      setNotifications((currentNotifications) => [
        payload,
        ...currentNotifications.filter(
          (notification) => notification.eventId !== payload.eventId
        ),
      ]);

      const existingTimeoutId = timeoutIdsRef.current.get(payload.eventId);
      if (existingTimeoutId !== undefined) {
        window.clearTimeout(existingTimeoutId);
      }

      const timeoutId = window.setTimeout(() => {
        dismiss(payload.eventId);
      }, AUTO_DISMISS_MS);

      timeoutIdsRef.current.set(payload.eventId, timeoutId);
    };

    eventSource.addEventListener("notification", handleNotification as EventListener);

    return () => {
      eventSource.removeEventListener("notification", handleNotification as EventListener);
      eventSource.close();

      for (const timeoutId of timeoutIdsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutIdsRef.current.clear();
    };
  }, [dismiss, enabled]);

  return { notifications, dismiss };
}
