import rateLimit from "express-rate-limit";

export const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment." },
  skip: () => process.env.NODE_ENV === "test",
});
