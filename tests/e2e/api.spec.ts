import { test, expect } from "@playwright/test";

const API = "http://localhost:3001";

// ─── Health ────────────────────────────────────────────────────────────────────

test.describe("Health API", () => {
  test("returns ok with db status", async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});

// ─── Inbox CRUD ────────────────────────────────────────────────────────────────

test.describe("Inbox API", () => {
  test("GET /api/inbox returns array", async ({ request }) => {
    const res = await request.get(`${API}/api/inbox`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("POST /api/inbox creates a note", async ({ request }) => {
    const res = await request.post(`${API}/api/inbox`, {
      data: {
        type: "note",
        raw: "API test note for Playwright",
        summary: "Playwright test note",
        tags: ["test", "playwright"],
      },
    });
    expect(res.status()).toBe(201);
    const item = await res.json();
    expect(item.id).toBeDefined();
    expect(item.type).toBe("note");
    expect(item.summary).toBe("Playwright test note");
    expect(item.tags).toContain("test");
  });

  test("POST /api/inbox creates a task", async ({ request }) => {
    const res = await request.post(`${API}/api/inbox`, {
      data: {
        type: "task",
        raw: "Finish the Q3 report",
        summary: "Complete Q3 report",
        tags: ["q3", "report"],
        due_date: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect(res.status()).toBe(201);
    const item = await res.json();
    expect(item.type).toBe("task");
    expect(item.due_date).toBeDefined();
  });

  test("GET /api/inbox/:id retrieves the item", async ({ request }) => {
    // Create first
    const create = await request.post(`${API}/api/inbox`, {
      data: { type: "note", raw: "Retrieve me", summary: "Retrieve test", tags: [] },
    });
    const created = await create.json();

    const res = await request.get(`${API}/api/inbox/${created.id}`);
    expect(res.status()).toBe(200);
    const item = await res.json();
    expect(item.id).toBe(created.id);
    expect(item.raw).toBe("Retrieve me");
  });

  test("GET /api/inbox?search= filters results", async ({ request }) => {
    // Create a uniquely-named item
    const unique = `unique-search-term-${Date.now()}`;
    await request.post(`${API}/api/inbox`, {
      data: { type: "note", raw: unique, summary: unique, tags: [] },
    });

    const res = await request.get(`${API}/api/inbox?search=${unique}`);
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].raw).toContain(unique);
  });

  test("DELETE /api/inbox/:id removes the item", async ({ request }) => {
    // Create
    const create = await request.post(`${API}/api/inbox`, {
      data: { type: "note", raw: "Delete me", summary: "Delete test", tags: [] },
    });
    const created = await create.json();

    // Delete
    const del = await request.delete(`${API}/api/inbox/${created.id}`);
    expect(del.status()).toBe(204);

    // Verify gone
    const get = await request.get(`${API}/api/inbox/${created.id}`);
    expect(get.status()).toBe(404);
  });

  test("DELETE /api/inbox/:id with linked event succeeds (no FK error)", async ({ request }) => {
    // Create item
    const create = await request.post(`${API}/api/inbox`, {
      data: { type: "event", raw: "Meeting at 3pm", summary: "3pm meeting", tags: ["meeting"] },
    });
    const item = await create.json();

    // Create a scheduled event linked to the item
    const eventRes = await request.post(`${API}/api/events`, {
      data: {
        title: "3pm meeting reminder",
        description: "Don't be late",
        due_at: new Date(Date.now() + 3600000).toISOString(),
        item_id: item.id,
      },
    });
    expect(eventRes.status()).toBe(201);

    // Delete the item — should cascade, no FK error
    const del = await request.delete(`${API}/api/inbox/${item.id}`);
    expect(del.status()).toBe(204);
  });

  test("POST /api/inbox returns 400 for missing fields", async ({ request }) => {
    const res = await request.post(`${API}/api/inbox`, {
      data: { summary: "no type or raw" },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Events API ────────────────────────────────────────────────────────────────

test.describe("Events API", () => {
  test("GET /api/events returns array", async ({ request }) => {
    const res = await request.get(`${API}/api/events`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("POST /api/events creates a scheduled event", async ({ request }) => {
    const due = new Date(Date.now() + 3600000).toISOString();
    const res = await request.post(`${API}/api/events`, {
      data: {
        title: "Playwright event test",
        description: "Created by E2E test",
        due_at: due,
      },
    });
    expect(res.status()).toBe(201);
    const ev = await res.json();
    expect(ev.id).toBeDefined();
    expect(ev.title).toBe("Playwright event test");
    expect(ev.notified).toBe(false);
  });
});

// ─── Chat API (mocked AI response via direct storage) ─────────────────────────

test.describe("Chat API — storage side-effect", () => {
  test("items saved during agent run appear in inbox", async ({ request }) => {
    // Directly create an item the way the agent would
    const res = await request.post(`${API}/api/inbox`, {
      data: {
        type: "task",
        raw: "Follow up with client about proposal",
        summary: "Follow up with client on proposal",
        tags: ["client", "follow-up", "sales"],
      },
    });
    expect(res.status()).toBe(201);

    // Verify it appears in the list
    const list = await request.get(`${API}/api/inbox?search=follow+up`);
    const items = await list.json();
    expect(items.some((i: { summary: string }) =>
      i.summary.toLowerCase().includes("follow up")
    )).toBe(true);
  });
});
