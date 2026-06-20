import type { ChatMessage, InboxItem, ScheduledEvent } from "./types";

const DEFAULT_USER_ID = "default";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; details?: string }
      | null;
    const message =
      errorBody?.details ?? errorBody?.error ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchInboxItems(search?: string): Promise<InboxItem[]> {
  const params = new URLSearchParams({ userId: DEFAULT_USER_ID });
  if (search?.trim()) {
    params.set("search", search.trim());
  }

  const response = await fetch(`/api/inbox?${params.toString()}`);
  return parseResponse<InboxItem[]>(response);
}

export async function createInboxItem(item: Partial<InboxItem>): Promise<InboxItem> {
  const response = await fetch("/api/inbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: item.type,
      raw: item.raw,
      summary: item.summary,
      tags: item.tags,
      due_date: item.due_date,
      user_id: item.user_id ?? DEFAULT_USER_ID,
    }),
  });

  return parseResponse<InboxItem>(response);
}

export async function deleteInboxItem(id: string): Promise<void> {
  const response = await fetch(`/api/inbox/${id}`, {
    method: "DELETE",
  });

  await parseResponse<void>(response);
}

export async function fetchEvents(): Promise<ScheduledEvent[]> {
  const params = new URLSearchParams({ userId: DEFAULT_USER_ID });
  const response = await fetch(`/api/events?${params.toString()}`);
  return parseResponse<ScheduledEvent[]>(response);
}

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string }> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      messages: history.map(({ role, content }) => ({ role, content })),
      userId: DEFAULT_USER_ID,
    }),
  });

  return parseResponse<{ response: string }>(response);
}
