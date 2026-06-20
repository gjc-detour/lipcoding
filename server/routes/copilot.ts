import { Router, Request, Response } from "express";
import {
  verifyRequestByKeyId,
  createAckEvent,
  createDoneEvent,
  createTextEvent,
  createErrorsEvent,
  getUserMessage,
  getUserConfirmation,
  prompt as createPrompt,
} from "@copilot-extensions/preview-sdk";
import { processWithAgent } from "../agents/productivity-agent.js";

export const copilotRouter = Router();

copilotRouter.post("/", async (req: Request, res: Response) => {
  try {
    const tokenForUser = req.get("X-GitHub-Token") ?? "";

    // Extract user message from the Copilot request payload
    const userMessage = getUserMessage(req.body);

    // Check for user confirmation responses
    const confirmation = getUserConfirmation(req.body);

    // Set SSE headers for streaming response
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send acknowledgment
    res.write(createAckEvent());

    // Process with our productivity agent
    const result = await processWithAgent({
      message: userMessage,
      confirmation,
      token: tokenForUser,
    });

    // Stream the response
    res.write(createTextEvent(result.response));

    // If the agent wants confirmation for a dangerous action
    if (result.confirmationRequest) {
      res.write(
        createTextEvent(
          `\n\n⚠️ ${result.confirmationRequest.message}`
        )
      );
    }

    res.write(createDoneEvent());
    res.end();
  } catch (error) {
    console.error("Copilot endpoint error:", error);
    res.write(
      createErrorsEvent([
        {
          type: "agent",
          message: "An error occurred processing your request.",
          code: "PROCESSING_ERROR",
          identifier: "productivity-agent",
        },
      ])
    );
    res.write(createDoneEvent());
    res.end();
  }
});
