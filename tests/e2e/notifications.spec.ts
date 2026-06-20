import { expect, test, type Page } from "@playwright/test";
import { jsonResponse, TEST_USER } from "./helpers";

const NOTIFICATION = {
  eventId: "notification-e2e-001",
  title: "Standup reminder",
  description: "Daily sync starts in 10 minutes.",
  due_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
};

async function installNotificationEventSource(page: Page) {
  await page.addInitScript((payload: typeof NOTIFICATION) => {
    const nativeSetTimeout = window.setTimeout.bind(window);

    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      nativeSetTimeout(
        handler,
        typeof timeout === "number" && timeout >= 10_000 ? 1_000 : timeout,
        ...args
      )) as typeof window.setTimeout;

    class MockEventSource {
      private listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
      readonly url: string;
      readyState = 1;
      withCredentials = false;

      constructor(url: string | URL) {
        this.url = String(url);

        if (this.url.includes("/api/notifications")) {
          nativeSetTimeout(() => {
            const event = new MessageEvent("notification", {
              data: JSON.stringify(payload),
            });
            for (const listener of this.listeners.get("notification") ?? []) {
              listener(event);
            }
          }, 10);
        }
      }

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add((event) => {
          if (typeof listener === "function") {
            listener(event);
          } else {
            listener.handleEvent(event);
          }
        });
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        const listeners = this.listeners.get(type);
        if (!listeners) {
          return;
        }

        for (const currentListener of listeners) {
          if (currentListener === listener) {
            listeners.delete(currentListener);
          }
        }
      }

      close() {
        this.readyState = 2;
        this.listeners.clear();
      }
    }

    Object.defineProperty(window, "EventSource", {
      configurable: true,
      writable: true,
      value: MockEventSource,
    });
  }, NOTIFICATION);
}

test.describe("Notification toasts", () => {
  test.beforeEach(async ({ page }) => {
    await installNotificationEventSource(page);
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill(jsonResponse(TEST_USER));
    });
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });
  });

  test("shows a toast with the notification title", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("status")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(NOTIFICATION.title)).toBeVisible();
  });

  test("dismisses the toast when the close button is clicked", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(NOTIFICATION.title)).toBeVisible({ timeout: 5000 });
    await page
      .getByRole("button", { name: new RegExp(`Dismiss reminder for ${NOTIFICATION.title}`, "i") })
      .click();

    await expect(page.getByText(NOTIFICATION.title)).not.toBeVisible();
  });

  test("auto-dismisses the toast after the timeout", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(NOTIFICATION.title)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(NOTIFICATION.title)).not.toBeVisible({ timeout: 2500 });
  });
});
