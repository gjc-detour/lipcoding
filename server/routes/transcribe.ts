import { Router, Request, Response } from "express";
import multer from "multer";
import { AzureOpenAI, toFile } from "openai";
import { logger } from "../lib/logger.js";
import { getContext } from "../lib/requestContext.js";

export const transcribeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — Whisper's hard limit
});

function createWhisperClient(): AzureOpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper";

  if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set");
  if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not set");

  // AzureOpenAI handles Azure-specific routing:
  // - appends /openai/deployments/{deployment}/audio/transcriptions
  // - sends api-key header (not Authorization: Bearer)
  // - adds ?api-version= query param
  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion: "2024-02-01",
    deployment,
  });
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

    const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper";

    logger.info("Transcription request", {
      correlationId,
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
        durationMs,
        chars: typeof transcription === "string" ? transcription.length : 0,
      });

      res.json({ transcript: transcription });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error("Transcription failed", { correlationId, error: errMsg });
      res.status(500).json({ error: "Transcription failed", details: errMsg });
    }
  }
);

