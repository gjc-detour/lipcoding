import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../server/db.js";
import {
  createScheduledEvent,
  getScheduledEvents,
} from "../server/services/storage.js";
import { sendEventReminderEmail } from "../server/lib/emailNotifier.js";
import { checkAndNotify } from "../worker/notifier.js";

vi.mock("../server/lib/emailNotifier.js", () => ({
  sendEventReminderEmail: vi.fn().mockResolvedValue(undefined),
}));

describe.sequential("worker notifier", () => {
  beforeEach(() => {
    db.exec(`
      DELETE FROM scheduled_events;
      DELETE FROM inbox_items;
    `);

    process.env.AZURE_COMMUNICATION_CONNECTION_STRING = "endpoint=https://example.communication.azure.com/;accesskey=test";
    process.env.NOTIFICATION_FROM_EMAIL = "notifications@example.com";
    process.env.NOTIFICATION_TO_EMAIL = "user@example.com";
    delete process.env.ALLOWED_USERS;
    vi.clearAllMocks();
  });

  it("dispatches outbound channels and marks due reminders notified", async () => {
    const dueEvent = await createScheduledEvent({
      user_id: "default",
      title: "Standup",
      description: "Daily sync",
      due_at: new Date(Date.now() - 60_000).toISOString(),
      notified: false,
    });

    await createScheduledEvent({
      user_id: "default",
      title: "Future reminder",
      due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      notified: false,
    });

    await checkAndNotify();

    expect(sendEventReminderEmail).toHaveBeenCalledTimes(1);
    expect(sendEventReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Standup", due_at: dueEvent.due_at })
    );

    const scheduledEvents = await getScheduledEvents("default");
    expect(scheduledEvents.find((event) => event.id === dueEvent.id)?.notified).toBe(true);
    expect(
      scheduledEvents.find((event) => event.title === "Future reminder")?.notified
    ).toBe(false);
  });
});
