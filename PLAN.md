# LipCoding — AI Personal Assistant · Project Plan

## Concept
A personal productivity assistant that acts as a smart inbox:
users drop anything (text, voice, PDF) → the Copilot agent processes it → summarizes, extracts tasks/events, stores them, schedules reminders, and makes everything searchable/referenceable later.

---

## Current Status (as of 2026-06-20)

### ✅ Phase 1 — Storage Layer — DONE
- SQLite database with `inbox_items` + `scheduled_events` tables
- Full CRUD REST API: `GET/POST/DELETE /api/inbox`, `GET/POST /api/events`
- Cascade delete (FK constraint fix), Zod validation on all inputs

### ✅ Phase 2 — Copilot Agent Tool Calling — DONE
- **`/api/copilot`** — Copilot Chat extension via `@copilot-extensions/preview-sdk` v5
  - `verifyAndParseRequest`, SSE streaming, confirmation events, user identity from `_session`
- **`/api/chat`** — Web UI path via `@github/copilot-sdk` BYOK (Azure AI Foundry) with graceful fallback to direct Azure OpenAI
- 4 tools: `save_item`, `schedule_event`, `search_items`, `translate_text`
- Multi-turn conversation context, up to 3 tool-call rounds

### ✅ Phase 3 — Multi-modal Input — DONE
- **Text** — direct textarea input → agent
- **Voice** — `MediaRecorder` → `POST /api/transcribe` → Azure Whisper (plain `OpenAI` client, Foundry-compatible)
- **PDF** — `POST /api/extract` → Azure Document Intelligence (primary) or `pdf-parse` v2 ESM (fallback)
- **Text files** — `.txt`, `.md` read directly in browser

### ✅ Phase 4 — Frontend UI — DONE
- Inbox page: AI chat panel + captured items list, side-by-side
- Schedule page: events sorted by due date with countdown
- CaptureBar: bilingual placeholder (한국어/English), voice button, file upload
- Sidebar navigation with item count badge
- 16 Playwright E2E tests passing

### ✅ Phase 5 — Azure AI & Observability — DONE
- Model: switched from `Kimi-K2.6` → **`gpt-4o`** (reliable tool calling)
- Whisper: fixed to use plain `OpenAI` client (Foundry endpoint compatibility)
- JSON structured logging, correlation IDs, request timing on all routes
- `infra/modules/openai.bicep` — provisions Azure OpenAI + Whisper + GPT deployments
- `infra/abbreviations.json` — fixed `cognitiveServicesAccounts` key
- Deployed to Azure Container Apps: `koreacentral`

### ✅ Phase 6 — Bilingual (Korean/English) — DONE
- System prompt handles Korean date formats (`금요일`, `다음 주 월요일`)
- Responds in the language of the input
- Whisper auto-detects language
- Demo files: `demo/회의록_2026-06-20.txt`, `demo/sample-korean-brief.pdf`

---

## ⏳ Remaining Phases

### Phase 7 — Persistent Memory & Context-Aware Agent — TODO 🔴 HIGH
> Agent makes decisions based on existing history — avoids duplicate saves, updates existing items

- **Context injection**: Before each agent call, load recent 10 inbox items + upcoming scheduled events and inject as context into the system prompt
- **New tool `update_item`**: Modify an existing item's summary, tags, or due_date (agent calls this instead of saving a duplicate)
- **New tool `close_event`**: Mark a scheduled event as cancelled/done (user says "cancel my Friday meeting")
- **New tool `complete_item`**: Mark a task item as completed
- **Duplicate detection**: Agent checks context before calling `save_item` — if similar item exists, calls `update_item` instead
- **REST endpoints**: `PATCH /api/inbox/:id`, `DELETE /api/events/:id`

### Phase 8 — Enhanced Search — TODO 🟡
> Search should surface relevant history to inform agent and UI

- Full-text search across `raw` + `summary` + `tags` fields (already partial)
- Search by type filter (`?type=task`)
- Search by date range (`?from=&to=`)
- **Agent-side search**: `search_items` tool already exists — make agent proactively search before saving to avoid duplicates
- Frontend search bar on `/search` route (already scaffolded in `InboxPage`)

### Phase 9 — Azure Cloud Storage — TODO 🟢
> Replaces SQLite with proper Azure services — big boost to Azure score

- **Azure Cosmos DB** — `inbox_items` + `scheduled_events`, partition by `userId`
- **Azure Blob Storage** — raw uploaded files (PDFs, audio recordings)
- `STORAGE_BACKEND=cosmos|sqlite` env switch in `server/services/storage.ts`
- Bicep: Cosmos DB account + containers + Blob storage account
- Researching: `@azure/cosmos`, `@azure/storage-blob`

### Phase 8 — Scheduled Notifications (Serverless) — TODO 🟡
> Cron job runs as a SEPARATE Azure Function, not inside the web server

- **Azure Functions** (timer trigger, every 1 min) — separate from Express web server
- Reads `scheduled_events` from shared Cosmos DB
- Sends notifications via:
  - **In-app**: Azure Web PubSub → browser SSE/WebSocket
  - **Email**: Azure Communication Services (ACS)
- Marks events as `notified = true` after sending
- Deployed via same `azd` pipeline from `functions/` folder
- Researching: `@azure/functions`, `@azure/web-pubsub`, `@azure/communication-email`

### Phase 9 — E2E Tests (full suite) — TODO 🟡
- Playwright: PDF upload → extraction → agent → inbox item appears
- Playwright: voice recording simulation → transcript → save
- Supertest: full chat → tool call → item saved flow

---

## Judging Criteria Mapping

| Criterion | Weight | Status | How We Win |
|---|---|---|---|
| Copilot SDK | 25% | ✅ | Both SDKs: `preview-sdk` (extension) + `@github/copilot-sdk` BYOK (agent) |
| Productivity Impact | 18% | ✅ | Text+voice+PDF inbox → AI saves, schedules, searches |
| Azure AI & Cloud | 18% | 🔄 | GPT-4o + Whisper via Foundry; adding Cosmos DB + Functions |
| Functionality | 16% | ✅ | Full E2E deployed; 16 Playwright tests passing |
| UX | 12% | ✅ | Bilingual, streaming, voice, file upload |
| Responsible AI | 6% | ✅ | Confirmation before scheduling, source attribution |
| Innovation | 5% | ✅ | Multi-modal + Korean/English + serverless notifications |

---

## Live Deployment
- **URL**: https://ca-web-3qujsv4wy3voi.gentlebeach-87f2d7cb.koreacentral.azurecontainerapps.io
- **Region**: Korea Central
- **Stack**: Azure Container Apps + Azure Container Registry + Log Analytics
- **Model**: gpt-4o via Azure AI Foundry
- **Whisper**: available at same endpoint

---

## Architecture

```
User (Korean/English)
 │  text / voice (Whisper) / PDF (Document Intelligence → pdf-parse)
 ▼
Frontend — React 18 + Vite + Tailwind (port 5173)
 │  /api/chat       → web UI agent (gpt-4o, tool calling)
 │  /api/transcribe → voice → Whisper STT
 │  /api/extract    → PDF → Azure Doc Intelligence / pdf-parse
 │  /api/inbox      → CRUD for saved items
 │  /api/events     → scheduled events
 │  /api/copilot    → GitHub Copilot Chat extension (SSE)
 ▼
Express Backend — Node.js 24 + TypeScript (port 3001)
 │
 ├── @copilot-extensions/preview-sdk  (Copilot Chat extension)
 ├── @github/copilot-sdk BYOK         (web UI agent, gpt-4o)
 ├── openai (Azure Foundry direct)    (fallback + Whisper)
 ├── @azure/ai-form-recognizer        (Document Intelligence)
 │
 ▼
Storage: SQLite (dev) → Azure Cosmos DB (Phase 7)
Files:   local         → Azure Blob Storage (Phase 7)
Cron:    in-server     → Azure Functions timer (Phase 8)
Notify:                → Azure Web PubSub + ACS Email (Phase 8)
```

---

## Extension Phases (researching now)

### Extension A — Azure Cosmos DB + Blob Storage
- `@azure/cosmos` for document storage (per-user partitioning)
- `@azure/storage-blob` for raw file storage
- Environment switch: `STORAGE_BACKEND=cosmos|sqlite`

### Extension B — Azure Functions Notifications
- Separate `functions/` folder in repo
- Timer trigger: check due events every minute
- Notification via Azure Web PubSub (in-app) + ACS (email)
- Shared Cosmos DB connection between web app and Function


## Concept
A personal productivity assistant that acts as a smart inbox:
users drop anything (text, voice, PDF) → the Copilot agent processes it → summarizes, extracts tasks/events, stores them, schedules reminders, and makes everything searchable/referenceable later.

---

## Current Status (as of 2026-06-20)

### ✅ Fully Done
| Phase | What was built |
|---|---|
| **Storage layer** | SQLite, `inbox_items` + `scheduled_events`, full CRUD REST at `/api/inbox` + `/api/events`. FK cascade delete fixed. |
| **Copilot extension route** | `/api/copilot` uses `@copilot-extensions/preview-sdk` v5 — verifyAndParseRequest, tool calling, SSE streaming, confirmation events, user identity from `_session` message |
| **Agent tool calling** | 4 tools: `save_item`, `schedule_event`, `search_items`, `translate_text`. Both SDK paths implemented. |
| **@github/copilot-sdk BYOK** | `processWithCopilotSDK()` uses `@github/copilot-sdk` with Azure AI Foundry BYOK (type: openai, wireApi: completions). `defineTool` handlers auto-dispatch. |
| **Azure direct fallback** | `processWithAzureFallback()` uses OpenAI client with full tool-calling loop — reliable fallback when Copilot CLI unavailable |
| **Frontend UI** | Inbox page, Schedule page, CaptureBar (text/voice/file), Sidebar, chat bubbles, streaming, Vite proxy |
| **Observability** | JSON structured logging, correlation IDs, request timing, DB health check at `/api/health` |
| **Voice → Whisper** | `MediaRecorder` → `POST /api/transcribe` → `AzureOpenAI` Whisper (fixed from plain OpenAI client). No temp files — uses `toFile()`. |
| **PDF extraction** | `POST /api/extract` uses `pdf-parse` (CJS compat via `createRequire`). Supports PDF + plain text files. |
| **Korean/English bilingual** | System prompt handles both languages. Whisper auto-detects. Bilingual placeholder in CaptureBar. |
| **Node.js 24 upgrade** | Upgraded from Node 18 → 24. Rebuilt native deps. Updated Dockerfile to `node:24-alpine`. |
| **Playwright E2E** | 16 UI tests (all passing) + full API test suite in `tests/e2e/` |
| **Whisper Bicep** | `infra/modules/openai.bicep` provisions OpenAI account + Whisper (Standard) + chat model deployments |
| **Demo files** | `demo/` folder: Korean + English `.txt` files, Korean + English `.pdf` files, PDF generator script |

### 🔄 In Progress
- **@github/copilot-sdk CLI resolution** — `copilot.exe` is bundled in `node_modules/@github/copilot-win32-x64/` but SDK is not finding it. Adding graceful fallback to Azure direct path.

### ⏳ Remaining
| Priority | Task | Notes |
|---|---|---|
| 🔴 | **Fix Copilot SDK CLI resolution** | Try bundled binary path; add env flag `COPILOT_SDK_ENABLED`; fallback to Azure direct |
| 🟡 | **Cron notifications + SSE push** | `node-cron` checking `scheduled_events` + `GET /api/notifications` SSE endpoint + UI toasts |
| 🟡 | **E2E tests — PDF upload flow** | Playwright test for file upload → extraction → agent → inbox |
| 🟢 | **Azure Blob + Cosmos DB** | Extension A — swap SQLite for cloud storage (big Azure score boost) |

---

## Judging Criteria Mapping

| Criterion | Weight | How We Win |
|---|---|---|
| Copilot SDK | 25% | Both SDKs used correctly: extension protocol (`preview-sdk`) + agent runtime (`@github/copilot-sdk` BYOK) |
| Productivity Impact | 18% | Inbox-zero for devs/knowledge workers — text, voice, PDF → AI organizes automatically |
| Azure AI & Cloud | 18% | Azure OpenAI (GPT + Whisper) via Foundry; Bicep provisions all resources; BYOK wired |
| Functionality | 16% | Full e2e: capture → process → store → notify → retrieve; 16 Playwright tests green |
| UX | 12% | Single-page inbox, streaming AI responses, voice button, file drag |
| Responsible AI | 6% | Confirmation before scheduling, source attribution in summaries |
| Innovation | 5% | Multi-modal input + unified smart inbox concept |

---

## Architecture

```
User
 │  text / voice (Whisper) / PDF (pdf-parse)
 ▼
Frontend (React + Vite)
 │  POST /api/chat        → web UI agent path
 │  POST /api/transcribe  → voice → Whisper STT
 │  POST /api/extract     → file → text extraction
 │  GET  /api/inbox       → list/search saved items
 │  GET  /api/events      → scheduled events
 ▼
Express Backend
 │  /api/copilot  → @copilot-extensions/preview-sdk (Copilot Chat extension, SSE)
 │  /api/chat     → @github/copilot-sdk BYOK (Azure AI Foundry)
 ▼
Productivity Agent — 4 tools
 │  save_item · schedule_event · search_items · translate_text
 ▼
SQLite (dev) → Azure Cosmos DB (prod, Extension A)
Azure Blob Storage for raw files (Extension A)
```

---

## Data Model

```typescript
interface InboxItem {
  id: string;
  user_id: string;
  type: 'note' | 'task' | 'event' | 'file';
  raw: string;       // original input
  summary: string;   // AI-generated
  tags: string[];
  due_date?: string; // ISO8601
  scheduled: boolean;
  created_at: string;
}
```

---

## Extension Phases (post-MVP)

### Extension A — Azure Cloud Storage
- **Azure Blob Storage** — store raw uploaded files via `@azure/storage-blob`
- **Azure Cosmos DB** — replace SQLite with per-user partitioned NoSQL
- `STORAGE_BACKEND=cosmos|sqlite` env switch in `storage.ts`
- Provision in `infra/modules/openai.bicep` (already has OpenAI; add Cosmos + Blob)

### Extension B — Scheduled Notifications (Cron + SSE)
- `node-cron` job every minute: query `scheduled_events` where `due_at <= now AND notified = 0`
- `GET /api/notifications` persistent SSE stream
- In-app toast notifications when events are due
- Future: Azure Web PubSub for multi-device delivery

### Extension C — Multi-user Auth
- `X-GitHub-Token` → GitHub API for user identity (Copilot extension path already does this)
- GitHub OAuth for standalone web UI
- Storage already scoped to `user_id`


## Concept
A personal productivity assistant that acts as a smart inbox:  
users drop anything (text, voice, PDF) → the Copilot agent processes it → summarizes, extracts tasks/events, stores them, schedules reminders, and makes everything searchable/referenceable later.

---

## Current Status (as of 2026-06-20)

### ✅ Fully Done
| Phase | What was built |
|---|---|
| **Storage layer** | SQLite, `inbox_items` + `scheduled_events`, full CRUD REST at `/api/inbox` + `/api/events`. FK cascade delete fixed. |
| **Copilot extension route** | `/api/copilot` uses `@copilot-extensions/preview-sdk` v5 — verifyAndParseRequest, tool calling, SSE streaming, confirmation events, user identity from `_session` message |
| **Agent tool calling** | 4 tools: `save_item`, `schedule_event`, `search_items`, `translate_text`. Both SDK paths implemented. |
| **@github/copilot-sdk BYOK** | `processWithCopilotSDK()` uses `@github/copilot-sdk` with Azure AI Foundry BYOK (type: openai, wireApi: completions). `defineTool` handlers auto-dispatch. |
| **Azure direct fallback** | `processWithAzureFallback()` uses OpenAI client with full tool-calling loop — reliable fallback when Copilot CLI unavailable |
| **Frontend UI** | Inbox page, Schedule page, CaptureBar (text/voice/file), Sidebar, chat bubbles, streaming, Vite proxy |
| **Observability** | JSON structured logging, correlation IDs, request timing, DB health check at `/api/health` |
| **Voice → Whisper** | `MediaRecorder` → `POST /api/transcribe` → `AzureOpenAI` Whisper (fixed from plain OpenAI client). No temp files — uses `toFile()`. |
| **PDF extraction** | `POST /api/extract` uses `pdf-parse` (CJS compat via `createRequire`). Supports PDF + plain text files. |
| **Korean/English bilingual** | System prompt handles both languages. Whisper auto-detects. Bilingual placeholder in CaptureBar. |
| **Node.js 24 upgrade** | Upgraded from Node 18 → 24. Rebuilt native deps. Updated Dockerfile to `node:24-alpine`. |
| **Playwright E2E** | 16 UI tests (all passing) + full API test suite in `tests/e2e/` |
| **Whisper Bicep** | `infra/modules/openai.bicep` provisions OpenAI account + Whisper (Standard) + chat model deployments |
| **Demo files** | `demo/` folder: Korean + English `.txt` files, Korean + English `.pdf` files, PDF generator script |

### 🔄 In Progress
- **@github/copilot-sdk CLI resolution** — `copilot.exe` is bundled in `node_modules/@github/copilot-win32-x64/` but SDK is not finding it. Adding graceful fallback to Azure direct path.

### ⏳ Remaining
| Priority | Task | Notes |
|---|---|---|
| 🔴 | **Fix Copilot SDK CLI resolution** | Try bundled binary path; add env flag `COPILOT_SDK_ENABLED`; fallback to Azure direct |
| 🟡 | **Cron notifications + SSE push** | `node-cron` checking `scheduled_events` + `GET /api/notifications` SSE endpoint + UI toasts |
| 🟡 | **E2E tests — PDF upload flow** | Playwright test for file upload → extraction → agent → inbox |
| 🟢 | **Azure Blob + Cosmos DB** | Extension A — swap SQLite for cloud storage (big Azure score boost) |

---

## Judging Criteria Mapping

| Criterion | Weight | How We Win |
|---|---|---|
| Copilot SDK | 25% | Tool calling (save, schedule, search), streaming SSE, context across turns |
| Productivity Impact | 18% | Inbox-zero for personal notes — clear target audience (devs/knowledge workers) |
| Azure AI & Cloud | 18% | Azure OpenAI GPT-4o for agent; Azure Blob Storage for files; Azure Cosmos DB for items (prod) |
| Functionality | 16% | Full e2e: capture → process → store → notify → retrieve |
| UX | 12% | Single-page drag-drop inbox, voice record button, real-time streaming |
| Responsible AI | 6% | Confirmation before scheduling, source attribution in summaries |
| Innovation | 5% | Multi-modal input + unified smart inbox concept |

---

## Architecture

```
User
 │  text / voice / PDF
 ▼
Frontend (React)
 │  POST /api/inbox        (ingest item)
 │  POST /api/inbox/upload (file upload)
 │  GET  /api/inbox        (list/search)
 │  GET  /api/events       (scheduled items)
 ▼
Express Backend
 │  /api/copilot   → Copilot Extension (SSE, tool calling)
 │  /api/inbox     → ingest + store raw items
 │  /api/chat      → direct chat (non-extension)
 ▼
Productivity Agent (Azure OpenAI)
 │  Tools: save_item · schedule_event · search_items · translate_text
 ▼
Storage Layer
 │  SQLite (dev) — inbox_items + scheduled_events tables
 │  items: id, type, raw, summary, tags, due_date, created_at
 ▼
Notification Service
   in-app toasts + scheduled reminders (node-cron)
```

---

## Data Model

```typescript
interface InboxItem {
  id: string;
  type: 'note' | 'task' | 'event' | 'file';
  raw: string;          // original input
  summary: string;      // AI-generated
  tags: string[];
  due_date?: string;    // ISO8601
  scheduled: boolean;
  created_at: string;
}
```

---

## Phases & Priorities

### Phase 1 — Storage Layer ✦ foundation for everything
- [ ] SQLite schema: `inbox_items`, `scheduled_events`
- [ ] CRUD service: `server/services/storage.ts`
- [ ] REST endpoints: `GET/POST /api/inbox`, `GET/POST /api/events`

### Phase 2 — Copilot Agent Tool Calling ✦ 25% of score
- [ ] Define 4 agent tools: `save_item`, `schedule_event`, `search_items`, `translate_text`
- [ ] Implement tool dispatch in `productivity-agent.ts`
- [ ] Wire streaming SSE response through Copilot extension route
- [ ] Add conversation context (multi-turn memory)

### Phase 3 — Multi-modal Input
- [ ] Text input → direct to agent (already works)
- [ ] PDF upload → extract text (pdf-parse) → agent
- [ ] Voice input → Web Speech API (browser) → transcript → agent

### Phase 4 — Frontend Inbox UI
- [ ] Inbox page: capture bar (text/voice/file), item list
- [ ] Item detail: summary, tags, due date, original content
- [ ] Scheduled events view with countdown
- [ ] Real-time streaming display (SSE)
- [ ] Notification toasts for due items

### Phase 5 — Azure AI & Observability
- [ ] Proper `AzureOpenAI` client with Foundry endpoint
- [ ] Structured logger (`server/lib/logger.ts`) — JSON logs w/ timestamps + correlationIds
- [ ] Log all agent tool calls and outcomes

### Phase 6 — Testing
- [ ] E2E: ingest text → verify saved; ingest PDF → verify summary stored
- [ ] Unit tests: agent tool dispatch with mocked Azure OpenAI

---

## Extension Phases (post-MVP, for higher Azure score)

### Extension A — Azure Cloud Storage (replaces SQLite in prod)
> Boosts Azure AI & Cloud score from ~12% → 18%

- [ ] **Azure Blob Storage** — store raw uploaded files (PDFs, voice recordings) via `@azure/storage-blob`
- [ ] **Azure Cosmos DB** — replace SQLite with Cosmos DB (NoSQL, per-user partitioning) via `@azure/cosmos`
- [ ] Storage abstraction layer already designed for this — add `STORAGE_BACKEND=cosmos|sqlite` env switch
- [ ] Provision in `infra/main.bicep`: Cosmos DB account + Blob container
- [ ] New env vars: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `BLOB_CONNECTION_STRING`

### Extension B — Scheduled Notifications / Cron Nudges
> Boosts Productivity Impact — tangible, proven user benefit

- [ ] **node-cron** job every minute: query `scheduled_events` where `due_at <= now AND notified = 0`
- [ ] **In-app SSE push**: `GET /api/notifications` persistent stream; server pushes when items are due
- [ ] **Notification toast** in UI: non-blocking toast with event title + "View" action
- [ ] Mark event as `notified = 1` after pushing
- [ ] Future upgrade: swap SSE for Azure Web PubSub for multi-device delivery

### Extension C — Multi-user Auth
> Enables real-world deployment

- [ ] GitHub OAuth for standalone web UI (`passport-github2`)
- [ ] Use `X-GitHub-Token` from Copilot extension path for identity
- [ ] Storage already scoped to `user_id` — just wire the auth layer
