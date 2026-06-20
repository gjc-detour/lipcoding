import { beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "../server/db.js";
import { eventsRouter } from "../server/routes/events.js";
import { inboxRouter } from "../server/routes/inbox.js";

describe.sequential("Storage routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/inbox", inboxRouter);
  app.use("/api/events", eventsRouter);

  beforeEach(() => {
    db.exec(`
      DELETE FROM scheduled_events;
      DELETE FROM inbox_items;
    `);
  });

  it("creates, lists, fetches, and deletes inbox items", async () => {
    const createResponse = await request(app).post("/api/inbox").send({
      type: "task",
      raw: "Write the quarterly plan",
      summary: "Quarterly planning",
      tags: ["planning", "q3"],
      due_date: "2026-06-20T12:00:00.000Z",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.type).toBe("task");
    expect(createResponse.body.tags).toEqual(["planning", "q3"]);

    const listResponse = await request(app).get("/api/inbox").query({
      search: "quarterly",
    });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.total).toBe(1);
    expect(listResponse.body.items).toHaveLength(1);

    const itemId = createResponse.body.id as string;

    const getResponse = await request(app).get(`/api/inbox/${itemId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(itemId);

    const completeResponse = await request(app).patch(`/api/inbox/${itemId}/complete`);
    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body).toEqual({ success: true });

    const completedValue = db
      .prepare("SELECT completed FROM inbox_items WHERE id = ?")
      .get(itemId) as { completed: number } | undefined;
    expect(completedValue?.completed).toBe(1);

    const deleteResponse = await request(app).delete(`/api/inbox/${itemId}`);
    expect(deleteResponse.status).toBe(204);
  });

  it("creates and lists scheduled events", async () => {
    const itemResponse = await request(app).post("/api/inbox").send({
      type: "event",
      raw: "Dentist appointment next Monday",
      summary: "Dentist appointment",
      tags: ["health"],
    });

    const eventResponse = await request(app).post("/api/events").send({
      title: "Dentist appointment",
      description: "Reminder to leave 15 minutes early",
      due_at: "2026-06-23T09:00:00.000Z",
      item_id: itemResponse.body.id,
    });

    expect(eventResponse.status).toBe(201);
    expect(eventResponse.body.notified).toBe(false);

    const listResponse = await request(app).get("/api/events");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].title).toBe("Dentist appointment");

    const scheduledValue = db
      .prepare("SELECT scheduled FROM inbox_items WHERE id = ?")
      .get(itemResponse.body.id) as { scheduled: number } | undefined;

    expect(scheduledValue?.scheduled).toBe(1);
  });

  it("filters inbox search by type, tag, and created_at range", async () => {
    const juneTask = await request(app).post("/api/inbox").send({
      type: "task",
      raw: "Prepare launch checklist",
      summary: "Launch checklist",
      tags: ["launch", "priority"],
    });

    const juneFile = await request(app).post("/api/inbox").send({
      type: "file",
      raw: "Quarterly roadmap attachment",
      summary: "Roadmap PDF",
      tags: ["roadmap"],
    });

    const julyTask = await request(app).post("/api/inbox").send({
      type: "task",
      raw: "Prepare July launch plan",
      summary: "July launch plan",
      tags: ["launch"],
    });

    db.prepare("UPDATE inbox_items SET created_at = ? WHERE id = ?").run(
      "2026-06-05T10:00:00.000Z",
      juneTask.body.id
    );
    db.prepare("UPDATE inbox_items SET created_at = ? WHERE id = ?").run(
      "2026-06-10T10:00:00.000Z",
      juneFile.body.id
    );
    db.prepare("UPDATE inbox_items SET created_at = ? WHERE id = ?").run(
      "2026-07-05T10:00:00.000Z",
      julyTask.body.id
    );

    const filteredResponse = await request(app).get("/api/inbox").query({
      search: "launch",
      type: "task",
      tag: "launch",
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.999Z",
    });

    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.total).toBe(1);
    expect(filteredResponse.body.items).toHaveLength(1);
    expect(filteredResponse.body.items[0].id).toBe(juneTask.body.id);
  });
});
