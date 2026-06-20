import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";

class MockEventSource {
  static instances: MockEventSource[] = [];

  private listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback =
      typeof listener === "function"
        ? (listener as (event: MessageEvent<string>) => void)
        : (event: MessageEvent<string>) => listener.handleEvent(event);
    const listeners = this.listeners.get(type) ?? new Set<(event: MessageEvent<string>) => void>();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback =
      typeof listener === "function"
        ? (listener as (event: MessageEvent<string>) => void)
        : (event: MessageEvent<string>) => listener.handleEvent(event);
    this.listeners.get(type)?.delete(callback);
  }

  close() {
    return undefined;
  }

  dispatch(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });

    if (type === "message") {
      this.onmessage?.(event);
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  fail() {
    this.onerror?.(new Event("error"));
  }
}

describe("App", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the app shell", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/csrf-token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "csrf-token" }),
        } as Response;
      }
      if (url.endsWith("/api/auth/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ userId: "default", displayName: "Default User" }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/api/events") ? [] : { items: [], total: 0 },
      } as Response;
    });

    render(<App />);
    expect(await screen.findByText("LipCoding")).toBeInTheDocument();
    expect((await screen.findAllByRole("link", { name: /Inbox/i })).length).toBeGreaterThan(0);
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("renders reminder toasts from the notifications stream", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/csrf-token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "csrf-token" }),
        } as Response;
      }
      if (url.endsWith("/api/auth/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ userId: "default", displayName: "Default User" }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/api/events") ? [] : { items: [], total: 0 },
      } as Response;
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    await waitFor(() => {
      expect(MockEventSource.instances[0]?.url).toBe("/api/notifications");
    });
    const eventSource = MockEventSource.instances[0];

    await act(async () => {
      eventSource.dispatch("notification", {
        type: "event_reminder",
        eventId: "event-123",
        title: "Join focus session",
        description: "Start the deep work block now.",
        due_at: new Date().toISOString(),
      });
    });

    expect(await screen.findByText("Join focus session")).toBeInTheDocument();
    expect(await screen.findByText("Start the deep work block now.")).toBeInTheDocument();
  });

  it("marks notifications as dismissed when the user closes a toast", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/csrf-token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "csrf-token" }),
        } as Response;
      }
      if (url.endsWith("/api/auth/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ userId: "default", displayName: "Default User" }),
        } as Response;
      }

      if (url.endsWith("/api/notifications/dismiss/event-123") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/api/events") ? [] : { items: [], total: 0 },
      } as Response;
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    await waitFor(() => {
      expect(MockEventSource.instances[0]?.url).toBe("/api/notifications");
    });

    await act(async () => {
      MockEventSource.instances[0]?.dispatch("notification", {
        type: "event_reminder",
        eventId: "event-123",
        title: "Join focus session",
        description: "Start the deep work block now.",
        due_at: new Date().toISOString(),
      });
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /dismiss reminder for join focus session/i })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications/dismiss/event-123", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "x-csrf-token": "csrf-token",
        },
      });
    });
  });

  it("shows the login screen and signs in with a token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/api/csrf-token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "csrf-token" }),
        } as Response;
      }

      if (url.endsWith("/api/auth/me")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: "Unauthorized" }),
        } as Response;
      }

      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ userId: "gjc", displayName: "GJC" }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/api/events") ? [] : { items: [], total: 0 },
      } as Response;
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "LipCoding" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Access Token"), {
      target: { value: "token-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));

    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("retries the last failed chat message without duplicating error history", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/csrf-token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: "csrf-token" }),
        } as Response;
      }
      if (url.endsWith("/api/auth/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ userId: "default", displayName: "Default User" }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () =>
          url.includes("/api/events") ? [] : { items: [], total: 0 },
      } as Response;
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Capture anything — text, voice, or file"), {
      target: { value: "Retry this note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(
        MockEventSource.instances.some((instance) => instance.url.startsWith("/api/chat/stream?"))
      ).toBe(true);
    });

    const firstChatStream = MockEventSource.instances.find((instance) =>
      instance.url.startsWith("/api/chat/stream?")
    );
    expect(firstChatStream).toBeDefined();

    await act(async () => {
      firstChatStream?.dispatch("message", { type: "error", message: "Temporary failure" });
    });

    fireEvent.click(await screen.findByRole("button", { name: "↺ Retry" }));

    const chatStreams = MockEventSource.instances.filter((instance) =>
      instance.url.startsWith("/api/chat/stream?")
    );
    expect(chatStreams).toHaveLength(2);

    const retryUrl = new URL(chatStreams[1]!.url, "http://localhost");
    const retryHistory = JSON.parse(retryUrl.searchParams.get("messages") ?? "[]") as Array<{
      role: string;
      content: string;
    }>;

    expect(retryHistory).toEqual([]);

    await act(async () => {
      chatStreams[1]?.dispatch("message", {
        type: "done",
        response: "Recovered response",
        model: "gpt-4o",
        latencyMs: 42,
      });
    });

    expect(await screen.findByText("Recovered response")).toBeInTheDocument();
  });
});
