import type { Request, RequestHandler } from "express";
import { requestContext } from "../lib/requestContext.js";
import {
  DEFAULT_USER,
  getUserByToken,
  isAuthenticationConfigured,
  type User,
  SESSION_COOKIE_NAME,
} from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      user?: User;
    }
  }
}

function getBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function getRequestToken(req: Request): string | undefined {
  const headerToken = req.get("x-user-token")?.trim();
  if (headerToken) {
    return headerToken;
  }

  const bearerToken = getBearerToken(req.get("authorization"));
  if (bearerToken) {
    return bearerToken;
  }

  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof cookieToken === "string" ? cookieToken.trim() : undefined;
}

function assignRequestUser(req: Request, user: User): void {
  req.user = user;
  req.userId = user.id;

  const context = requestContext.getStore();
  if (context) {
    context.userId = user.id;
  }
}

export function resolveAuthenticatedUser(req: Request): User | null {
  if (!isAuthenticationConfigured()) {
    return DEFAULT_USER;
  }

  const token = getRequestToken(req);
  return token ? getUserByToken(token) : null;
}

export const authenticateMiddleware: RequestHandler = (req, res, next) => {
  const user = resolveAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  assignRequestUser(req, user);
  next();
};
