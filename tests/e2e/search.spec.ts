import { expect, test } from "@playwright/test";
import type { InboxItem } from "../../src/lib/types";
import { jsonResponse, mockAuthenticatedUser } from "./helpers";

const DATASET: InboxItem[] = [
  {
    id: "search-task-001",
    user_id: "default",
    type: "task",
    raw: "Launch roadmap tasks",
    summary: "Launch roadmap task",
    tags: ["test", "launch"],
    due_date: new Date(Date.now() + 86_400_000).toISOString(),
    scheduled: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "search-note-001",
    user_id: "default",
    type: "note",
    raw: "Launch roadmap notes",
    summary: "Launch roadmap note",
    tags: ["reference"],
    scheduled: false,
    created_at: new Date().toISOString(),
  },
];

function filterItems(urlString: string) {
  const url = new URL(urlString);
  const query = url.searchParams.get("search")?.toLowerCase() ?? "";
  const type = url.searchParams.get("type");
  const tag = url.searchParams.get("tag")?.toLowerCase() ?? "";

  return DATASET.filter((item) => {
    if (query) {
      const haystack = `${item.raw} ${item.summary} ${item.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (type && item.type !== type) {
      return false;
    }

    if (tag && !item.tags.some((itemTag) => itemTag.toLowerCase() === tag)) {
      return false;
    }

    return true;
  });
}

test.describe("Search page", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.route("**/api/inbox**", async (route) => {
      const items = filterItems(route.request().url());
      await route.fulfill(jsonResponse({ items, total: items.length }));
    });
  });

  test("shows the search bar on /search", async ({ page }) => {
    await page.goto("/search");

    await expect(
      page.getByPlaceholder("Search notes, tasks, events, and files...")
    ).toBeVisible();
  });

  test("searches inbox items and displays matching results", async ({ page }) => {
    await page.goto("/search");
    await page.getByPlaceholder("Search notes, tasks, events, and files...").fill("roadmap");

    await expect(page.getByText("Launch roadmap task").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Launch roadmap note").first()).toBeVisible({ timeout: 5000 });
  });

  test("updates results when the Tasks filter pill is selected", async ({ page }) => {
    await page.goto("/search");
    await page.getByPlaceholder("Search notes, tasks, events, and files...").fill("launch");
    await expect(page.getByText("Launch roadmap note").first()).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Tasks" }).click();

    await expect(page.getByText("Launch roadmap task").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Launch roadmap note")).toHaveCount(0);
  });

  test("shows the empty search state when nothing matches", async ({ page }) => {
    await page.goto("/search");
    await page.getByPlaceholder("Search notes, tasks, events, and files...").fill("missing-item");

    await expect(page.getByText("No results for 'missing-item'")).toBeVisible({
      timeout: 5000,
    });
  });

  test("clears all active filters", async ({ page }) => {
    await page.goto("/search");
    await page.getByPlaceholder("Search notes, tasks, events, and files...").fill("launch");
    await page.getByRole("button", { name: "Tasks" }).click();
    await page.getByPlaceholder("Filter by tag").fill("test");
    await expect(page.getByText("Launch roadmap task").first()).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /clear all filters/i }).click();

    await expect(page.getByPlaceholder("Search notes, tasks, events, and files...")).toHaveValue("");
    await expect(page.getByPlaceholder("Filter by tag")).toHaveValue("");
    await expect(page.getByText("Start typing to search")).toBeVisible();
  });
});
