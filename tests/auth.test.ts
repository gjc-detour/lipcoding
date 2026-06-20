import { afterEach, beforeEach, describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { db } from "../server/db.js";
import { authenticateMiddleware } from "../server/middleware/authenticate.js";
import { authRouter } from "../server/routes/auth.js";
import { eventsRouter } from "../server/routes/events.js";
import { inboxRouter } from "../server/routes/inbox.js";

describe.sequential("Authentication", () => {
  const originalAllowedUsers = process.env.ALLOWED_USERS;

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(authenticateMiddleware);
  app.use("/api/inbox", inboxRouter);
  app.use("/api/events", eventsRouter);

  beforeEach(() => {
    db.exec(`
      DELETE FROM scheduled_events;
      DELETE FROM inbox_items;
    `);
  });

  afterEach(() => {
    process.env.ALLOWED_USERS = originalAllowedUsers;
  });

  it("returns the default user when auth is not configured", async () => {
    delete process.env.ALLOWED_USERS;

    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: "default",
      displayName: "Default User",
    });
  });

  it("rejects protected routes without a valid token when auth is configured", async () => {
    process.env.ALLOWED_USERS = "gjc:GJC:token-1,user2:User Two:token-2";

    const response = await request(app).get("/api/inbox");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("logs in and isolates inbox data by user", async () => {
    process.env.ALLOWED_USERS = "gjc:GJC:token-1,user2:User Two:token-2";

    const gjcAgent = request.agent(app);
    const user2Agent = request.agent(app);

    const gjcLogin = await gjcAgent.post("/api/auth/login").send({ token: "token-1" });
    const user2Login = await user2Agent.post("/api/auth/login").send({ token: "token-2" });

    expect(gjcLogin.status).toBe(200);
    expect(gjcLogin.body).toEqual({ userId: "gjc", displayName: "GJC" });
    expect(user2Login.status).toBe(200);
    expect(user2Login.body).toEqual({ userId: "user2", displayName: "User Two" });

    const createResponse = await gjcAgent.post("/api/inbox").send({
      type: "task",
      raw: "Private task",
      summary: "GJC only",
      tags: ["private"],
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.user_id).toBe("gjc");

    const gjcList = await gjcAgent.get("/api/inbox");
    const user2List = await user2Agent.get("/api/inbox");

    expect(gjcList.status).toBe(200);
    expect(gjcList.body.total).toBe(1);
    expect(user2List.status).toBe(200);
    expect(user2List.body.total).toBe(0);

    const user2Get = await user2Agent.get(`/api/inbox/${createResponse.body.id}`);
    expect(user2Get.status).toBe(403);

    const user2Complete = await user2Agent.patch(`/api/inbox/${createResponse.body.id}/complete`);
    expect(user2Complete.status).toBe(403);

    const user2Delete = await user2Agent.delete(`/api/inbox/${createResponse.body.id}`);
    expect(user2Delete.status).toBe(403);

    const eventResponse = await gjcAgent.post("/api/events").send({
      title: "Private reminder",
      due_at: "2026-06-22T09:00:00.000Z",
      item_id: createResponse.body.id,
    });

    expect(eventResponse.status).toBe(201);

    const user2EventDelete = await user2Agent.delete(`/api/events/${eventResponse.body.id}`);
    expect(user2EventDelete.status).toBe(403);
  });
});
