import { expect, test } from "@playwright/test";

const API = "http://localhost:3001";

function uniqueValue(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

test.describe("Inbox API", () => {
  test("GET /api/inbox returns items with a total count", async ({ request }) => {
    const res = await request.get(`${API}/api/inbox`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe(body.items.length);
  });

  test("POST /api/inbox creates a note", async ({ request }) => {
    const summary = uniqueValue("playwright-note");
    const res = await request.post(`${API}/api/inbox`, {
      data: {
        type: "note",
        raw: `Raw ${summary}`,
        summary,
        tags: ["test", "playwright"],
      },
    });

    expect(res.status()).toBe(201);
    const item = await res.json();
    expect(item.id).toBeDefined();
    expect(item.type).toBe("note");
    expect(item.summary).toBe(summary);
    expect(item.tags).toContain("test");
  });

  test("POST /api/inbox creates a task", async ({ request }) => {
    const summary = uniqueValue("playwright-task");
    const res = await request.post(`${API}/api/inbox`, {
      data: {
        type: "task",
        raw: `Raw ${summary}`,
        summary,
        tags: ["q3", "report"],
        due_date: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });

    expect(res.status()).toBe(201);
    const item = await res.json();
    expect(item.type).toBe("task");
    expect(item.due_date).toBeDefined();
  });

  test("GET /api/inbox/:id retrieves the item", async ({ request }) => {
    const summary = uniqueValue("retrieve-item");
    const create = await request.post(`${API}/api/inbox`, {
      data: { type: "note", raw: `Raw ${summary}`, summary, tags: [] },
    });
    const created = await create.json();

    const res = await request.get(`${API}/api/inbox/${created.id}`);
    expect(res.status()).toBe(200);
    const item = await res.json();
    expect(item.id).toBe(created.id);
    expect(item.summary).toBe(summary);
  });

  test("GET /api/inbox?search= filters results", async ({ request }) => {
    const summary = uniqueValue("unique-search-term");
    await request.post(`${API}/api/inbox`, {
      data: { type: "note", raw: `Raw ${summary}`, summary, tags: [] },
    });

    const res = await request.get(`${API}/api/inbox?search=${encodeURIComponent(summary)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.some((item: { summary: string }) => item.summary.includes(summary))).toBe(
      true
    );
  });

  test("GET /api/inbox?type=task returns only tasks", async ({ request }) => {
    const taskSummary = uniqueValue("type-filter-task");
    await request.post(`${API}/api/inbox`, {
      data: {
        type: "task",
        raw: `Raw ${taskSummary}`,
        summary: taskSummary,
        tags: ["test"],
      },
    });

    const res = await request.get(`${API}/api/inbox?type=task`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((item: { type: string }) => item.type === "task")).toBe(true);
    expect(body.items.some((item: { summary: string }) => item.summary === taskSummary)).toBe(
      true
    );
  });

  test("GET /api/inbox?tag=test returns only matching tagged items", async ({ request }) => {
    const summary = uniqueValue("tag-filter-item");
    await request.post(`${API}/api/inbox`, {
      data: {
        type: "note",
        raw: `Raw ${summary}`,
        summary,
        tags: ["test", "playwright"],
      },
    });

    const res = await request.get(`${API}/api/inbox?tag=test`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((item: { tags: string[] }) => item.tags.includes("test"))).toBe(true);
    expect(body.items.some((item: { summary: string }) => item.summary === summary)).toBe(true);
  });

  test("DELETE /api/inbox/:id removes the item", async ({ request }) => {
    const summary = uniqueValue("delete-item");
    const create = await request.post(`${API}/api/inbox`, {
      data: { type: "note", raw: `Raw ${summary}`, summary, tags: [] },
    });
    const created = await create.json();

    const del = await request.delete(`${API}/api/inbox/${created.id}`);
    expect(del.status()).toBe(204);

    const get = await request.get(`${API}/api/inbox/${created.id}`);
    expect(get.status()).toBe(404);
  });

  test("DELETE /api/inbox/:id with linked event succeeds (no FK error)", async ({ request }) => {
    const create = await request.post(`${API}/api/inbox`, {
      data: {
        type: "event",
        raw: uniqueValue("meeting"),
        summary: uniqueValue("meeting-summary"),
        tags: ["meeting"],
      },
    });
    const item = await create.json();

    const eventRes = await request.post(`${API}/api/events`, {
      data: {
        title: "3pm meeting reminder",
        description: "Don't be late",
        due_at: new Date(Date.now() + 3_600_000).toISOString(),
        item_id: item.id,
      },
    });
    expect(eventRes.status()).toBe(201);

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

test.describe("Events API", () => {
  test("GET /api/events returns array", async ({ request }) => {
    const res = await request.get(`${API}/api/events`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("POST /api/events creates a scheduled event", async ({ request }) => {
    const title = uniqueValue("playwright-event");
    const due = new Date(Date.now() + 3_600_000).toISOString();
    const res = await request.post(`${API}/api/events`, {
      data: {
        title,
        description: "Created by E2E test",
        due_at: due,
      },
    });

    expect(res.status()).toBe(201);
    const event = await res.json();
    expect(event.id).toBeDefined();
    expect(event.title).toBe(title);
    expect(event.notified).toBe(false);
  });

  test("DELETE /api/events/:id creates an event and then deletes it", async ({ request }) => {
    const title = uniqueValue("delete-event");
    const create = await request.post(`${API}/api/events`, {
      data: {
        title,
        description: "Delete me",
        due_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    expect(create.status()).toBe(201);
    const event = await create.json();

    const del = await request.delete(`${API}/api/events/${event.id}`);
    expect(del.status()).toBe(204);

    const list = await request.get(`${API}/api/events`);
    expect(list.status()).toBe(200);
    const events = await list.json();
    expect(events.some((scheduledEvent: { id: string }) => scheduledEvent.id === event.id)).toBe(
      false
    );
  });
});

test.describe("Auth API", () => {
  test("GET /api/auth/me returns the default user in single-user mode", async ({ request }) => {
    const res = await request.get(`${API}/api/auth/me`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.userId).toBe("default");
    expect(body.displayName).toBeDefined();
  });
});

test.describe("Chat API — storage side-effect", () => {
  test("items saved during agent run appear in inbox", async ({ request }) => {
    const summary = uniqueValue("follow-up");
    const res = await request.post(`${API}/api/inbox`, {
      data: {
        type: "task",
        raw: `Follow up ${summary}`,
        summary,
        tags: ["client", "follow-up", "sales"],
      },
    });
    expect(res.status()).toBe(201);

    const list = await request.get(`${API}/api/inbox?search=${encodeURIComponent(summary)}`);
    const body = await list.json();
    expect(body.items.some((item: { summary: string }) => item.summary === summary)).toBe(true);
  });
});
