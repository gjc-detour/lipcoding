# LipCoding — Infrastructure & Pipeline Documentation

> **For agents**: This document is the source of truth for infrastructure configuration.
> When you add, remove, or change any Azure service, environment variable, Bicep module,
> or service endpoint — update this file immediately as part of the same commit.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Client (Browser)                                                    │
│  React 18 + Vite + Tailwind CSS                                     │
│  EventSource → /api/notifications (SSE)                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────────┐
│  Azure Container Apps — ca-web-3qujsv4wy3voi                        │
│  Korea Central · rg-dev                                             │
│  Image: cr{token}.azurecr.io/web:latest (built via ACR remoteBuild) │
│                                                                      │
│  Express + Node.js 24 + TypeScript                                  │
│  ├── /api/chat          → AI agent (gpt-4o, tool calling)           │
│  ├── /api/copilot       → Copilot Chat extension (SSE)              │
│  ├── /api/transcribe    → Voice → Azure Whisper                     │
│  ├── /api/extract       → PDF → Azure Document Intelligence         │
│  ├── /api/inbox         → CRUD (Cosmos DB or SQLite)                │
│  ├── /api/events        → Scheduled events CRUD                     │
│  ├── /api/notifications → SSE stream for real-time toasts           │
│  └── /api/health        → Health + DB status check                  │
│                                                                      │
│  Background: node-cron (every 1 min)                                │
│  └── Check due events → email (ACS) + SSE push → mark notified     │
└───┬──────────┬──────────┬──────────┬──────────┬─────────────────────┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
  Azure      Azure      Azure      Azure      Azure
  OpenAI    Cosmos DB   Blob      Doc Intel  Comm Svc
 (GPT+STT)  (NoSQL)   Storage   (Form Rec)  (Email)
```

---

## Azure Resources

### Resource Group
| Property | Value |
|---|---|
| Name | `rg-dev` |
| Region | `koreacentral` |
| Managed by | `azd` — `azd down` to delete all |

### Azure Container Apps
| Property | Value |
|---|---|
| Resource name | `ca-web-{token}` |
| Live URL | `https://ca-web-3qujsv4wy3voi.gentlebeach-87f2d7cb.koreacentral.azurecontainerapps.io` |
| Port | `3001` |
| Min replicas | 0 (scales to zero) |
| Image registry | Azure Container Registry |
| Build | Remote build on ACR (`remoteBuild: true` in `azure.yaml`) |

### Azure Container Registry
| Property | Value |
|---|---|
| Resource name | `cr{token}` |
| Purpose | Stores Docker images |
| Bicep module | `infra/modules/container-registry.bicep` |

### Azure Container Apps Environment
| Property | Value |
|---|---|
| Resource name | `cae-{token}` |
| Linked to | Log Analytics workspace |
| Bicep module | `infra/modules/container-apps-env.bicep` |

### Azure OpenAI (Azure AI Foundry)
| Property | Value |
|---|---|
| Resource name | `cog-{token}` |
| Endpoint | `https://def6488-5507-resource.openai.azure.com/openai/v1` |
| Bicep module | `infra/modules/openai.bicep` |

**Model deployments:**
| Deployment Name | Model | Purpose |
|---|---|---|
| `gpt-4o` | GPT-4o (2024-11-20) | Chat agent, tool calling — `GlobalStandard` 10 capacity |
| `whisper` | whisper-1 | Voice transcription — `Standard` 1 capacity |

### Azure Cosmos DB (NoSQL)
| Property | Value |
|---|---|
| Resource name | `cosmos{token}` |
| Database | `lipcoding` |
| SKU | Serverless + Free Tier enabled |
| Consistency | Session |
| Bicep module | `infra/modules/storage.bicep` |

**Containers:**
| Container | Partition Key | Purpose |
|---|---|---|
| `inbox_items` | `/userId` | Notes, tasks, events, files saved by agent |
| `scheduled_events` | `/userId` | Reminders + deadlines created by agent |

**Access:** Managed Identity role `Cosmos DB Built-in Data Contributor` assigned to Container App.

### Azure Blob Storage
| Property | Value |
|---|---|
| Resource name | `st{token}` |
| SKU | `Standard_LRS` |
| Container | `lipcoding-uploads` |
| Public access | Disabled |
| Blob path format | `{userId}/{itemId}/{filename}` |
| Bicep module | `infra/modules/storage.bicep` |

### Azure Document Intelligence (Form Recognizer)
| Property | Value |
|---|---|
| SDK | `@azure/ai-form-recognizer` v5.1.0 |
| Model | `prebuilt-read` |
| Purpose | PDF text extraction (primary, falls back to pdf-parse v2) |
| Bicep | Not yet provisioned — manual setup |

### Azure Communication Services (Email)
| Property | Value |
|---|---|
| SDK | `@azure/communication-email` |
| Purpose | Email alerts when scheduled events are due |
| Bicep | Not yet provisioned — manual setup |

---

## Environment Variables

### Required for all environments
| Variable | Description | Example |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | Azure AI Foundry endpoint (with `/openai/v1`) | `https://resource.openai.azure.com/openai/v1` |
| `AZURE_OPENAI_API_KEY` | API key | — |
| `AZURE_OPENAI_DEPLOYMENT` | Chat model deployment name | `gpt-4o` |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | Whisper deployment name | `whisper` |
| `PORT` | Server port | `3001` |
| `ALLOWED_USERS` | Comma-separated `userId:displayName:token` entries | — |

### Storage
| Variable | Description | Default |
|---|---|---|
| `STORAGE_BACKEND` | `sqlite` or `cosmos` | `sqlite` |
| `COSMOS_CONNECTION_STRING` | Full Cosmos DB connection string | — |
| `COSMOS_ENDPOINT` | Cosmos DB endpoint (used with managed identity) | — |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage connection string | — |

### Optional Azure services
| Variable | Description | Fallback |
|---|---|---|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Form Recognizer endpoint | Uses `pdf-parse` v2 |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Form Recognizer key | Uses `pdf-parse` v2 |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | ACS connection string | Email skipped |
| `NOTIFICATION_FROM_EMAIL` | Sender email address | — |
| `NOTIFICATION_TO_EMAIL` | Recipient email address | — |

### Observability
| Variable | Description | Default |
|---|---|---|
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` |
| `NODE_ENV` | `development` or `production` | `development` |

---

## Service Dependencies Map

```
Express Server
├── needs: AZURE_OPENAI_ENDPOINT + API_KEY + DEPLOYMENT
├── needs: AZURE_OPENAI_WHISPER_DEPLOYMENT (for /api/transcribe)
├── optional: AZURE_DOCUMENT_INTELLIGENCE_* (for /api/extract)
├── optional: AZURE_COMMUNICATION_* (for email notifications)
├── if STORAGE_BACKEND=cosmos: needs COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT
└── if STORAGE_BACKEND=sqlite: uses data/lipcoding.db (auto-created)

node-cron (runs inside Express)
├── reads: scheduled_events (via storage service)
├── writes: notified=true (via storage service)
├── pushes: SSE to connected browsers
└── sends: email via ACS (if configured)
```

---

## IaC — Bicep Modules

```
infra/
├── main.bicep                     ← entry point (targetScope = subscription)
├── main.parameters.json           ← azd parameter defaults
├── abbreviations.json             ← resource name prefixes
└── modules/
    ├── container-app.bicep        ← Container App definition + env vars + secrets
    ├── container-apps-env.bicep   ← Container Apps Environment + Log Analytics
    ├── container-registry.bicep   ← Azure Container Registry
    ├── openai.bicep               ← Azure OpenAI + GPT-4o + Whisper deployments
    └── storage.bicep              ← Cosmos DB + Blob Storage
```

**To provision new infrastructure:**
```bash
azd provision
```

**To deploy app only (no infra changes):**
```bash
azd deploy
```

**To update an environment variable in Azure:**
```bash
azd env set VARIABLE_NAME value
azd deploy
```

---

## Deployment Pipeline

### Local Development
```bash
npm run dev          # Starts Express (3001) + Vite (5173) concurrently
# Vite proxies /api/* → localhost:3001
# STORAGE_BACKEND defaults to sqlite (data/lipcoding.db auto-created)
```

### CI — GitHub Actions (`.github/workflows/ci.yml`)
- Runs on every push to `main`
- Steps: install → build → test (Vitest)
- Does NOT deploy (deployment is manual via `azd`)

### Production Deployment
```bash
azd deploy           # Builds Docker image on ACR (remoteBuild: true), deploys to Container App
```

Docker image is built **on Azure Container Registry** — no local Docker required.

---

## Storage Backend Switch

The app supports two storage backends via `STORAGE_BACKEND` env var:

| Value | Backend | When to use |
|---|---|---|
| `sqlite` (default) | `better-sqlite3` local file at `data/lipcoding.db` | Local dev, CI, testing |
| `cosmos` | Azure Cosmos DB NoSQL | Production on Azure |

**How it works in code:** `server/services/storage.ts` checks `STORAGE_BACKEND` at runtime and routes all CRUD calls to either the SQLite implementation or `server/lib/cosmos.ts`.

---

## Notification Flow

```
1. User creates a message with a deadline
2. Agent calls schedule_event tool → saved to scheduled_events (Cosmos or SQLite)
3. node-cron fires every minute
4. Queries: due_at <= now AND notified = false
5a. If browser connected: SSE push → /api/notifications → toast in UI
5b. If ACS configured: email sent to NOTIFICATION_TO_EMAIL
6. Event marked notified = true
```

---

## Authentication

LipCoding supports a simple multi-user demo mode based on **pre-shared access tokens**.

- Configure `ALLOWED_USERS` as comma-separated `userId:displayName:token` entries.
- `POST /api/auth/login` accepts a token and sets the `lip_session` httpOnly cookie for 7 days.
- All app API routes except `/api/auth/*` and `/api/copilot` require a valid token cookie or token header.
- When `ALLOWED_USERS` is empty or unset, the app stays in backwards-compatible single-user mode with `userId="default"`.
- Tokens are secrets: never log them, never embed them in client code, and rotate them by updating `ALLOWED_USERS`.

Example:

```env
ALLOWED_USERS=gjc:GJC:abc123token,user2:User Two:def456token
```

Generate tokens with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Adding a New Azure Service

When adding a new Azure service, update ALL of the following:

1. **`infra/modules/`** — add or update the relevant Bicep module
2. **`infra/main.bicep`** — add module reference + wire outputs to Container App env vars
3. **`.env.example`** — add new env vars with descriptions
4. **`INFRASTRUCTURE.md`** (this file) — add service to the Azure Resources table + env vars table
5. **`AGENTS.md`** — update tech stack if a new layer is added
6. **`PLAN.md`** — update the Current Status section
