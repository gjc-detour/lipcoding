import { test, expect } from "@playwright/test";

// ─── helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_ITEM = {
  id: "e2e-item-001",
  user_id: "default",
  type: "task" as const,
  raw: "Remember to review the Q3 roadmap by Friday",
  summary: "Review Q3 roadmap by this Friday",
  tags: ["q3", "roadmap", "review"],
  due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  scheduled: false,
  created_at: new Date().toISOString(),
};

const SAMPLE_EVENT = {
  id: "e2e-event-001",
  user_id: "default",
  item_id: SAMPLE_ITEM.id,
  title: "Review Q3 roadmap",
  description: "Friday deadline",
  due_at: SAMPLE_ITEM.due_date,
  notified: false,
  created_at: new Date().toISOString(),
};

// ─── UI smoke tests ────────────────────────────────────────────────────────────

test.describe("Page load", () => {
  test("loads inbox page with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LipCoding/i);
    await expect(page.getByText("LipCoding").first()).toBeVisible();
  });

  test("capture bar is visible with correct placeholder", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByPlaceholder(/drop anything/i)
    ).toBeVisible();
  });

  test("sidebar shows Inbox and Schedule links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/inbox/i).first()).toBeVisible();
    await expect(page.getByText(/schedule/i).first()).toBeVisible();
  });

  test("navigates to schedule page", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/schedule/i).first().click();
    await expect(page).toHaveURL(/\/schedule/);
    await expect(page.locator("main")).toBeVisible();
  });
});

// ─── Full capture flow (mocked AI) ────────────────────────────────────────────

test.describe("Capture flow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept inbox GET — start empty
    let items: typeof SAMPLE_ITEM[] = [];

    await page.route("**/api/inbox**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(items),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept chat POST — return canned AI response + item
    await page.route("**/api/chat", async (route) => {
      items = [SAMPLE_ITEM]; // simulate agent saving the item
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response: `✅ Saved as a task: "${SAMPLE_ITEM.summary}". I also noticed the Friday deadline and created a reminder.`,
          items: [SAMPLE_ITEM],
        }),
      });
    });
  });

  test("textarea accepts user input", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(/drop anything/i);
    await textarea.fill(SAMPLE_ITEM.raw);
    await expect(textarea).toHaveValue(SAMPLE_ITEM.raw);
  });

  test("Send button is disabled when textarea is empty", async ({ page }) => {
    await page.goto("/");
    const sendBtn = page.getByRole("button", { name: /send/i });
    await expect(sendBtn).toBeDisabled();
  });

  test("Send button enables after typing", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/drop anything/i).fill("hello");
    const sendBtn = page.getByRole("button", { name: /send/i });
    await expect(sendBtn).toBeEnabled();
  });

  test("submitting text shows AI response in chat area", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(/drop anything/i);
    await textarea.fill(SAMPLE_ITEM.raw);
    await page.keyboard.press("Control+Enter");

    // User message should appear in the chat area
    await expect(page.getByText(SAMPLE_ITEM.raw).first()).toBeVisible({ timeout: 5000 });
    // AI response should appear
    await expect(
      page.getByText(/Saved as a task/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("textarea is cleared after submission", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByPlaceholder(/drop anything/i);
    await textarea.fill(SAMPLE_ITEM.raw);
    await page.keyboard.press("Control+Enter");

    await expect(
      page.getByText(/Saved as a task/i)
    ).toBeVisible({ timeout: 5000 });
    await expect(textarea).toHaveValue("");
  });

  test("saved item appears in captured items list", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/drop anything/i).fill(SAMPLE_ITEM.raw);
    await page.keyboard.press("Control+Enter");

    // Wait for the AI response first
    await expect(page.getByText(/Saved as a task/i)).toBeVisible({ timeout: 5000 });

    // The item summary should appear in the inbox list
    await expect(
      page.getByText(SAMPLE_ITEM.summary).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("saved item shows correct type badge", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/drop anything/i).fill(SAMPLE_ITEM.raw);
    await page.keyboard.press("Control+Enter");
    await expect(page.getByText(/Saved as a task/i)).toBeVisible({ timeout: 5000 });

    await expect(page.getByText(/task/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("saved item shows tags", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/drop anything/i).fill(SAMPLE_ITEM.raw);
    await page.keyboard.press("Control+Enter");
    await expect(page.getByText(/Saved as a task/i)).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("q3").first()).toBeVisible({ timeout: 3000 });
  });

  test("Cmd+Enter also submits", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/drop anything/i).fill(SAMPLE_ITEM.raw);
    await page.keyboard.press("Meta+Enter");
    await expect(page.getByText(SAMPLE_ITEM.raw).first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Delete flow (mocked) ──────────────────────────────────────────────────────

test.describe("Delete item", () => {
  test("deleting an item removes it from the list", async ({ page }) => {
    let items = [SAMPLE_ITEM];

    await page.route("**/api/inbox**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(items),
        });
      } else if (method === "DELETE") {
        items = [];
        await route.fulfill({ status: 204, body: "" });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/chat", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ response: "ok" }) })
    );

    // Auto-accept the window.confirm dialog
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/");

    // Item should be visible
    await expect(page.getByText(SAMPLE_ITEM.summary).first()).toBeVisible({ timeout: 3000 });

    // Click the delete button (aria-label="Delete inbox item")
    await page.getByRole("button", { name: /delete inbox item/i }).first().click();

    // Item should disappear after refetch
    await expect(page.getByText(SAMPLE_ITEM.summary).first()).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Schedule page ─────────────────────────────────────────────────────────────

test.describe("Schedule page", () => {
  test("shows scheduled events", async ({ page }) => {
    await page.route("**/api/events**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([SAMPLE_EVENT]),
      })
    );

    await page.goto("/schedule");
    await expect(page.getByText(SAMPLE_EVENT.title).first()).toBeVisible({ timeout: 3000 });
  });

  test("shows empty state when no events", async ({ page }) => {
    await page.route("**/api/events**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/schedule");
    await expect(page.getByText(/no scheduled events/i)).toBeVisible({ timeout: 3000 });
  });
});

