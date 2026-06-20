import { Router } from "express";
import { z } from "zod";
import {
  createScheduledEvent,
  getScheduledEvents,
} from "../services/storage.js";

export const eventsRouter = Router();

const eventsListQuerySchema = z.object({
  userId: z.string().min(1).optional(),
});

const createScheduledEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  due_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "due_at must be a valid ISO8601 datetime",
  }),
  item_id: z.string().min(1).optional(),
});

eventsRouter.get("/", (req, res) => {
  const parsed = eventsListQuerySchema.safeParse({
    userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
  });

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }

  try {
    const events = getScheduledEvents(parsed.data.userId);
    res.json(events);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load scheduled events";
    res.status(500).json({ error: message });
  }
});

eventsRouter.post("/", (req, res) => {
  const parsed = createScheduledEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  try {
    const event = createScheduledEvent({
      user_id: "default",
      item_id: parsed.data.item_id,
      title: parsed.data.title,
      description: parsed.data.description,
      due_at: parsed.data.due_at,
      notified: false,
    });

    res.status(201).json(event);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create scheduled event";
    res.status(500).json({ error: message });
  }
});
