import { Router, Request, Response } from "express";
import multer from "multer";
import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";
import { logger } from "../lib/logger.js";
import { getContext } from "../lib/requestContext.js";

export const extractRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ── Azure Document Intelligence (primary) ─────────────────────────────────────
// Uses the prebuilt-read model — handles Korean + English, complex layouts, scanned PDFs
function createDocIntelligenceClient(): DocumentAnalysisClient | null {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) return null;
  return new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
}

async function extractWithDocIntelligence(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const client = createDocIntelligenceClient();
  if (!client) throw new Error("Azure Document Intelligence not configured");

  // Pass buffer as a ReadableStream — SDK auto-detects PDF format from content
  const { Readable } = await import("stream");
  const stream = Readable.from(buffer);
  const poller = await client.beginAnalyzeDocument("prebuilt-read", stream);
  const result = await poller.pollUntilDone();

  const text = result.content ?? "";
  const pageCount = result.pages?.length ?? 1;
  return { text: text.trim(), pageCount };
}

// ── unpdf (ESM-native pdfjs-dist wrapper, fallback) ───────────────────────────
// Uses pdf-parse v2 (ESM-native, wraps pdfjs-dist) — no createRequire needed
async function extractWithPdfParse(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return {
    text: result.text.trim(),
    pageCount: result.pages.length,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
extractRouter.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const { correlationId } = getContext();

    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const isPdf = mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf");

    logger.info("File extraction request", { correlationId, filename: originalname, mimetype, size });

    try {
      let text = "";
      let pageCount: number | undefined;
      let method = "text";

      if (isPdf) {
        const hasDocIntelligence = !!(
          process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
          process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
        );

        if (hasDocIntelligence) {
          method = "azure-document-intelligence";
          logger.info("Using Azure Document Intelligence", { correlationId });
          ({ text, pageCount } = await extractWithDocIntelligence(buffer));
        } else {
          method = "pdf-parse";
          logger.info("Azure Document Intelligence not configured, using pdf-parse fallback", { correlationId });
          ({ text, pageCount } = await extractWithPdfParse(buffer));
        }
      } else {
        text = buffer.toString("utf-8").trim();
      }

      if (!text) {
        res.status(422).json({ error: "Could not extract any text from this file" });
        return;
      }

      logger.info("File extraction complete", {
        correlationId,
        filename: originalname,
        method,
        chars: text.length,
        pageCount,
      });

      res.json({ text, filename: originalname, pageCount, chars: text.length, method });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error("File extraction failed", { correlationId, filename: originalname, error: errMsg });
      res.status(500).json({ error: "Failed to extract text from file", details: errMsg });
    }
  }
);


