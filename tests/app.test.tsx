import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App";

describe("App", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the app shell", async () => {
    render(<App />);
    expect(await screen.findByText("LipCoding")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Inbox/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });
});
