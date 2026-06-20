import { Router } from "express";
import { z } from "zod";
import {
  closeScheduledEvent,
  createScheduledEvent,
  getScheduledEventById,
  getScheduledEventOwner,
  getScheduledEvents,
} from "../services/storage.js";
import { assertOwnership } from "./ownership.js";

export const eventsRouter = Router();

const eventsListQuerySchema = z.object({});

const createScheduledEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  due_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "due_at must be a valid ISO8601 datetime",
  }),
  item_id: z.string().min(1).optional(),
});

const eventParamsSchema = z.object({
  id: z.string().min(1),
});

eventsRouter.get("/", async (req, res) => {
  const parsed = eventsListQuerySchema.safeParse({});

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }

  try {
    const events = await getScheduledEvents(req.userId);
    res.json(events);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load scheduled events";
    res.status(500).json({ error: message });
  }
});

eventsRouter.post("/", async (req, res) => {
  const parsed = createScheduledEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  try {
    const event = await createScheduledEvent({
      user_id: req.userId,
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

eventsRouter.delete("/:id", async (req, res) => {
  const parsed = eventParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid id" });
    return;
  }

  try {
    const event = await getScheduledEventById(parsed.data.id, req.userId);
    if (event && !assertOwnership(event.user_id, req.userId, res)) {
      return;
    }

    if (!event) {
      const eventOwner = await getScheduledEventOwner(parsed.data.id);
      if (eventOwner && !assertOwnership(eventOwner, req.userId, res)) {
        return;
      }

      res.status(404).json({ error: "Scheduled event not found" });
      return;
    }

    const deleted = await closeScheduledEvent(parsed.data.id, req.userId);

    if (!deleted) {
      res.status(404).json({ error: "Scheduled event not found" });
      return;
    }

    res.status(204).send();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete scheduled event";
    res.status(500).json({ error: message });
  }
});
