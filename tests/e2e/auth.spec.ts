import { expect, test } from "@playwright/test";
import { installNoopEventSource, jsonResponse, mockAuthenticatedUser, TEST_USER } from "./helpers";

test.describe("Authentication flow", () => {
  test("shows the login page when the current session is unauthorized", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "LipCoding" })).toBeVisible();
    await expect(page.getByText(/enter your access token to continue/i)).toBeVisible();
    await expect(page.getByLabel(/access token/i)).toBeVisible();
  });

  test("logs in with a valid token and redirects to the inbox", async ({ page }) => {
    await installNoopEventSource(page);

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
    });
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill(jsonResponse(TEST_USER));
    });
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });

    await page.goto("/");
    await page.getByLabel(/access token/i).fill("valid-token");
    await page.getByRole("button", { name: /enter/i }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(TEST_USER.displayName)).toBeVisible();
  });

  test("shows an error for an invalid token", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill(jsonResponse({ error: "Unauthorized" }, 401));
    });
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill(jsonResponse({ error: "Invalid token" }, 401));
    });

    await page.goto("/");
    await page.getByLabel(/access token/i).fill("bad-token");
    await page.getByRole("button", { name: /enter/i }).click();

    await expect(page.getByText("Invalid token")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows the logged-in user's name in the sidebar", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });

    await page.goto("/");

    await expect(page.getByText(TEST_USER.displayName)).toBeVisible();
    await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  });

  test("logs out and returns to the login page", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });
    await page.route("**/api/auth/logout", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /log out/i }).click();

    await expect(page.getByLabel(/access token/i)).toBeVisible();
    await expect(page.getByText(TEST_USER.displayName)).not.toBeVisible();
  });
});
