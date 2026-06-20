import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
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

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());

// API routes
app.use("/api/copilot", express.raw({ type: "*/*" }), copilotRouter);
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use("/api/auth", authRouter);
app.use(authenticateMiddleware);
app.use("/api/health", healthRouter);
app.use("/api/chat", chatRouter);
app.use("/api/inbox", inboxRouter);
app.use("/api/events", eventsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/extract", extractRouter);

// Serve static frontend in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
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
