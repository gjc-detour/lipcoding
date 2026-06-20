import { randomUUID } from "crypto";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";
import { getContext } from "../lib/requestContext.js";

export interface InboxItem {
  id: string;
  user_id: string;
  type: "note" | "task" | "event" | "file";
  raw: string;
  summary: string;
  tags: string[];
  due_date?: string;
  scheduled: boolean;
  created_at: string;
}

export interface ScheduledEvent {
  id: string;
  user_id: string;
  item_id?: string;
  title: string;
  description?: string;
  due_at: string;
  notified: boolean;
  created_at: string;
}

interface InboxItemRow {
  id: string;
  user_id: string;
  type: InboxItem["type"];
  raw: string;
  summary: string;
  tags: string;
  due_date: string | null;
  scheduled: number;
  created_at: string;
}

interface ScheduledEventRow {
  id: string;
  user_id: string;
  item_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  notified: number;
  created_at: string;
}

interface InboxItemRecord {
  id: string;
  user_id: string;
  type: InboxItem["type"];
  raw: string;
  summary: string;
  tags: string;
  due_date: string | null;
  scheduled: number;
  created_at: string;
}

interface ScheduledEventRecord {
  id: string;
  user_id: string;
  item_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  notified: number;
  created_at: string;
}

function parseTags(tags: string): string[] {
  const parsed: unknown = JSON.parse(tags);
  return Array.isArray(parsed) && parsed.every((tag) => typeof tag === "string")
    ? parsed
    : [];
}

function mapInboxItem(row: InboxItemRow): InboxItem {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    raw: row.raw,
    summary: row.summary,
    tags: parseTags(row.tags),
    due_date: row.due_date ?? undefined,
    scheduled: row.scheduled === 1,
    created_at: row.created_at,
  };
}

function mapScheduledEvent(row: ScheduledEventRow): ScheduledEvent {
  return {
    id: row.id,
    user_id: row.user_id,
    item_id: row.item_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    due_at: row.due_at,
    notified: row.notified === 1,
    created_at: row.created_at,
  };
}

function getInboxItemById(id: string): InboxItem | null {
  const row = db
    .prepare("SELECT * FROM inbox_items WHERE id = ?")
    .get(id) as InboxItemRow | undefined;

  return row ? mapInboxItem(row) : null;
}

function getScheduledEventById(id: string): ScheduledEvent | null {
  const row = db
    .prepare("SELECT * FROM scheduled_events WHERE id = ?")
    .get(id) as ScheduledEventRow | undefined;

  return row ? mapScheduledEvent(row) : null;
}

export function createInboxItem(
  item: Omit<InboxItem, "id" | "created_at">
): InboxItem {
  const { correlationId, userId: contextUserId } = getContext();

  try {
    const createdAt = new Date().toISOString();
    const createdItem: InboxItemRecord = {
      id: randomUUID(),
      user_id: item.user_id || "default",
      type: item.type,
      raw: item.raw,
      summary: item.summary,
      tags: JSON.stringify(item.tags),
      due_date: item.due_date ?? null,
      scheduled: item.scheduled ? 1 : 0,
      created_at: createdAt,
    };

    db.prepare(
      `
        INSERT INTO inbox_items (
          id, user_id, type, raw, summary, tags, due_date, scheduled, created_at
        ) VALUES (
          @id, @user_id, @type, @raw, @summary, @tags, @due_date, @scheduled, @created_at
        )
      `
    ).run(createdItem);

    logger.info("createInboxItem", {
      correlationId,
      type: createdItem.type,
      userId: createdItem.user_id || contextUserId,
    });

    return mapInboxItem(createdItem);
  } catch (error: unknown) {
    logger.error("createInboxItem failed", {
      correlationId,
      type: item.type,
      userId: item.user_id || contextUserId || "default",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export function getInboxItems(userId = "default", search?: string): InboxItem[] {
  const { correlationId, userId: contextUserId } = getContext();
  const searchTerm = search?.trim();

  try {
    const rows = searchTerm
      ? (db
          .prepare(
            `
              SELECT *
              FROM inbox_items
              WHERE user_id = ?
                AND (
                  raw LIKE ?
                  OR summary LIKE ?
                  OR tags LIKE ?
                )
              ORDER BY datetime(created_at) DESC
            `
          )
          .all(
            userId,
            `%${searchTerm}%`,
            `%${searchTerm}%`,
            `%${searchTerm}%`
          ) as InboxItemRow[])
      : (db
          .prepare(
            `
              SELECT *
              FROM inbox_items
              WHERE user_id = ?
              ORDER BY datetime(created_at) DESC
            `
          )
          .all(userId) as InboxItemRow[]);

    const results = rows.map(mapInboxItem);

    logger.info("getInboxItems", {
      correlationId,
      userId: userId || contextUserId,
      search: searchTerm,
      count: results.length,
    });

    return results;
  } catch (error: unknown) {
    logger.error("getInboxItems failed", {
      correlationId,
      userId: userId || contextUserId,
      search: searchTerm,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export function getInboxItem(id: string): InboxItem | null {
  return getInboxItemById(id);
}

export function updateInboxItem(
  id: string,
  patch: Partial<InboxItem>
): InboxItem | null {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (typeof patch.user_id === "string") {
    assignments.push("user_id = ?");
    values.push(patch.user_id);
  }

  if (typeof patch.type === "string") {
    assignments.push("type = ?");
    values.push(patch.type);
  }

  if (typeof patch.raw === "string") {
    assignments.push("raw = ?");
    values.push(patch.raw);
  }

  if (typeof patch.summary === "string") {
    assignments.push("summary = ?");
    values.push(patch.summary);
  }

  if (Array.isArray(patch.tags)) {
    assignments.push("tags = ?");
    values.push(JSON.stringify(patch.tags));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "due_date")) {
    assignments.push("due_date = ?");
    values.push(patch.due_date ?? null);
  }

  if (typeof patch.scheduled === "boolean") {
    assignments.push("scheduled = ?");
    values.push(patch.scheduled ? 1 : 0);
  }

  if (assignments.length === 0) {
    return getInboxItemById(id);
  }

  values.push(id);

  const result = db
    .prepare(`UPDATE inbox_items SET ${assignments.join(", ")} WHERE id = ?`)
    .run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getInboxItemById(id);
}

export function deleteInboxItem(id: string): boolean {
  const doDelete = db.transaction((itemId: string) => {
    // Remove child scheduled events first to satisfy the foreign key constraint
    db.prepare("DELETE FROM scheduled_events WHERE item_id = ?").run(itemId);
    const result = db.prepare("DELETE FROM inbox_items WHERE id = ?").run(itemId);
    return result.changes > 0;
  });
  return doDelete(id);
}

export function createScheduledEvent(
  event: Omit<ScheduledEvent, "id" | "created_at">
): ScheduledEvent {
  const createdAt = new Date().toISOString();
  const createdEvent: ScheduledEventRecord = {
    id: randomUUID(),
    user_id: event.user_id || "default",
    item_id: event.item_id ?? null,
    title: event.title,
    description: event.description ?? null,
    due_at: event.due_at,
    notified: event.notified ? 1 : 0,
    created_at: createdAt,
  };

  db.transaction((record: ScheduledEventRecord) => {
    db.prepare(
      `
        INSERT INTO scheduled_events (
          id, user_id, item_id, title, description, due_at, notified, created_at
        ) VALUES (
          @id, @user_id, @item_id, @title, @description, @due_at, @notified, @created_at
        )
      `
    ).run(record);

    if (record.item_id) {
      db.prepare("UPDATE inbox_items SET scheduled = 1 WHERE id = ?").run(
        record.item_id
      );
    }
  })(createdEvent);

  return mapScheduledEvent(createdEvent);
}

export function getScheduledEvents(userId = "default"): ScheduledEvent[] {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM scheduled_events
        WHERE user_id = ?
        ORDER BY datetime(due_at) ASC
      `
    )
    .all(userId) as ScheduledEventRow[];

  return rows.map(mapScheduledEvent);
}

export function markEventNotified(id: string): void {
  db.prepare("UPDATE scheduled_events SET notified = 1 WHERE id = ?").run(id);
}

export { getScheduledEventById };
