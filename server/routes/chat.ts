import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  processWithCopilotSDK,
  processWithAzureFallback,
  type AgentInput,
  type CopilotSDKInput,
} from "../agents/productivity-agent.js";
import { logger } from "../lib/logger.js";
import { getInboxItems } from "../services/storage.js";

export const chatRouter = Router();

const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  name: z.string().optional(),
});

const chatRequestSchema = z.object({
  message: z.string().min(1),
  messages: z.array(chatMessageSchema).optional(),
});

function buildConversation(
  message: string,
  messages?: AgentInput["messages"]
): AgentInput["messages"] {
  const history = messages ? [...messages] : [];
  history.push({ role: "user", content: message });
  return history;
}

// Detect if Copilot SDK is usable — falls back to Azure direct if CLI is missing
const COPILOT_SDK_ENABLED = process.env.COPILOT_SDK_ENABLED !== "false";

chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "message field is required",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { message, messages } = parsed.data;
    const effectiveUserId = req.userId;
    const conversation = buildConversation(message, messages);
    const previousItems = await getInboxItems(effectiveUserId);
    const previousItemIds = new Set(previousItems.map((item) => item.id));

    const input: CopilotSDKInput = {
      message,
      messages: conversation,
      userId: effectiveUserId,
    };

    let result;
    if (COPILOT_SDK_ENABLED) {
      try {
        result = await processWithCopilotSDK(input);
      } catch (sdkError) {
        const sdkErrMsg = sdkError instanceof Error ? sdkError.message : String(sdkError);
        const isCLIError =
          sdkErrMsg.toLowerCase().includes("cli") ||
          sdkErrMsg.toLowerCase().includes("not found") ||
          sdkErrMsg.toLowerCase().includes("empty mode");

        if (isCLIError) {
          logger.warn("Copilot SDK unavailable, falling back to Azure direct", { error: sdkErrMsg });
          result = await processWithAzureFallback({ message, messages: conversation, userId: effectiveUserId });
        } else {
          throw sdkError;
        }
      }
    } else {
      result = await processWithAzureFallback({ message, messages: conversation, userId: effectiveUserId });
    }

    const items = (await getInboxItems(effectiveUserId)).filter(
      (item) => !previousItemIds.has(item.id)
    );

    res.json({
      response: result.response,
      items: items.length > 0 ? items : undefined,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error("Chat endpoint error", { error: errMsg });
    res.status(500).json({ error: "AI processing failed", details: errMsg });
  }
});
