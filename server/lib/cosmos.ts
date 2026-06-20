import { randomUUID } from "crypto";
import {
  CosmosClient,
  type Container,
  type Database,
  type PatchOperation,
} from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { logger } from "./logger.js";
import { getContext } from "./requestContext.js";
import type { InboxItem, InboxItemFilters, ScheduledEvent } from "../services/storage.js";

const COSMOS_DB_NAME = "lipcoding";
const INBOX_CONTAINER_NAME = "inbox_items";
const EVENTS_CONTAINER_NAME = "scheduled_events";
const DEFAULT_USER_ID = "default";
interface CosmosInboxItemDocument {
  id: string;
  userId: string;
  user_id: string;
  type: InboxItem["type"];
  raw: string;
  summary: string;
  tags: string[];
  tagsText: string;
  due_date: string | null;
  scheduled: boolean;
  created_at: string;
}

interface CosmosScheduledEventDocument {
  id: string;
  userId: string;
  user_id: string;
  item_id: string | null;
  title: string;
  description: string | null;
  due_at: string;
  notified: boolean;
  created_at: string;
}

let cosmosClient: CosmosClient | null = null;
let cosmosDatabase: Database | null = null;
let inboxContainer: Container | null = null;
let scheduledEventsContainer: Container | null = null;
let initPromise: Promise<void> | null = null;

function resolveUserId(userId?: string): string {
  return userId?.trim() ? userId : DEFAULT_USER_ID;
}

function createCosmosClient(): CosmosClient {
  if (cosmosClient) {
    return cosmosClient;
  }

  const endpoint = process.env.COSMOS_ENDPOINT?.trim();
  const connectionString = process.env.COSMOS_CONNECTION_STRING?.trim();
  const shouldUseManagedIdentity =
    !!endpoint && (process.env.NODE_ENV === "production" || !connectionString);

  if (shouldUseManagedIdentity) {
    cosmosClient = new CosmosClient({
      endpoint,
      aadCredentials: new DefaultAzureCredential(),
    });
    return cosmosClient;
  }

  if (connectionString) {
    cosmosClient = new CosmosClient(connectionString);
    return cosmosClient;
  }

  throw new Error(
    "Cosmos DB is not configured. Set COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT."
  );
}

async function getContainers(): Promise<{
  database: Database;
  inbox: Container;
  scheduledEvents: Container;
}> {
  await initCosmos();

  if (!cosmosDatabase || !inboxContainer || !scheduledEventsContainer) {
    throw new Error("Cosmos DB containers are not initialized.");
  }

  return {
    database: cosmosDatabase,
    inbox: inboxContainer,
    scheduledEvents: scheduledEventsContainer,
  };
}

function mapInboxDocument(doc: CosmosInboxItemDocument): InboxItem {
  return {
    id: doc.id,
    user_id: doc.user_id || doc.userId,
    type: doc.type,
    raw: doc.raw,
    summary: doc.summary,
    tags: Array.isArray(doc.tags) ? doc.tags.filter((tag) => typeof tag === "string") : [],
    due_date: doc.due_date ?? undefined,
    scheduled: Boolean(doc.scheduled),
    created_at: doc.created_at,
  };
}

function mapScheduledEventDocument(doc: CosmosScheduledEventDocument): ScheduledEvent {
  return {
    id: doc.id,
    user_id: doc.user_id || doc.userId,
    item_id: doc.item_id ?? undefined,
    title: doc.title,
    description: doc.description ?? undefined,
    due_at: doc.due_at,
    notified: Boolean(doc.notified),
    created_at: doc.created_at,
  };
}

function toInboxDocument(item: Omit<InboxItem, "id" | "created_at">): CosmosInboxItemDocument {
  const userId = resolveUserId(item.user_id);

  return {
    id: randomUUID(),
    userId,
    user_id: userId,
    type: item.type,
    raw: item.raw,
    summary: item.summary,
    tags: item.tags,
    tagsText: item.tags.join(" "),
    due_date: item.due_date ?? null,
    scheduled: item.scheduled,
    created_at: new Date().toISOString(),
  };
}

function toScheduledEventDocument(
  event: Omit<ScheduledEvent, "id" | "created_at">
): CosmosScheduledEventDocument {
  const userId = resolveUserId(event.user_id);

  return {
    id: randomUUID(),
    userId,
    user_id: userId,
    item_id: event.item_id ?? null,
    title: event.title,
    description: event.description ?? null,
    due_at: event.due_at,
    notified: event.notified,
    created_at: new Date().toISOString(),
  };
}

async function readInboxDocument(
  id: string,
  userId: string
): Promise<CosmosInboxItemDocument | null> {
  const { inbox } = await getContainers();

  try {
    const { resource } = await inbox
      .item(id, resolveUserId(userId))
      .read<CosmosInboxItemDocument>();
    return resource ?? null;
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === 404) {
      return null;
    }

    throw error;
  }
}

async function readScheduledEventDocument(
  id: string,
  userId: string
): Promise<CosmosScheduledEventDocument | null> {
  const { scheduledEvents } = await getContainers();

  try {
    const { resource } = await scheduledEvents
      .item(id, resolveUserId(userId))
      .read<CosmosScheduledEventDocument>();
    return resource ?? null;
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === 404) {
      return null;
    }

    throw error;
  }
}

export async function initCosmos(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const client = createCosmosClient();
    const { database } = await client.databases.createIfNotExists({ id: COSMOS_DB_NAME });
    const { container: inbox } = await database.containers.createIfNotExists({
      id: INBOX_CONTAINER_NAME,
      partitionKey: "/userId",
    });
    const { container: scheduledEvents } = await database.containers.createIfNotExists({
      id: EVENTS_CONTAINER_NAME,
      partitionKey: "/userId",
    });

    cosmosDatabase = database;
    inboxContainer = inbox;
    scheduledEventsContainer = scheduledEvents;
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  await initPromise;
}

export async function cosmosCreateInboxItem(
  item: Omit<InboxItem, "id" | "created_at">
): Promise<InboxItem> {
  const { correlationId, userId: contextUserId } = getContext();
  const { inbox } = await getContainers();
  const document = toInboxDocument(item);

  try {
    const { resource } = await inbox.items.create<CosmosInboxItemDocument>(document);
    const created = resource ?? document;

    logger.info("cosmosCreateInboxItem", {
      correlationId,
      type: created.type,
      userId: created.userId || contextUserId,
    });

    return mapInboxDocument(created);
  } catch (error: unknown) {
    logger.error("cosmosCreateInboxItem failed", {
      correlationId,
      type: item.type,
      userId: item.user_id || contextUserId || DEFAULT_USER_ID,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function cosmosGetInboxItems(
  userId: string,
  search?: string,
  filters: InboxItemFilters = {}
): Promise<InboxItem[]> {
  const { correlationId, userId: contextUserId } = getContext();
  const { inbox } = await getContainers();
  const effectiveUserId = resolveUserId(userId);
  const searchTerm = search?.trim();
  const tag = filters.tag?.trim();
  const from = filters.from?.trim();
  const to = filters.to?.trim();

  try {
    const clauses = ["c.userId = @userId"];
    const parameters: Array<{ name: string; value: string }> = [
      { name: "@userId", value: effectiveUserId },
    ];

    if (searchTerm) {
      clauses.push(`
        (
          CONTAINS(c.raw, @search, true)
          OR CONTAINS(c.summary, @search, true)
          OR CONTAINS(c.tagsText, @search, true)
        )
      `);
      parameters.push({ name: "@search", value: searchTerm });
    }

    if (filters.type) {
      clauses.push("c.type = @type");
      parameters.push({ name: "@type", value: filters.type });
    }

    if (tag) {
      clauses.push("ARRAY_CONTAINS(c.tags, @tag)");
      parameters.push({ name: "@tag", value: tag });
    }

    if (from) {
      clauses.push("c.created_at >= @from");
      parameters.push({ name: "@from", value: from });
    }

    if (to) {
      clauses.push("c.created_at <= @to");
      parameters.push({ name: "@to", value: to });
    }

    const querySpec = {
      query: `
        SELECT *
        FROM c
        WHERE ${clauses.join("\n          AND ")}
        ORDER BY c.created_at DESC
      `,
      parameters,
    };

    const { resources } = await inbox.items
      .query<CosmosInboxItemDocument>(querySpec, {
        partitionKey: effectiveUserId,
      })
      .fetchAll();

    const results = resources.map(mapInboxDocument);

    logger.info("cosmosGetInboxItems", {
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
    logger.error("cosmosGetInboxItems failed", {
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

export async function cosmosGetInboxItem(
  id: string,
  userId: string
): Promise<InboxItem | null> {
  const item = await readInboxDocument(id, userId);
  return item ? mapInboxDocument(item) : null;
}

export async function cosmosUpdateInboxItem(
  id: string,
  userId: string,
  patch: Partial<InboxItem>
): Promise<InboxItem | null> {
  const effectiveUserId = resolveUserId(userId);

  if (typeof patch.user_id === "string" && resolveUserId(patch.user_id) !== effectiveUserId) {
    throw new Error("Changing user_id is not supported in the Cosmos DB backend.");
  }

  const operations: PatchOperation[] = [];

  if (typeof patch.type === "string") {
    operations.push({ op: "set", path: "/type", value: patch.type });
  }

  if (typeof patch.raw === "string") {
    operations.push({ op: "set", path: "/raw", value: patch.raw });
  }

  if (typeof patch.summary === "string") {
    operations.push({ op: "set", path: "/summary", value: patch.summary });
  }

  if (Array.isArray(patch.tags)) {
    operations.push({ op: "set", path: "/tags", value: patch.tags });
    operations.push({ op: "set", path: "/tagsText", value: patch.tags.join(" ") });
  }

  if (Object.prototype.hasOwnProperty.call(patch, "due_date")) {
    operations.push({ op: "set", path: "/due_date", value: patch.due_date ?? null });
  }

  if (typeof patch.scheduled === "boolean") {
    operations.push({ op: "set", path: "/scheduled", value: patch.scheduled });
  }

  if (operations.length === 0) {
    return cosmosGetInboxItem(id, effectiveUserId);
  }

  const { inbox } = await getContainers();

  try {
    const { resource } = await inbox
      .item(id, effectiveUserId)
      .patch<CosmosInboxItemDocument>(operations);

    return resource ? mapInboxDocument(resource) : null;
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === 404) {
      return null;
    }

    throw error;
  }
}

export async function cosmosDeleteInboxItem(
  id: string,
  userId: string
): Promise<boolean> {
  const effectiveUserId = resolveUserId(userId);
  const { inbox, scheduledEvents } = await getContainers();
  const existing = await readInboxDocument(id, effectiveUserId);

  if (!existing) {
    return false;
  }

  const { resources: linkedEvents } = await scheduledEvents.items
    .query<{ id: string }>(
      {
        query: `
          SELECT c.id
          FROM c
          WHERE c.userId = @userId AND c.item_id = @itemId
        `,
        parameters: [
          { name: "@userId", value: effectiveUserId },
          { name: "@itemId", value: id },
        ],
      },
      { partitionKey: effectiveUserId }
    )
    .fetchAll();

  await Promise.all(
    linkedEvents.map(async (event) => {
      await scheduledEvents.item(event.id, effectiveUserId).delete();
    })
  );

  await inbox.item(id, effectiveUserId).delete();
  return true;
}

export async function cosmosCreateScheduledEvent(
  event: Omit<ScheduledEvent, "id" | "created_at">
): Promise<ScheduledEvent> {
  const { scheduledEvents } = await getContainers();
  const document = toScheduledEventDocument(event);
  const { resource } = await scheduledEvents.items.create<CosmosScheduledEventDocument>(document);
  const created = resource ?? document;

  if (created.item_id) {
    await cosmosUpdateInboxItem(created.item_id, created.userId, { scheduled: true });
  }

  return mapScheduledEventDocument(created);
}

export async function cosmosGetScheduledEvents(
  userId: string
): Promise<ScheduledEvent[]> {
  const { scheduledEvents } = await getContainers();
  const effectiveUserId = resolveUserId(userId);
  const { resources } = await scheduledEvents.items
    .query<CosmosScheduledEventDocument>(
      {
        query: `
          SELECT *
          FROM c
          WHERE c.userId = @userId
          ORDER BY c.due_at ASC
        `,
        parameters: [{ name: "@userId", value: effectiveUserId }],
      },
      { partitionKey: effectiveUserId }
    )
    .fetchAll();

  return resources.map(mapScheduledEventDocument);
}

export async function cosmosGetUpcomingEvents(
  userId: string,
  limitHours: number
): Promise<ScheduledEvent[]> {
  const { scheduledEvents } = await getContainers();
  const effectiveUserId = resolveUserId(userId);
  const now = new Date().toISOString();
  const future = new Date(Date.now() + limitHours * 60 * 60 * 1000).toISOString();
  const { resources } = await scheduledEvents.items
    .query<CosmosScheduledEventDocument>(
      {
        query: `
          SELECT *
          FROM c
          WHERE c.userId = @userId
            AND c.due_at >= @now
            AND c.due_at <= @future
            AND c.notified = false
          ORDER BY c.due_at ASC
        `,
        parameters: [
          { name: "@userId", value: effectiveUserId },
          { name: "@now", value: now },
          { name: "@future", value: future },
        ],
      },
      { partitionKey: effectiveUserId }
    )
    .fetchAll();

  return resources.slice(0, 10).map(mapScheduledEventDocument);
}

export async function cosmosMarkEventNotified(
  id: string,
  userId: string
): Promise<void> {
  const effectiveUserId = resolveUserId(userId);
  const { scheduledEvents } = await getContainers();
  await scheduledEvents.item(id, effectiveUserId).patch<CosmosScheduledEventDocument>([
    { op: "set", path: "/notified", value: true },
  ]);
}

export async function cosmosCloseScheduledEvent(
  id: string,
  userId: string
): Promise<boolean> {
  const effectiveUserId = resolveUserId(userId);
  const { scheduledEvents } = await getContainers();
  const existing = await readScheduledEventDocument(id, effectiveUserId);

  if (!existing) {
    return false;
  }

  await scheduledEvents.item(id, effectiveUserId).delete();
  return true;
}
