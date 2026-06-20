import { Router } from "express";
import { db } from "../db.js";
import { cosmosHealthCheck } from "../lib/cosmos.js";

export const healthRouter = Router();

type ServiceState = "ok" | "error" | "unconfigured";

function isConfigured(...values: Array<string | undefined>): boolean {
  return values.every((value) => Boolean(value?.trim()));
}

function optionalServiceStatus(configured: boolean): ServiceState {
  return configured ? "ok" : "unconfigured";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

healthRouter.get("/", async (_req, res) => {
  const timestamp = new Date().toISOString();
  const backend = process.env.STORAGE_BACKEND === "cosmos" ? "cosmos" : "sqlite";
  const version = process.env.npm_package_version ?? "0.0.1";
  const whisperConfigured = isConfigured(
    process.env.AZURE_OPENAI_ENDPOINT,
    process.env.AZURE_OPENAI_API_KEY
  );
  const documentIntelligenceConfigured = isConfigured(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
  );
  const blobStorageConfigured = isConfigured(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const notificationsConfigured = isConfigured(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);
  const checks = {
    db: withTimeout(
      Promise.resolve().then(async () => {
        if (backend === "cosmos") {
          await cosmosHealthCheck();
          return { status: "ok", backend } as const;
        }

        db.prepare("SELECT 1").get();
        return { status: "ok", backend } as const;
      }),
      500
    ),
    openai: Promise.resolve({
      status: process.env.AZURE_OPENAI_ENDPOINT?.trim() ? "ok" : "unconfigured",
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
    } as const),
    whisper: Promise.resolve({
      status: optionalServiceStatus(whisperConfigured),
      transcription: whisperConfigured,
    } as const),
    documentIntelligence: Promise.resolve({
      status: optionalServiceStatus(documentIntelligenceConfigured),
      extraction: documentIntelligenceConfigured,
    } as const),
    blobStorage: Promise.resolve({
      status: optionalServiceStatus(blobStorageConfigured),
      uploads: blobStorageConfigured,
    } as const),
    notifications: Promise.resolve({
      status: optionalServiceStatus(notificationsConfigured),
      email: notificationsConfigured,
    } as const),
  };
  const settled = await Promise.allSettled(Object.values(checks));

  const [
    dbResult,
    openaiResult,
    whisperResult,
    documentIntelligenceResult,
    blobStorageResult,
    notificationsResult,
  ] = settled;

  const services = {
    db:
      dbResult.status === "fulfilled"
        ? dbResult.value
        : ({ status: "error", backend } as const),
    openai:
      openaiResult.status === "fulfilled"
        ? openaiResult.value
        : ({ status: "error", model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o" } as const),
    whisper:
      whisperResult.status === "fulfilled"
        ? whisperResult.value
        : ({ status: "error" } as { status: Exclude<ServiceState, "unconfigured"> }),
    documentIntelligence:
      documentIntelligenceResult.status === "fulfilled"
        ? documentIntelligenceResult.value
        : ({ status: "error" } as { status: Exclude<ServiceState, "unconfigured"> }),
    blobStorage:
      blobStorageResult.status === "fulfilled"
        ? blobStorageResult.value
        : ({ status: "error" } as { status: Exclude<ServiceState, "unconfigured"> }),
    notifications:
      notificationsResult.status === "fulfilled"
        ? notificationsResult.value
        : ({ status: "error" } as { status: Exclude<ServiceState, "unconfigured"> }),
  };

  const status =
    services.db.status === "error" ||
    services.openai.status === "error" ||
    services.whisper.status === "error" ||
    services.documentIntelligence.status === "error" ||
    services.blobStorage.status === "error" ||
    services.notifications.status === "error"
      ? "degraded"
      : "ok";

  res.json({
    status,
    timestamp,
    version,
    services,
  });
});
