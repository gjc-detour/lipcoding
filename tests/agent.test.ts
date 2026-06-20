import { describe, it, expect, vi } from "vitest";
import { processWithAgent } from "../server/agents/productivity-agent";

// Mock openai
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: { content: "Here's your task breakdown:\n1. Do X\n2. Do Y" },
            },
          ],
        }),
      },
    },
  })),
}));

describe("Productivity Agent", () => {
  it("processes a user message and returns a response", async () => {
    const result = await processWithAgent({
      message: "Help me break down building a REST API",
      token: "test-token",
    });

    expect(result.response).toContain("task breakdown");
  });

  it("handles confirmation accepted", async () => {
    const result = await processWithAgent({
      message: "",
      confirmation: { accepted: true },
      token: "test-token",
    });

    expect(result.response).toContain("confirmed");
  });

  it("handles confirmation rejected", async () => {
    const result = await processWithAgent({
      message: "",
      confirmation: { accepted: false },
      token: "test-token",
    });

    expect(result.response).toContain("cancelled");
  });
});
