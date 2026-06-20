import type { Response } from "express";
import cron from "node-cron";
import { DEFAULT_USER, getAllowedUsers } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
  getScheduledEvents,
  type ScheduledEvent,
} from "./storage.js";

export interface NotificationPayload {
  type: "event_reminder";
  eventId: string;
  title: string;
  description?: string;
  due_at: string;
}

const sseClients = new Map<string, Set<Response>>();
let notificationTask: ReturnType<typeof cron.schedule> | null = null;

function toNotificationPayload(event: ScheduledEvent): NotificationPayload {
  return {
    type: "event_reminder",
    eventId: event.id,
    title: event.title,
    description: event.description,
    due_at: event.due_at,
  };
}

function getDueEvents(events: ScheduledEvent[], now = Date.now()): ScheduledEvent[] {
  return events
    .filter((event) => {
      const dueAt = new Date(event.due_at).getTime();
      return !event.notified && !Number.isNaN(dueAt) && dueAt <= now;
    })
    .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime());
}

export function sendSSENotification(res: Response, event: NotificationPayload): void {
  res.write(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
}

export function registerSSEClient(userId: string, res: Response): () => void {
  const existingClients = sseClients.get(userId) ?? new Set<Response>();
  existingClients.add(res);
  sseClients.set(userId, existingClients);

  logger.info("SSE client connected", {
    userId,
    clientCount: existingClients.size,
  });

  return () => {
    const clients = sseClients.get(userId);
    if (!clients) {
      return;
    }

    clients.delete(res);

    if (clients.size === 0) {
      sseClients.delete(userId);
    }

    logger.info("SSE client disconnected", {
      userId,
      clientCount: clients.size,
    });
  };
}

export function pushNotification(userId: string, event: NotificationPayload): void {
  const clients = sseClients.get(userId);

  if (!clients || clients.size === 0) {
    logger.info("No SSE clients connected for notification", {
      userId,
      eventId: event.eventId,
    });
    return;
  }

  for (const client of [...clients]) {
    try {
      sendSSENotification(client, event);
    } catch (error: unknown) {
      clients.delete(client);
      logger.warn("Failed to push SSE notification", {
        userId,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      try {
        client.end();
      } catch {
        // Ignore connection cleanup errors
      }
    }
  }

  if (clients.size === 0) {
    sseClients.delete(userId);
  }

  logger.info("Pushed SSE notification", {
    userId,
    eventId: event.eventId,
    clientCount: clients.size,
  });
}

export async function processDueNotifications(userId = DEFAULT_USER.id): Promise<number> {
  const scheduledEvents = await getScheduledEvents(userId);
  const dueEvents = getDueEvents(scheduledEvents);

  if (dueEvents.length === 0) {
    logger.debug("No due events found for notification sweep", { userId });
    return 0;
  }

  logger.info("Due events found for notification sweep", {
    userId,
    dueEventCount: dueEvents.length,
  });

  for (const event of dueEvents) {
    pushNotification(userId, toNotificationPayload(event));
  }

  return dueEvents.length;
}

async function runNotificationSweep(): Promise<void> {
  const configuredUsers = getAllowedUsers();
  const userIds =
    configuredUsers.length > 0 ? configuredUsers.map((user) => user.id) : [DEFAULT_USER.id];

  logger.debug("Notification cron tick", { userCount: userIds.length });

  for (const userId of userIds) {
    try {
      await processDueNotifications(userId);
    } catch (error: unknown) {
      logger.error("Notification sweep failed for user", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export function startNotificationCron(): void {
  if (notificationTask) {
    logger.warn("Notification cron already started");
    return;
  }

  notificationTask = cron.schedule("* * * * *", () => {
    void runNotificationSweep();
  });
}
