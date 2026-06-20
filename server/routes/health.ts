import { Router } from "express";
import { db } from "../db.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const timestamp = new Date().toISOString();
  const dbOk = (() => {
    try {
      db.prepare("SELECT 1").get();
      return true;
    } catch {
      return false;
    }
  })();

  res.json({
    status: "ok",
    timestamp,
    db: dbOk ? "ok" : "error",
    version: process.env.npm_package_version,
  });
});
