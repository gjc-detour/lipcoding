import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  cosmosCloseScheduledEvent,
  cosmosCompleteInboxItem,
  cosmosCreateInboxItem,
  cosmosCreateScheduledEvent,
  cosmosDeleteInboxItem,
  cosmosGetInboxItem,
  cosmosGetInboxItems,
  cosmosGetScheduledEvents,
  cosmosGetUpcomingEvents,
  cosmosMarkEventNotified,
  cosmosUpdateInboxItem,
} from "../lib/cosmos.js";
import { logger } from "../lib/logger.js";
import { getContext } from "../lib/requestContext.js";

const DEFAULT_USER_ID = "default";
const useCosmosDB =
  process.env.STORAGE_BACKEND === "cosmos" &&
  !!(process.env.COSMOS_CONNECTION_STRING || process.env.COSMOS_ENDPOINT);

export interface InboxItem {
  id: string;
  user_id: string;
  type: "note" | "task" | "event" | "file";
  raw: string;
  summary: string;
  tags: string[];
  due_date?: string;
  scheduled: boolean;
  completed?: boolean;
  created_at: string;
}

export interface InboxItemFilters {
  type?: InboxItem["type"];
  tag?: string;
  from?: string;
  to?: string;
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
  completed: number;
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
  completed: number;
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

function resolveUserId(userId?: string): string {
  return userId?.trim() ? userId : DEFAULT_USER_ID;
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
    completed: row.completed === 1,
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

function sqliteGetInboxItemById(id: string, userId = DEFAULT_USER_ID): InboxItem | null {
  const row = db
    .prepare("SELECT * FROM inbox_items WHERE id = ? AND user_id = ?")
    .get(id, resolveUserId(userId)) as InboxItemRow | undefined;

  return row ? mapInboxItem(row) : null;
}

function sqliteGetScheduledEventById(
  id: string,
  userId = DEFAULT_USER_ID
): ScheduledEvent | null {
  const row = db
    .prepare("SELECT * FROM scheduled_events WHERE id = ? AND user_id = ?")
    .get(id, resolveUserId(userId)) as ScheduledEventRow | undefined;

  return row ? mapScheduledEvent(row) : null;
}

function sqliteCreateInboxItem(
  item: Omit<InboxItem, "id" | "created_at">
): InboxItem {
  const { correlationId, userId: contextUserId } = getContext();

  try {
    const createdAt = new Date().toISOString();
    const createdItem: InboxItemRecord = {
      id: randomUUID(),
      user_id: resolveUserId(item.user_id),
      type: item.type,
      raw: item.raw,
      summary: item.summary,
      tags: JSON.stringify(item.tags),
      due_date: item.due_date ?? null,
      scheduled: item.scheduled ? 1 : 0,
      completed: item.completed ? 1 : 0,
      created_at: createdAt,
    };

    db.prepare(
      `
        INSERT INTO inbox_items (
          id, user_id, type, raw, summary, tags, due_date, scheduled, completed, created_at
        ) VALUES (
          @id, @user_id, @type, @raw, @summary, @tags, @due_date, @scheduled, @completed, @created_at
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

function sqliteGetInboxItems(
  userId = DEFAULT_USER_ID,
  search?: string,
  filters: InboxItemFilters = {}
): InboxItem[] {
  const { correlationId, userId: contextUserId } = getContext();
  const effectiveUserId = resolveUserId(userId);
  const searchTerm = search?.trim();
  const tag = filters.tag?.trim();
  const from = filters.from?.trim();
  const to = filters.to?.trim();
  const whereClauses = ["user_id = ?"];
  const values: string[] = [effectiveUserId];

  if (searchTerm) {
    whereClauses.push(`
      (
        raw LIKE ?
        OR summary LIKE ?
        OR tags LIKE ?
      )
    `);
    values.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }

  if (filters.type) {
    whereClauses.push("type = ?");
    values.push(filters.type);
  }

  if (tag) {
    whereClauses.push(`
      EXISTS (
        SELECT 1
        FROM json_each(inbox_items.tags)
        WHERE LOWER(json_each.value) = LOWER(?)
      )
    `);
    values.push(tag);
  }

  if (from) {
    whereClauses.push("datetime(created_at) >= datetime(?)");
    values.push(from);
  }

  if (to) {
    whereClauses.push("datetime(created_at) <= datetime(?)");
    values.push(to);
  }

  try {
    const rows = db
      .prepare(
        `
          SELECT *
          FROM inbox_items
          WHERE ${whereClauses.join("\n            AND ")}
          ORDER BY datetime(created_at) DESC
        `
      )
      .all(...values) as InboxItemRow[];

    const results = rows.map(mapInboxItem);

    logger.info("getInboxItems", {
      correlationId,
      userId: effectiveUserId || contextUserId,
      search: searchTerm,
      filters: {
        type: filters.type,
        tag,
        from,
        to,
      },
      count: results.length,
    });

    return results;
  } catch (error: unknown) {
    logger.error("getInboxItems failed", {
      correlationId,
      userId: effectiveUserId || contextUserId,
      search: searchTerm,
      filters: {
        type: filters.type,
        tag,
        from,
        to,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

function sqliteUpdateInboxItem(
  id: string,
  patch: Partial<InboxItem>,
  userId = DEFAULT_USER_ID
): InboxItem | null {
  const effectiveUserId = resolveUserId(userId);
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

  if (typeof patch.completed === "boolean") {
    assignments.push("completed = ?");
    values.push(patch.completed ? 1 : 0);
  }

  if (assignments.length === 0) {
    return sqliteGetInboxItemById(id, effectiveUserId);
  }

  values.push(id);
  values.push(effectiveUserId);

  const result = db
    .prepare(
      `UPDATE inbox_items SET ${assignments.join(", ")} WHERE id = ? AND user_id = ?`
    )
    .run(...values);

  if (result.changes === 0) {
    return null;
  }

  return sqliteGetInboxItemById(id, effectiveUserId);
}

function sqliteDeleteInboxItem(id: string, userId = DEFAULT_USER_ID): boolean {
  const effectiveUserId = resolveUserId(userId);
  const doDelete = db.transaction((itemId: string, ownerId: string) => {
    // Remove child scheduled events first to satisfy the foreign key constraint
    db.prepare("DELETE FROM scheduled_events WHERE item_id = ? AND user_id = ?").run(
      itemId,
      ownerId
    );
    const result = db
      .prepare("DELETE FROM inbox_items WHERE id = ? AND user_id = ?")
      .run(itemId, ownerId);
    return result.changes > 0;
  });
  return doDelete(id, effectiveUserId);
}

function sqliteCompleteInboxItem(id: string, userId = DEFAULT_USER_ID): boolean {
  const effectiveUserId = resolveUserId(userId);
  const result = db
    .prepare("UPDATE inbox_items SET completed = 1 WHERE id = ? AND user_id = ?")
    .run(id, effectiveUserId);
  return result.changes > 0;
}

function sqliteCreateScheduledEvent(
  event: Omit<ScheduledEvent, "id" | "created_at">
): ScheduledEvent {
  const createdAt = new Date().toISOString();
  const createdEvent: ScheduledEventRecord = {
    id: randomUUID(),
    user_id: resolveUserId(event.user_id),
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
      db.prepare("UPDATE inbox_items SET scheduled = 1 WHERE id = ? AND user_id = ?").run(
        record.item_id,
        record.user_id
      );
    }
  })(createdEvent);

  return mapScheduledEvent(createdEvent);
}

function sqliteGetScheduledEvents(userId = DEFAULT_USER_ID): ScheduledEvent[] {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM scheduled_events
        WHERE user_id = ?
        ORDER BY datetime(due_at) ASC
      `
    )
    .all(resolveUserId(userId)) as ScheduledEventRow[];

  return rows.map(mapScheduledEvent);
}

function sqliteMarkEventNotified(id: string, userId = DEFAULT_USER_ID): void {
  db.prepare("UPDATE scheduled_events SET notified = 1 WHERE id = ? AND user_id = ?").run(
    id,
    resolveUserId(userId)
  );
}

function sqliteCloseScheduledEvent(id: string, userId = DEFAULT_USER_ID): boolean {
  const result = db
    .prepare("DELETE FROM scheduled_events WHERE id = ? AND user_id = ?")
    .run(id, resolveUserId(userId));
  return result.changes > 0;
}

function sqliteGetUpcomingEvents(
  userId = DEFAULT_USER_ID,
  limitHours = 168
): ScheduledEvent[] {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + limitHours * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(
    "SELECT * FROM scheduled_events WHERE user_id = ? AND due_at >= ? AND due_at <= ? AND notified = 0 ORDER BY datetime(due_at) ASC LIMIT 10"
  ).all(resolveUserId(userId), now, future) as ScheduledEventRow[];
  return rows.map(mapScheduledEvent);
}

export async function createInboxItem(
  item: Omit<InboxItem, "id" | "created_at">
): Promise<InboxItem> {
  if (useCosmosDB) {
    return cosmosCreateInboxItem(item);
  }

  return Promise.resolve(sqliteCreateInboxItem(item));
}

export async function getInboxItems(
  userId = DEFAULT_USER_ID,
  search?: string,
  filters: InboxItemFilters = {}
): Promise<InboxItem[]> {
  if (useCosmosDB) {
    return cosmosGetInboxItems(userId, search, filters);
  }

  return Promise.resolve(sqliteGetInboxItems(userId, search, filters));
}

export async function getInboxItem(
  id: string,
  userId = DEFAULT_USER_ID
): Promise<InboxItem | null> {
  if (useCosmosDB) {
    return cosmosGetInboxItem(id, userId);
  }

  return Promise.resolve(sqliteGetInboxItemById(id, userId));
}

export async function updateInboxItem(
  id: string,
  patch: Partial<InboxItem>,
  userId = DEFAULT_USER_ID
): Promise<InboxItem | null> {
  if (useCosmosDB) {
    return cosmosUpdateInboxItem(id, userId, patch);
  }

  return Promise.resolve(sqliteUpdateInboxItem(id, patch, userId));
}

export async function deleteInboxItem(
  id: string,
  userId = DEFAULT_USER_ID
): Promise<boolean> {
  if (useCosmosDB) {
    return cosmosDeleteInboxItem(id, userId);
  }

  return Promise.resolve(sqliteDeleteInboxItem(id, userId));
}

export async function completeInboxItem(
  id: string,
  userId = DEFAULT_USER_ID
): Promise<boolean> {
  if (useCosmosDB) {
    return cosmosCompleteInboxItem(id, userId);
  }

  return Promise.resolve(sqliteCompleteInboxItem(id, userId));
}

export async function createScheduledEvent(
  event: Omit<ScheduledEvent, "id" | "created_at">
): Promise<ScheduledEvent> {
  if (useCosmosDB) {
    return cosmosCreateScheduledEvent(event);
  }

  return Promise.resolve(sqliteCreateScheduledEvent(event));
}

export async function getScheduledEvents(
  userId = DEFAULT_USER_ID
): Promise<ScheduledEvent[]> {
  if (useCosmosDB) {
    return cosmosGetScheduledEvents(userId);
  }

  return Promise.resolve(sqliteGetScheduledEvents(userId));
}

export async function getUpcomingEvents(
  userId = DEFAULT_USER_ID,
  limitHours = 168
): Promise<ScheduledEvent[]> {
  if (useCosmosDB) {
    return cosmosGetUpcomingEvents(userId, limitHours);
  }

  return Promise.resolve(sqliteGetUpcomingEvents(userId, limitHours));
}

export async function markEventNotified(
  id: string,
  userId = DEFAULT_USER_ID
): Promise<void> {
  if (useCosmosDB) {
    await cosmosMarkEventNotified(id, userId);
    return;
  }

  return Promise.resolve(sqliteMarkEventNotified(id, userId));
}

export async function closeScheduledEvent(
  id: string,
  userId = DEFAULT_USER_ID
): Promise<boolean> {
  if (useCosmosDB) {
    return cosmosCloseScheduledEvent(id, userId);
  }

  return Promise.resolve(sqliteCloseScheduledEvent(id, userId));
}

export async function getScheduledEventById(
  id: string,
  userId = DEFAULT_USER_ID
): Promise<ScheduledEvent | null> {
  return Promise.resolve(sqliteGetScheduledEventById(id, userId));
}
