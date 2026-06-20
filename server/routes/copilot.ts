import { Router, type Request, type Response } from "express";
import {
  createAckEvent,
  createConfirmationEvent,
  createDoneEvent,
  createErrorsEvent,
  createReferencesEvent,
  createTextEvent,
  getUserConfirmation,
  parseRequestBody,
  verifyAndParseRequest,
} from "@copilot-extensions/preview-sdk";
import { processWithAgent } from "../agents/productivity-agent.js";
import { logger } from "../lib/logger.js";

export const copilotRouter = Router();

function getRawBody(req: Request): string {
  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }

  return "";
}

function extractUserId(
  messages: Array<{ role: string; content: string; name?: string }>
): string | undefined {
  const sessionMessage = messages.find((message) => message.name === "_session");
  if (!sessionMessage) {
    return undefined;
  }

  const match = sessionMessage.content.match(/Current User's Login:\s*([^\s]+)/i);
  return match?.[1];
}

copilotRouter.post("/", async (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    const token = req.get("X-GitHub-Token") ?? "";
    const signature = req.get("github-public-key-signature");
    const keyId = req.get("github-public-key-identifier");
    const rawBody = getRawBody(req);

    if (!rawBody) {
      res.status(400);
      res.write(
        createErrorsEvent([
          {
            type: "agent",
            message: "Request body is empty.",
            code: "EMPTY_BODY",
            identifier: "productivity-agent",
          },
        ])
      );
      res.write(createDoneEvent());
      res.end();
      return;
    }

    let parsedRequest;

    if (!signature || !keyId) {
      if (process.env.NODE_ENV === "production") {
        res.status(401);
        res.write(
          createErrorsEvent([
            {
              type: "agent",
              message: "Request signature required in production.",
              code: "SIGNATURE_REQUIRED",
              identifier: "productivity-agent",
            },
          ])
        );
        res.write(createDoneEvent());
        res.end();
        return;
      }

      logger.warn("Copilot request verification skipped (dev only)", {
        reason: "signature headers missing",
      });
      parsedRequest = {
        isValidRequest: true,
        payload: parseRequestBody(rawBody),
      };
    } else {
      parsedRequest = await verifyAndParseRequest(rawBody, signature, keyId, { token });
    }

    if (!parsedRequest.isValidRequest) {
      res.status(401);
      res.write(
        createErrorsEvent([
          {
            type: "agent",
            message: "Request could not be verified.",
            code: "INVALID_SIGNATURE",
            identifier: "productivity-agent",
          },
        ])
      );
      res.write(createDoneEvent());
      res.end();
      return;
    }

    const { payload } = parsedRequest;
    const userId = extractUserId(payload.messages);
    const confirmation = getUserConfirmation(payload) ?? null;

    res.write(createAckEvent());

    const result = await processWithAgent({
      messages: payload.messages,
      token,
      userId,
      confirmation,
    });

    if (result.confirmationRequest) {
      res.write(createConfirmationEvent(result.confirmationRequest));
    }

    if (result.references?.length) {
      res.write(createReferencesEvent(result.references));
    }

    res.write(createTextEvent(result.response));
    res.write(createDoneEvent());
    res.end();
  } catch (error: unknown) {
    logger.error("Copilot endpoint error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500);
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
