import dotenv from "dotenv";
import { pathToFileURL } from "url";

dotenv.config();

import { DEFAULT_USER, getAllowedUsers } from "../server/lib/auth.js";
import { initCosmos } from "../server/lib/cosmos.js";
import { logger } from "../server/lib/logger.js";
import {
  getScheduledEvents,
  markEventNotified,
} from "../server/services/storage.js";
import { NotificationDispatcher } from "./dispatcher.js";

const STORAGE_BACKEND = process.env.STORAGE_BACKEND ?? "sqlite";
const CHECK_INTERVAL_MS = parseInt(process.env.NOTIFICATION_INTERVAL_MS ?? "60000", 10);
const WORKER_LOG_META = { service: "worker" as const };
const dispatcher = new NotificationDispatcher();

export async function checkAndNotify(): Promise<void> {
  const users = getAllowedUsers().length > 0 ? getAllowedUsers() : [DEFAULT_USER];

  for (const user of users) {
    try {
      const now = new Date().toISOString();
      const events = await getScheduledEvents(user.id);
      const dueEvents = events.filter((event) => !event.notified && event.due_at <= now);

      for (const event of dueEvents) {
        logger.info("Notification due", {
          ...WORKER_LOG_META,
          userId: user.id,
          eventId: event.id,
          title: event.title,
        });

        await dispatcher.dispatch(event, user.id);
        await markEventNotified(event.id, user.id);

        logger.info("Notification sent", {
          ...WORKER_LOG_META,
          userId: user.id,
          eventId: event.id,
        });
      }
    } catch (error: unknown) {
      logger.error("Notification check failed", {
        ...WORKER_LOG_META,
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export async function startWorker(): Promise<void> {
  logger.info("Notification worker starting", {
    ...WORKER_LOG_META,
    interval: CHECK_INTERVAL_MS,
    backend: STORAGE_BACKEND,
  });

  if (STORAGE_BACKEND === "cosmos") {
    await initCosmos();
    logger.info("Cosmos DB initialized for worker", WORKER_LOG_META);
  }

  await checkAndNotify();
  setInterval(() => {
    void checkAndNotify();
  }, CHECK_INTERVAL_MS);

  logger.info("Notification worker running", WORKER_LOG_META);
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  startWorker().catch((error: unknown) => {
    logger.error("Worker startup failed", {
      ...WORKER_LOG_META,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });
}
