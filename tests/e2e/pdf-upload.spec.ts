import { expect, test } from "@playwright/test";
import { jsonResponse, mockAuthenticatedUser } from "./helpers";

const EXTRACTED_TEXT = "Sample extracted text";

const SAVED_ITEM = {
  id: "pdf-upload-item-001",
  user_id: "default",
  type: "file" as const,
  raw: `[PDF: test.pdf — 1 page]\n${EXTRACTED_TEXT}`,
  summary: "Captured PDF summary",
  tags: ["pdf", "test"],
  scheduled: false,
  created_at: new Date().toISOString(),
};

test.describe("PDF and file upload flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test("uploads a txt file and appends its text to the capture bar", async ({ page }) => {
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Hello from a text file", "utf-8"),
    });

    await expect(page.getByPlaceholder(/drop anything/i)).toHaveValue(
      "[File: notes.txt]\nHello from a text file"
    );
  });

  test("uploads a PDF, shows extracting, and fills the capture bar with extracted text", async ({
    page,
  }) => {
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });
    await page.route("**/api/extract", async (route) => {
      await page.waitForTimeout(150);
      await route.fulfill(
        jsonResponse({
          text: EXTRACTED_TEXT,
          filename: "test.pdf",
          pageCount: 1,
          chars: 20,
        })
      );
    });

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test pdf", "utf-8"),
    });

    await expect(page.getByText(/extracting/i)).toBeVisible();
    await expect(page.getByPlaceholder(/drop anything/i)).toHaveValue(
      `[PDF: test.pdf — 1 page]\n${EXTRACTED_TEXT}`
    );
  });

  test("enables sending after PDF extraction completes", async ({ page }) => {
    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });
    await page.route("**/api/extract", async (route) => {
      await route.fulfill(
        jsonResponse({
          text: EXTRACTED_TEXT,
          filename: "test.pdf",
          pageCount: 1,
          chars: 20,
        })
      );
    });

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test pdf", "utf-8"),
    });

    await expect(page.getByPlaceholder(/drop anything/i)).toHaveValue(
      `[PDF: test.pdf — 1 page]\n${EXTRACTED_TEXT}`
    );
    await expect(page.getByRole("button", { name: /send/i })).toBeEnabled();
  });

  test("submits extracted content and shows the saved item in the inbox", async ({ page }) => {
    let items: typeof SAVED_ITEM[] = [];

    await page.route("**/api/inbox**", async (route) => {
      await route.fulfill(jsonResponse({ items, total: items.length }));
    });
    await page.route("**/api/extract", async (route) => {
      await route.fulfill(
        jsonResponse({
          text: EXTRACTED_TEXT,
          filename: "test.pdf",
          pageCount: 1,
          chars: 20,
        })
      );
    });
    await page.route("**/api/chat/stream**", async (route) => {
      items = [SAVED_ITEM];
      await route.fulfill(
        {
          status: 200,
          contentType: "text/event-stream",
          body:
            `data: ${JSON.stringify({ type: "tool_call", tool: "save_item", status: "start", preview: SAVED_ITEM.summary })}\n\n` +
            `data: ${JSON.stringify({ type: "token", content: "Saved extracted PDF to your inbox." })}\n\n` +
            `data: ${JSON.stringify({ type: "tool_result", tool: "save_item", status: "done", preview: SAVED_ITEM.summary })}\n\n` +
            `data: ${JSON.stringify({ type: "done", response: "Saved extracted PDF to your inbox.", items })}\n\n`,
        }
      );
    });

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test pdf", "utf-8"),
    });
    await page.getByRole("button", { name: /send/i }).click();

    await expect(page.getByText(/saved extracted pdf to your inbox/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(SAVED_ITEM.summary).first()).toBeVisible({ timeout: 5000 });
  });
});
