import { logger } from "../server/lib/logger.js";
import { sendEventReminderEmail } from "../server/lib/emailNotifier.js";
import type { ScheduledEvent } from "../server/services/storage.js";

export interface NotificationChannel {
  name: string;
  isConfigured(): boolean;
  send(event: ScheduledEvent, userId: string): Promise<void>;
}

export class EmailChannel implements NotificationChannel {
  name = "email";

  isConfigured(): boolean {
    return Boolean(
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING &&
        process.env.NOTIFICATION_FROM_EMAIL &&
        process.env.NOTIFICATION_TO_EMAIL
    );
  }

  async send(event: ScheduledEvent, _userId: string): Promise<void> {
    await sendEventReminderEmail(event);
  }
}

export class WebhookChannel implements NotificationChannel {
  name = "webhook";

  isConfigured(): boolean {
    return false;
  }

  async send(_event: ScheduledEvent, _userId: string): Promise<void> {
    logger.debug("Webhook channel is not implemented yet", { service: "worker" });
  }
}

export class SMSChannel implements NotificationChannel {
  name = "sms";

  isConfigured(): boolean {
    return false;
  }

  async send(_event: ScheduledEvent, _userId: string): Promise<void> {
    logger.debug("SMS channel is not implemented yet", { service: "worker" });
  }
}

export class NotificationDispatcher {
  private readonly channels: NotificationChannel[];

  constructor(channels: NotificationChannel[] = [new EmailChannel()]) {
    this.channels = channels;
  }

  async dispatch(event: ScheduledEvent, userId: string): Promise<void> {
    await Promise.allSettled(
      this.channels
        .filter((channel) => channel.isConfigured())
        .map(async (channel) => {
          try {
            await channel.send(event, userId);
            logger.info("Notification channel sent", {
              service: "worker",
              channel: channel.name,
              userId,
              eventId: event.id,
            });
          } catch (error: unknown) {
            logger.error(`Channel ${channel.name} failed`, {
              service: "worker",
              userId,
              eventId: event.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
    );
  }
}
