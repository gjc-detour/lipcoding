import { Router, Request, Response } from "express";
import { processWithAgent } from "../agents/productivity-agent.js";

export const chatRouter = Router();

// Simple REST endpoint to test AI connectivity
chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message field is required" });
      return;
    }

    const result = await processWithAgent({
      message,
      token: "",
    });

    res.json({ response: result.response });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat endpoint error:", errMsg);
    res.status(500).json({ error: "AI processing failed", details: errMsg });
  }
});
