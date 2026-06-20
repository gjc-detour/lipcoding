import { randomUUID } from "crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { AzureOpenAI, toFile } from "openai";
import { uploadBlob } from "../lib/blobStorage.js";
import { logger } from "../lib/logger.js";
import { getContext } from "../lib/requestContext.js";
import { aiLimiter } from "../middleware/aiRateLimit.js";

export const transcribeRouter = Router();
transcribeRouter.use(aiLimiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — Whisper's hard limit
});

function createWhisperClient(): AzureOpenAI {
  // Whisper uses its own dedicated endpoint (eastus2 AI Services)
  // Falls back to main endpoint if dedicated one not set
  const endpoint = process.env.AZURE_OPENAI_WHISPER_ENDPOINT ?? process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_WHISPER_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper";

  if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set");
  if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not set");

  return new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-02-01", deployment });
}

function isAllowedAudioMimeType(mimetype: string): boolean {
  return mimetype.startsWith("audio/") || mimetype === "video/webm";
}

transcribeRouter.post(
  "/",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    const { correlationId } = getContext();
    const start = Date.now();

    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    if (!isAllowedAudioMimeType(req.file.mimetype)) {
      res.status(415).json({ error: "Unsupported audio format. Please upload audio/* or video/webm." });
      return;
    }

    if (!process.env.AZURE_OPENAI_ENDPOINT?.trim()) {
      res
        .status(503)
        .json({ error: "Voice transcription not available — AZURE_OPENAI_ENDPOINT not configured" });
      return;
    }

    if (!process.env.AZURE_OPENAI_API_KEY?.trim()) {
      res
        .status(503)
        .json({ error: "Voice transcription not available — AZURE_OPENAI_API_KEY not configured" });
      return;
    }

    const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper";

    logger.info("Transcription request", {
      correlationId,
      userId: req.userId,
      size: req.file.size,
      mimetype: req.file.mimetype,
      deployment,
    });

    try {
      const client = createWhisperClient();

      // Use toFile() to pass the buffer directly — no temp file needed
      // The filename extension (.webm) tells Whisper the audio format
      const filename = req.file.originalname?.includes(".")
        ? req.file.originalname
        : "recording.webm";

      const audioFile = await toFile(req.file.buffer, filename, {
        type: req.file.mimetype,
      });

      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: deployment, // deployment name routes the Azure REST URL
        response_format: "text",
      });

      const durationMs = Date.now() - start;
      logger.info("Transcription complete", {
        correlationId,
        userId: req.userId,
        durationMs,
        chars: typeof transcription === "string" ? transcription.length : 0,
        language: "auto-detect",
      });

      let fileUrl: string | undefined;
      if (process.env.AZURE_STORAGE_CONNECTION_STRING && req.userId) {
        try {
          const itemId = randomUUID();
          fileUrl = await uploadBlob(
            req.userId,
            itemId,
            filename,
            req.file.buffer,
            req.file.mimetype
          );
          logger.info("File uploaded to Blob", { correlationId, filename, fileUrl });
        } catch (err) {
          logger.warn("Blob upload failed (non-fatal)", { correlationId, error: String(err) });
        }
      }

      res.json({ transcript: transcription, fileUrl });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error("Transcription failed", { correlationId, error: errMsg });
      res.status(500).json({ error: "Transcription failed", details: errMsg });
    }
  }
);

transcribeRouter.use(
  (err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (
      err instanceof multer.MulterError
        ? err.code === "LIMIT_FILE_SIZE"
        : err.message === "LIMIT_FILE_SIZE"
    ) {
      res.status(413).json({ error: "Audio file too large. Maximum 25 MB." });
      return;
    }

    next(err);
  }
);
