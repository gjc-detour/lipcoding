import type {
  AuthUser,
  ChatResponse,
  ChatMessage,
  InboxFilters,
  InboxItem,
  InboxItemsResponse,
  ScheduledEvent,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string; details?: string }
      | null;
    const message =
      errorBody?.details ?? errorBody?.error ?? `Request failed with ${response.status}`;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function resetCsrfToken(): void {
  csrfToken = null;
}

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch("/api/csrf-token", {
    credentials: "same-origin",
  });
  const data = await parseResponse<{ token: string }>(response);
  csrfToken = data.token;
  return csrfToken;
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
      "x-csrf-token": await getCsrfToken(),
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
    headers: {
      "x-csrf-token": await getCsrfToken(),
    },
  });

  await parseResponse<void>(response);
}

export async function completeInboxItem(id: string): Promise<void> {
  const response = await fetch(`/api/inbox/${id}/complete`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": await getCsrfToken(),
    },
  });

  await parseResponse<void>(response);
}

export async function fetchEvents(): Promise<ScheduledEvent[]> {
  const response = await fetch("/api/events", {
    credentials: "same-origin",
  });
  return parseResponse<ScheduledEvent[]>(response);
}

export async function deleteEvent(id: string): Promise<void> {
  const response = await fetch(`/api/events/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": await getCsrfToken(),
    },
  });

  await parseResponse<void>(response);
}

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": await getCsrfToken(),
    },
    body: JSON.stringify({
      message,
      messages: history.map(({ role, content }) => ({ role, content })),
    }),
  });

  return parseResponse<ChatResponse>(response);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
  });
  return parseResponse<AuthUser>(response);
}

export async function loginWithToken(token: string): Promise<AuthUser> {
  resetCsrfToken();
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": await getCsrfToken(),
    },
    body: JSON.stringify({ token }),
  });
  const user = await parseResponse<AuthUser>(response);
  resetCsrfToken();
  return user;
}

export async function logoutCurrentUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": await getCsrfToken(),
    },
  });
  await parseResponse<void>(response);
  resetCsrfToken();
}
