import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";

class MockEventSource {
  static instances: MockEventSource[] = [];

  private listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

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

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
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
    expect(await screen.findByRole("link", { name: /Inbox/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("renders reminder toasts from the notifications stream", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
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

    const eventSource = MockEventSource.instances[0];
    expect(eventSource?.url).toBe("/api/notifications");

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

  it("shows the login screen and signs in with a token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

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
});
