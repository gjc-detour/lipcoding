import { useCallback, useEffect, useState } from "react";
import type { NotificationPayload } from "../lib/types";

export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  const dismiss = useCallback(async (eventId: string) => {
    try {
      await fetch(`/api/notifications/dismiss/${eventId}`, {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setNotifications((currentNotifications) =>
        currentNotifications.filter((notification) => notification.eventId !== eventId)
      );
    }
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
    };

    eventSource.addEventListener("notification", handleNotification as EventListener);

    return () => {
      eventSource.removeEventListener("notification", handleNotification as EventListener);
      eventSource.close();
    };
  }, [dismiss, enabled]);

  return { notifications, dismiss };
}
