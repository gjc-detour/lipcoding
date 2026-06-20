import type { Page } from "@playwright/test";

export const TEST_USER = {
  userId: "default",
  displayName: "Test User",
};

export function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

export async function installNoopEventSource(page: Page) {
  await page.addInitScript(() => {
    class NoopEventSource {
      readonly url: string;
      readyState = 1;
      withCredentials = false;

      constructor(url: string | URL) {
        this.url = String(url);
      }

      addEventListener() {}

      removeEventListener() {}

      close() {
        this.readyState = 2;
      }
    }

    Object.defineProperty(window, "EventSource", {
      configurable: true,
      writable: true,
      value: NoopEventSource,
    });
  });
}

export async function mockAuthenticatedUser(page: Page, user = TEST_USER) {
  await installNoopEventSource(page);
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill(jsonResponse(user));
  });
}
