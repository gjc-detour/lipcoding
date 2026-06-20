import type {
  AuthUser,
  ChatMessage,
  InboxFilters,
  InboxItem,
  InboxItemsResponse,
  ScheduledEvent,
} from "./types";

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

export async function fetchInboxItems(
  search?: string,
  filters: InboxFilters = {}
): Promise<InboxItemsResponse> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  if (filters.type) {
    params.set("type", filters.type);
  }
  if (filters.tag?.trim()) {
    params.set("tag", filters.tag.trim());
  }
  if (filters.from?.trim()) {
    params.set("from", filters.from.trim());
  }
  if (filters.to?.trim()) {
    params.set("to", filters.to.trim());
  }

  const query = params.toString();
  const response = await fetch(query ? `/api/inbox?${query}` : "/api/inbox", {
    credentials: "same-origin",
  });
  return parseResponse<InboxItemsResponse>(response);
}

export async function createInboxItem(item: Partial<InboxItem>): Promise<InboxItem> {
  const response = await fetch("/api/inbox", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: item.type,
      raw: item.raw,
      summary: item.summary,
      tags: item.tags,
      due_date: item.due_date,
    }),
  });

  return parseResponse<InboxItem>(response);
}

export async function deleteInboxItem(id: string): Promise<void> {
  const response = await fetch(`/api/inbox/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  await parseResponse<void>(response);
}

export async function fetchEvents(): Promise<ScheduledEvent[]> {
  const response = await fetch("/api/events", {
    credentials: "same-origin",
  });
  return parseResponse<ScheduledEvent[]>(response);
}

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string }> {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      messages: history.map(({ role, content }) => ({ role, content })),
    }),
  });

  return parseResponse<{ response: string }>(response);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
  });
  return parseResponse<AuthUser>(response);
}

export async function loginWithToken(token: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  return parseResponse<AuthUser>(response);
}

export async function logoutCurrentUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  await parseResponse<void>(response);
}
