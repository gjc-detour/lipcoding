import { Router } from "express";
import { registerSSEClient } from "../services/notificationService.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", (req, res) => {
  const userId = req.userId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  const unsubscribe = registerSSEClient(userId, res);
  const heartbeatId = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 30_000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    unsubscribe();
    res.end();
  });
});
