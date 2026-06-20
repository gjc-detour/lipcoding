import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { db } from "../server/db.js";
import {
  createScheduledEvent,
  getScheduledEvents,
} from "../server/services/storage.js";
import {
  processDueNotifications,
  registerSSEClient,
} from "../server/services/notificationService.js";
import { sendEventReminderEmail } from "../server/lib/emailNotifier.js";

vi.mock("../server/lib/emailNotifier.js", () => ({
  sendEventReminderEmail: vi.fn().mockResolvedValue(undefined),
}));

describe.sequential("notificationService", () => {
  beforeEach(() => {
    db.exec(`
      DELETE FROM scheduled_events;
      DELETE FROM inbox_items;
    `);
    vi.clearAllMocks();
  });

  it("pushes due reminders to SSE clients and marks them notified", async () => {
    const writes: string[] = [];
    const response = {
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
        return true;
      }),
      end: vi.fn(),
    } as unknown as Response;

    const unsubscribe = registerSSEClient("default", response);

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

    const processedCount = await processDueNotifications("default");

    expect(processedCount).toBe(1);
    expect(sendEventReminderEmail).toHaveBeenCalledTimes(1);
    expect(sendEventReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Standup", due_at: dueEvent.due_at })
    );
    expect(writes).toEqual(
      expect.arrayContaining([expect.stringContaining(`"eventId":"${dueEvent.id}"`)])
    );

    const scheduledEvents = await getScheduledEvents("default");
    expect(scheduledEvents.find((event) => event.id === dueEvent.id)?.notified).toBe(true);
    expect(
      scheduledEvents.find((event) => event.title === "Future reminder")?.notified
    ).toBe(false);

    unsubscribe();
  });
});
