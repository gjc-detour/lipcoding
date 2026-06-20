import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { SESSION_COOKIE_NAME } from "./lib/auth.js";
import { authRouter } from "./routes/auth.js";
import { copilotRouter } from "./routes/copilot.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { inboxRouter } from "./routes/inbox.js";
import { eventsRouter } from "./routes/events.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { extractRouter } from "./routes/extract.js";
import { notificationsRouter } from "./routes/notifications.js";
import { initCosmos } from "./lib/cosmos.js";
import { logger } from "./lib/logger.js";
import { authenticateMiddleware } from "./middleware/authenticate.js";
import { requestLoggerMiddleware } from "./middleware/requestLogger.js";
import { startNotificationCron } from "./services/notificationService.js";

dotenv.config();

const storageBackend = process.env.STORAGE_BACKEND === "cosmos" ? "cosmos" : "sqlite";

if (storageBackend === "cosmos") {
  await initCosmos();
  logger.info("Cosmos DB initialized");
}

logger.info("Storage backend configured", { backend: storageBackend });

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";
const csrfCookieName = isProduction ? "__Host-psifi.x-csrf-token" : "psifi.x-csrf-token";

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? "lipcoding-csrf-secret-change-in-prod",
  getSessionIdentifier: (req) =>
    req.cookies?.[SESSION_COOKIE_NAME] ??
    `${req.ip}:${req.get("user-agent") ?? "unknown"}:${req.get("origin") ?? "same-origin"}`,
  cookieName: csrfCookieName,
  cookieOptions: {
    sameSite: "strict",
    secure: isProduction,
    httpOnly: true,
    path: "/",
  },
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"],
});

// CORS: allow the configured origin only, or same-origin in production.
// Never reflect arbitrary origins with credentials — prevents CWE-942.
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? (
  process.env.NODE_ENV === "production" ? false : "http://localhost:5173"
);

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(requestLoggerMiddleware);

// API routes
app.use("/api/copilot", express.raw({ type: "*/*" }), copilotRouter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.get("/api/csrf-token", (req, res) => {
  res.json({ token: generateCsrfToken(req, res) });
});
app.use("/api/auth/login", doubleCsrfProtection);
app.use("/api/auth/logout", doubleCsrfProtection);
app.use("/api/auth", authRouter);
app.use(authenticateMiddleware);
app.use("/api/health", healthRouter);
app.use("/api/chat", doubleCsrfProtection, chatRouter);
app.use("/api/inbox", doubleCsrfProtection, inboxRouter);
app.use("/api/events", doubleCsrfProtection, eventsRouter);
app.use("/api/notifications", doubleCsrfProtection, notificationsRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/extract", extractRouter);

// Serve static frontend in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const correlationId = req.correlationId ?? "none";

  if ("code" in err && err.code === "EBADCSRFTOKEN") {
    logger.warn("Invalid CSRF token", {
      correlationId,
      path: req.path,
      method: req.method,
    });
    res.status(403).json({ error: "Invalid CSRF token", correlationId });
    return;
  }

  logger.error("Unhandled server error", {
    correlationId,
    error: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error", correlationId });
  }
});

app.listen(PORT, () => {
  logger.info("Server started", {
    port: PORT,
    env: process.env.NODE_ENV ?? "development",
  });
  startNotificationCron();
  logger.info("Notification cron started");
});

export { app };
