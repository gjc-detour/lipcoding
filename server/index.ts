import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { copilotRouter } from "./routes/copilot.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { inboxRouter } from "./routes/inbox.js";
import { eventsRouter } from "./routes/events.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { extractRouter } from "./routes/extract.js";
import { logger } from "./lib/logger.js";
import { requestLoggerMiddleware } from "./middleware/requestLogger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// API routes
app.use("/api/health", healthRouter);
app.use("/api/copilot", express.raw({ type: "*/*" }), copilotRouter);
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use("/api/chat", chatRouter);
app.use("/api/inbox", inboxRouter);
app.use("/api/events", eventsRouter);
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
});

export { app };
