import type { Response } from "express";

export function assertOwnership(
  itemUserId: string,
  reqUserId: string,
  res: Response
): boolean {
  if (itemUserId !== reqUserId) {
    res.status(403).json({ error: "Forbidden: you do not own this resource" });
    return false;
  }

  return true;
}
