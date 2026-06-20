import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { healthRouter } from "../server/routes/health";

describe("Health API", () => {
  const app = express();
  app.use("/api/health", healthRouter);

  it("returns ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.version).toBeDefined();
    expect(res.body.services).toEqual({
      db: { status: "ok", backend: "sqlite" },
      openai: { status: "unconfigured", model: "gpt-4o" },
      whisper: { status: "unconfigured" },
      documentIntelligence: { status: "unconfigured" },
      blobStorage: { status: "unconfigured" },
      notifications: { status: "unconfigured" },
    });
  });
});
