import { randomUUID } from "crypto";
import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";
import { requestContext } from "../lib/requestContext.js";

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const path = req.path;
  const userAgent = req.get("user-agent") ?? "unknown";

  res.setHeader("X-Correlation-Id", correlationId);

  requestContext.run({ correlationId }, () => {
    logger.info(`→ ${req.method} ${path}`, {
      correlationId,
      method: req.method,
      path,
      userAgent,
    });

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;

      logger.info(`← ${req.method} ${path} ${res.statusCode} ${durationMs}ms`, {
        correlationId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
        userAgent,
      });
    });

    next();
  });
};
