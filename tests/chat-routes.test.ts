import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const {
  getInboxItemsMock,
  processWithCopilotSDKMock,
  processWithAzureFallbackMock,
} = vi.hoisted(() => ({
  getInboxItemsMock: vi.fn(),
  processWithCopilotSDKMock: vi.fn(),
  processWithAzureFallbackMock: vi.fn(),
}));

vi.mock("../server/services/storage.js", () => ({
  getInboxItems: getInboxItemsMock,
}));

vi.mock("../server/agents/productivity-agent.js", () => ({
  processWithCopilotSDK: processWithCopilotSDKMock,
  processWithAzureFallback: processWithAzureFallbackMock,
}));

import { chatRouter } from "../server/routes/chat.js";

describe("Chat routes", () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = "default";
    next();
  });
  app.use("/api/chat", chatRouter);

  beforeEach(() => {
    getInboxItemsMock.mockReset();
    processWithCopilotSDKMock.mockReset();
    processWithAzureFallbackMock.mockReset();
  });

  it("streams SSE chat tokens and tool events", async () => {
    const savedItem = {
      id: "item-123",
      user_id: "default",
      type: "task",
      raw: "Review Q3 roadmap",
      summary: "Review Q3 roadmap",
      tags: ["roadmap"],
      scheduled: false,
      created_at: "2026-06-20T00:00:00.000Z",
    };

    getInboxItemsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedItem]);

    processWithCopilotSDKMock.mockImplementationOnce(
      async (
        _input: unknown,
        callbacks?: {
          onToken?: (token: string) => void;
          onToolCall?: (tool: string, status: "start" | "done", preview?: string) => void;
        }
      ) => {
        callbacks?.onToolCall?.("save_item", "start", "Review Q3 roadmap");
        callbacks?.onToken?.("Saved ");
        callbacks?.onToken?.("it.");
        callbacks?.onToolCall?.("save_item", "done", "Review Q3 roadmap");

        return {
          response: "Saved it.",
          references: [],
        };
      }
    );

    const response = await request(app)
      .get("/api/chat/stream")
      .query({
        message: "Review Q3 roadmap",
        messages: JSON.stringify([]),
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(processWithCopilotSDKMock).toHaveBeenCalledTimes(1);
    expect(processWithAzureFallbackMock).not.toHaveBeenCalled();

    const events = response.text
      .trim()
      .split("\n\n")
      .map((block) => JSON.parse(block.replace(/^data:\s*/, ""))) as Array<Record<string, unknown>>;

    expect(events.slice(0, 4)).toEqual([
      {
        type: "tool_call",
        tool: "save_item",
        status: "start",
        preview: "Review Q3 roadmap",
      },
      {
        type: "token",
        content: "Saved ",
      },
      {
        type: "token",
        content: "it.",
      },
      {
        type: "tool_result",
        tool: "save_item",
        status: "done",
        preview: "Review Q3 roadmap",
      },
    ]);
    expect(events[4]).toMatchObject({
      type: "done",
      response: "Saved it.",
      items: [savedItem],
      model: "gpt-4o",
    });
    expect(events[4]?.latencyMs).toEqual(expect.any(Number));
  });

  it("falls back to Azure direct for streaming when Copilot CLI is unavailable", async () => {
    getInboxItemsMock.mockResolvedValue([]);
    processWithCopilotSDKMock.mockRejectedValueOnce(new Error("CLI not found"));
    processWithAzureFallbackMock.mockImplementationOnce(
      async (
        _input: unknown,
        callbacks?: {
          onToken?: (token: string) => void;
          onToolCall?: (tool: string, status: "start" | "done", preview?: string) => void;
        }
      ) => {
        callbacks?.onToken?.("Fallback");
        return {
          response: "Fallback",
          references: [],
        };
      }
    );

    const response = await request(app).get("/api/chat/stream").query({
      message: "Fallback please",
      messages: JSON.stringify([]),
    });

    expect(response.status).toBe(200);
    expect(processWithCopilotSDKMock).toHaveBeenCalledTimes(1);
    expect(processWithAzureFallbackMock).toHaveBeenCalledTimes(1);
    expect(response.text).toContain('"content":"Fallback"');
  });

  it("keeps POST chat responses non-streaming", async () => {
    getInboxItemsMock.mockResolvedValue([]);
    processWithCopilotSDKMock.mockRejectedValueOnce(new Error("CLI not found"));
    processWithAzureFallbackMock.mockResolvedValueOnce({
      response: "Saved it to your inbox.",
      references: [],
    });

    const response = await request(app).post("/api/chat").send({
      message: "Remember this",
      messages: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.response).toBe("Saved it to your inbox.");
    expect(response.body.model).toBe("gpt-4o");
    expect(response.body.latencyMs).toEqual(expect.any(Number));
  });
});
