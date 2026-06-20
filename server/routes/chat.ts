import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  processWithCopilotSDK,
  processWithAzureFallback,
  type AgentInput,
  type CopilotSDKInput,
} from "../agents/productivity-agent.js";
import { logger } from "../lib/logger.js";
import { aiLimiter } from "../middleware/aiRateLimit.js";
import { getInboxItems } from "../services/storage.js";

export const chatRouter = Router();
chatRouter.use(aiLimiter);

const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  name: z.string().optional(),
});

const chatRequestSchema = z.object({
  message: z.string().min(1),
  messages: z.array(chatMessageSchema).optional(),
});

const chatStreamQuerySchema = z.object({
  message: z.string().min(1),
  messages: z.string().optional(),
});

function buildConversation(
  message: string,
  messages?: AgentInput["messages"]
): AgentInput["messages"] {
  const history = messages ? [...messages] : [];
  history.push({ role: "user", content: message });
  return history;
}

function parseConversationQuery(messages?: string): AgentInput["messages"] | undefined {
  if (!messages?.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(messages) as unknown;
  const result = z.array(chatMessageSchema).safeParse(parsed);
  if (!result.success) {
    throw new Error("messages query parameter must be valid chat history JSON.");
  }

  return result.data;
}

// Detect if Copilot SDK is usable — falls back to Azure direct if CLI is missing
const COPILOT_SDK_ENABLED = process.env.COPILOT_SDK_ENABLED !== "false";

chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const t0 = Date.now();
    const correlationId = req.correlationId ?? "none";
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
    logger.info("Chat request", {
      correlationId,
      userId: effectiveUserId,
      messageLength: message.length,
      hasHistory: Boolean(messages?.length),
    });
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
    const model = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
    const latencyMs = Date.now() - t0;

    logger.info("Chat response", {
      correlationId,
      userId: effectiveUserId,
      model,
      latencyMs,
      toolsUsed: result.toolsUsed ?? 0,
      itemsSaved: items.length,
    });

    res.json({
      response: result.response,
      items: items.length > 0 ? items : undefined,
      model,
      latencyMs,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error("Chat endpoint error", { error: errMsg });
    res.status(500).json({ error: "AI processing failed", details: errMsg });
  }
});

chatRouter.get("/stream", async (req: Request, res: Response) => {
  try {
    const t0 = Date.now();
    const correlationId = req.correlationId ?? "none";
    const parsed = chatStreamQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        error: "message query parameter is required",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { message, messages } = parsed.data;
    const history = parseConversationQuery(messages);
    const effectiveUserId = req.userId;
    const conversation = buildConversation(message, history);
    logger.info("Chat request", {
      correlationId,
      userId: effectiveUserId,
      messageLength: message.length,
      hasHistory: Boolean(history?.length),
    });
    const previousItems = await getInboxItems(effectiveUserId);
    const previousItemIds = new Set(previousItems.map((item) => item.id));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let streamClosed = false;
    req.on("close", () => {
      streamClosed = true;
    });

    const write = (data: object) => {
      if (streamClosed) {
        return;
      }
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const result = await processWithAzureFallback(
      { message, messages: conversation, userId: effectiveUserId },
      {
        onToken: (token) => write({ type: "token", content: token }),
        onToolCall: (tool, status, preview) =>
          write({
            type: status === "start" ? "tool_call" : "tool_result",
            tool,
            status,
            preview,
          }),
      }
    );

    const items = (await getInboxItems(effectiveUserId)).filter(
      (item) => !previousItemIds.has(item.id)
    );
    const model = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
    const latencyMs = Date.now() - t0;

    logger.info("Chat response", {
      correlationId,
      userId: effectiveUserId,
      model,
      latencyMs,
      toolsUsed: result.toolsUsed ?? 0,
      itemsSaved: items.length,
    });

    write({
      type: "done",
      response: result.response,
      items: items.length > 0 ? items : undefined,
      model,
      latencyMs,
    });
    res.end();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error("Chat stream endpoint error", { error: errMsg });

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`);
      res.end();
      return;
    }

    res.status(500).json({ error: "AI processing failed", details: errMsg });
  }
});
