import { Router, type Response } from "express";
import { z } from "zod";
import {
  DEFAULT_USER,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
  getUserByToken,
  isAuthenticationConfigured,
} from "../lib/auth.js";
import { resolveAuthenticatedUser } from "../middleware/authenticate.js";

export const authRouter = Router();

const loginSchema = z.object({
  token: z.string().min(1),
});

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

authRouter.post("/login", (req, res) => {
  if (!isAuthenticationConfigured()) {
    res.json({
      userId: DEFAULT_USER.id,
      displayName: DEFAULT_USER.displayName,
    });
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  const user = getUserByToken(parsed.data.token);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  setSessionCookie(res, user.token);
  res.json({ userId: user.id, displayName: user.displayName });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get("/me", (req, res) => {
  const user = resolveAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({ userId: user.id, displayName: user.displayName });
});
