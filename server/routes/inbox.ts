import { Router } from "express";
import { z } from "zod";
import {
  completeInboxItem,
  createInboxItem,
  deleteInboxItem,
  getInboxItem,
  getInboxItems,
} from "../services/storage.js";

export const inboxRouter = Router();

const inboxListQuerySchema = z.object({
  search: z.string().min(1).optional(),
  type: z.enum(["note", "task", "event", "file"]).optional(),
  tag: z.string().min(1).optional(),
  from: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "from must be a valid ISO8601 datetime",
    })
    .optional(),
  to: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "to must be a valid ISO8601 datetime",
    })
    .optional(),
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

inboxRouter.get("/", async (req, res) => {
  const parsed = inboxListQuerySchema.safeParse({
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    type: typeof req.query.type === "string" ? req.query.type : undefined,
    tag: typeof req.query.tag === "string" ? req.query.tag : undefined,
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  });

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }

  try {
    const items = await getInboxItems(req.userId, parsed.data.search, {
      type: parsed.data.type,
      tag: parsed.data.tag,
      from: parsed.data.from,
      to: parsed.data.to,
    });
    res.json({ items, total: items.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inbox items";
    res.status(500).json({ error: message });
  }
});

inboxRouter.post("/", async (req, res) => {
  const parsed = createInboxItemSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  try {
    const item = await createInboxItem({
      user_id: req.userId,
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

inboxRouter.get("/:id", async (req, res) => {
  const parsed = inboxParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid id" });
    return;
  }

  try {
    const item = await getInboxItem(parsed.data.id, req.userId);

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

inboxRouter.patch("/:id/complete", async (req, res) => {
  const parsed = inboxParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid id" });
    return;
  }

  try {
    const success = await completeInboxItem(parsed.data.id, req.userId);
    if (!success) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to complete inbox item";
    res.status(500).json({ error: message });
  }
});

inboxRouter.delete("/:id", async (req, res) => {
  const parsed = inboxParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid id" });
    return;
  }

  try {
    const deleted = await deleteInboxItem(parsed.data.id, req.userId);

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
