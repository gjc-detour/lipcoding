import { randomUUID } from "crypto";
import { Router, Request, Response } from "express";
import multer from "multer";
import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";
import { uploadBlob } from "../lib/blobStorage.js";
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

// ── Garbled text detection ─────────────────────────────────────────────────────
// pdf-parse/pdfjs cannot decode many Korean/CJK fonts without proper ToUnicode tables.
// Heuristic: if >30% of non-space chars are outside printable ASCII + Hangul Unicode range,
// the extraction is likely garbled and we should escalate to Document Intelligence.
function isGarbled(text: string): boolean {
  if (text.length < 10) return false;
  const chars = text.replace(/\s/g, "");
  if (chars.length === 0) return false;
  let badCount = 0;
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    const isPrintableAscii = cp >= 0x20 && cp <= 0x7e;
    const isHangul = cp >= 0xac00 && cp <= 0xd7a3;       // Hangul syllables
    const isHangulJamo = cp >= 0x1100 && cp <= 0x11ff;   // Jamo
    const isHangulCompat = cp >= 0x3130 && cp <= 0x318f; // Compat Jamo
    const isCJK = cp >= 0x4e00 && cp <= 0x9fff;          // CJK unified ideographs
    const isLatin = cp >= 0x00a0 && cp <= 0x024f;        // Extended Latin
    const isPunct = cp >= 0x2000 && cp <= 0x206f;        // General punctuation
    if (!isPrintableAscii && !isHangul && !isHangulJamo && !isHangulCompat && !isCJK && !isLatin && !isPunct) {
      badCount++;
    }
  }
  return badCount / chars.length > 0.3;
}

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

          // If pdf-parse returns garbled text (e.g. Korean fonts without ToUnicode),
          // try Document Intelligence if it gets configured later — for now warn the user
          if (isGarbled(text)) {
            logger.warn("PDF text appears garbled (likely Korean/CJK font encoding issue)", {
              correlationId, filename: originalname, preview: text.slice(0, 80),
            });
            text = `[⚠️ PDF font encoding issue — Korean/CJK text could not be decoded by the local parser. To fix this, configure Azure Document Intelligence (AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT + KEY) which supports Korean OCR natively.]\n\n${text}`;
            method = "pdf-parse-garbled";
          }
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

      let fileUrl: string | undefined;
      if (process.env.AZURE_STORAGE_CONNECTION_STRING && req.userId) {
        try {
          const itemId = randomUUID();
          fileUrl = await uploadBlob(req.userId, itemId, originalname, buffer, mimetype);
          logger.info("File uploaded to Blob", { correlationId, filename: originalname, fileUrl });
        } catch (err) {
          logger.warn("Blob upload failed (non-fatal)", { correlationId, error: String(err) });
        }
      }

      res.json({ text, filename: originalname, pageCount, chars: text.length, method, fileUrl });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error("File extraction failed", { correlationId, filename: originalname, error: errMsg });
      res.status(500).json({ error: "Failed to extract text from file", details: errMsg });
    }
  }
);

