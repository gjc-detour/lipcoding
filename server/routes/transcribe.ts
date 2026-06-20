import { Router, Request, Response } from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { logger } from "../lib/logger.js";
import { getContext } from "../lib/requestContext.js";

export const transcribeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — Whisper's hard limit
});

function createWhisperClient(): OpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set");
  if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is not set");

  // Use plain OpenAI client with baseURL — works correctly with Azure AI Foundry
  // endpoints (e.g. .../openai/v1). AzureOpenAI constructs wrong paths for Foundry URLs.
  return new OpenAI({ baseURL: endpoint, apiKey });
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

