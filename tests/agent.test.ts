import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  promptMock,
  getFunctionCallsMock,
  createInboxItemMock,
  createScheduledEventMock,
  getInboxItemsMock,
} = vi.hoisted(() => ({
  promptMock: vi.fn(),
  getFunctionCallsMock: vi.fn(),
  createInboxItemMock: vi.fn(),
  createScheduledEventMock: vi.fn(),
  getInboxItemsMock: vi.fn(),
}));

vi.mock("@copilot-extensions/preview-sdk", () => ({
  prompt: Object.assign(promptMock, { stream: vi.fn() }),
  getFunctionCalls: getFunctionCallsMock,
}));

vi.mock("../server/services/storage.js", () => ({
  createInboxItem: createInboxItemMock,
  createScheduledEvent: createScheduledEventMock,
  getInboxItems: getInboxItemsMock,
}));

import { processWithAgent } from "../server/agents/productivity-agent.js";

describe("Productivity Agent", () => {
  beforeEach(() => {
    promptMock.mockReset();
    getFunctionCallsMock.mockReset();
    createInboxItemMock.mockReset();
    createScheduledEventMock.mockReset();
    getInboxItemsMock.mockReset();
  });

  it("returns a direct model response when no tools are called", async () => {
    promptMock.mockResolvedValueOnce({
      message: { role: "assistant", content: "Saved it to your inbox." },
    });
    getFunctionCallsMock.mockReturnValueOnce([]);

    const result = await processWithAgent({
      messages: [{ role: "user", content: "Remember to review the PR tomorrow." }],
      token: "test-token",
      userId: "tester",
    });

    expect(result.response).toBe("Saved it to your inbox.");
  });

  it("dispatches save_item tool calls and returns references", async () => {
    createInboxItemMock.mockReturnValue({
      id: "item-1",
      user_id: "tester",
      type: "task",
      raw: "Follow up with design tomorrow",
      summary: "Follow up with design",
      tags: ["design", "follow-up"],
      due_date: "2026-06-21",
      scheduled: false,
      created_at: "2026-06-20T00:00:00.000Z",
    });

    promptMock
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "" },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Saved your task and reminder." },
      });

    getFunctionCallsMock
      .mockReturnValueOnce([
        {
          id: "call-1",
          function: {
            name: "save_item",
            arguments: JSON.stringify({
              type: "task",
              raw: "Follow up with design tomorrow",
              summary: "Follow up with design",
              tags: ["design", "follow-up"],
              due_date: "2026-06-21",
            }),
          },
        },
      ])
      .mockReturnValueOnce([]);

    const result = await processWithAgent({
      messages: [{ role: "user", content: "Follow up with design tomorrow." }],
      token: "test-token",
      userId: "tester",
    });

    expect(createInboxItemMock).toHaveBeenCalledWith({
      user_id: "tester",
      type: "task",
      raw: "Follow up with design tomorrow",
      summary: "Follow up with design",
      tags: ["design", "follow-up"],
      due_date: "2026-06-21",
      scheduled: false,
    });
    expect(result.response).toBe("Saved your task and reminder.");
    expect(result.references).toEqual([
      expect.objectContaining({
        type: "inbox_item",
        id: "item-1",
      }),
    ]);
  });

  it("handles confirmation accepted", async () => {
    const result = await processWithAgent({
      messages: [],
      confirmation: { accepted: true },
      token: "test-token",
    });

    expect(result.response).toContain("confirmed");
  });

  it("handles confirmation rejected", async () => {
    const result = await processWithAgent({
      messages: [],
      confirmation: { accepted: false },
      token: "test-token",
    });

    expect(result.response).toContain("cancelled");
  });
});
