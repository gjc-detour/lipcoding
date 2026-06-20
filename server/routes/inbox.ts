import { Router } from "express";
import { z } from "zod";
import {
  createInboxItem,
  deleteInboxItem,
  getInboxItem,
  getInboxItems,
} from "../services/storage.js";

export const inboxRouter = Router();

const inboxListQuerySchema = z.object({
  userId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
});

const inboxParamsSchema = z.object({
  id: z.string().min(1),
});

const createInboxItemSchema = z.object({
  type: z.enum(["note", "task", "event", "file"]),
  raw: z.string().min(1),
  summary: z.string().default(""),
  tags: z.array(z.string()).default([]),
  due_date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "due_date must be a valid ISO8601 datetime",
    })
    .optional(),
});

inboxRouter.get("/", (req, res) => {
  const parsed = inboxListQuerySchema.safeParse({
    userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }

  try {
    const items = getInboxItems(parsed.data.userId, parsed.data.search);
    res.json(items);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inbox items";
    res.status(500).json({ error: message });
  }
});

inboxRouter.post("/", (req, res) => {
  const parsed = createInboxItemSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  try {
    const item = createInboxItem({
      user_id: "default",
      type: parsed.data.type,
      raw: parsed.data.raw,
      summary: parsed.data.summary,
      tags: parsed.data.tags,
      due_date: parsed.data.due_date,
      scheduled: false,
    });

    res.status(201).json(item);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create inbox item";
    res.status(500).json({ error: message });
  }
});

inboxRouter.get("/:id", (req, res) => {
  const parsed = inboxParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid id" });
    return;
  }

  try {
    const item = getInboxItem(parsed.data.id);

    if (!item) {
      res.status(404).json({ error: "Inbox item not found" });
      return;
    }

    res.json(item);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inbox item";
    res.status(500).json({ error: message });
  }
});

inboxRouter.delete("/:id", (req, res) => {
  const parsed = inboxParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid id" });
    return;
  }

  try {
    const deleted = deleteInboxItem(parsed.data.id);

    if (!deleted) {
      res.status(404).json({ error: "Inbox item not found" });
      return;
    }

    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete inbox item";
    res.status(500).json({ error: message });
  }
});
