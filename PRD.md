# LipCoding — AI Personal Assistant
## Product Requirements Document (PRD)

---

## 1. Overview

**LipCoding** is a bilingual (Korean/English) personal productivity assistant that acts as a smart inbox. Users drop anything — a text note, a voice recording, or a PDF document — and the AI agent automatically classifies, summarizes, extracts tasks and deadlines, stores everything in the cloud, and sends reminders when items are due.

The application is built as a **GitHub Copilot Chat Extension** (accessible via `@lipcoding` in VS Code Copilot Chat) and as a **standalone web application**, sharing the same AI agent backend and persistent storage.

---

## 2. Problem Statement

Knowledge workers and developers lose productivity by context-switching between capture tools (notes apps), task managers, calendars, and communication tools. Meeting notes get forgotten, voice ideas disappear, PDFs pile up unread. The friction of manually organizing information means most captured content never becomes action.

**LipCoding solves this by making AI do the organizing.** The user's only job is to drop information — in any format, in any language — and the agent handles the rest.

---

## 3. Target Audience

- Developers using GitHub Copilot who want to capture ideas, tasks, and notes without leaving their editor
- Bilingual users (Korean/English) who work across both languages
- Knowledge workers who receive information in multiple formats (voice memos, PDFs, text)

---

## 4. Core User Flow

```
User Input (any format)
        │
        ├── Text message → CaptureBar
        ├── Voice recording → MediaRecorder → Azure Whisper (STT)
        └── File upload → Azure Document Intelligence (PDF OCR) or pdf-parse (fallback)
        │
        ▼
AI Agent (Azure OpenAI GPT-4o via Foundry / @github/copilot-sdk BYOK)
        │
        ├── Classifies: note / task / event / file
        ├── Summarizes content (same language as input)
        ├── Extracts tags and priority (high/medium/low)
        ├── Detects dates/deadlines → schedules reminder
        ├── Checks existing items → updates instead of duplicating
        └── Saves to Azure Cosmos DB
        │
        ▼
Persistent Storage (Azure Cosmos DB, partition key: userId)
        │
        ├── GET /api/inbox → filtered list (type, tag, date range, search)
        ├── GET /api/events → scheduled reminders
        └── SSE /api/notifications → real-time browser toasts
        │
        ▼
Notifications (when deadline arrives)
        ├── In-browser: SSE push → toast notification
        └── Email: Azure Communication Services (ACS)
```

---

## 5. Key Features

### 5.1 Multi-Modal Input Capture
- **Text**: Direct input via capture bar (Ctrl+Enter to submit)
- **Voice**: `MediaRecorder` records audio → `POST /api/transcribe` → Azure OpenAI Whisper (deployed in East US 2) → transcript auto-filled in capture bar
- **PDF**: `POST /api/extract` → Azure Document Intelligence `prebuilt-read` model (handles Korean/CJK fonts, scanned documents, tables) → extracted text sent to agent
- **Text files**: `.txt`, `.md` files read directly in browser

### 5.2 AI Agent with Tool Calling
The agent uses **6 tools** via the OpenAI function-calling API:

| Tool | Purpose |
|---|---|
| `save_item` | Save note/task/event/file with AI-generated summary and tags |
| `schedule_event` | Create a timed reminder for a deadline |
| `search_items` | Search existing inbox before saving (deduplication) |
| `update_item` | Update an existing item instead of creating a duplicate |
| `close_event` | Cancel/complete a scheduled reminder |
| `translate_text` | Translate content and save the translation |

**Context injection**: Before each agent call, the 10 most recent items + upcoming events are injected into the system prompt (wrapped in XML tags to prevent prompt injection). The agent uses this history to avoid duplicates and make context-aware decisions.

### 5.3 Bilingual Support (Korean + English)
- System prompt instructs the agent to respond in the same language as input
- Handles Korean date formats: `금요일`, `다음 주 월요일`, `내일`, etc.
- Azure Whisper auto-detects language — no manual language selection needed
- Azure Document Intelligence supports Korean OCR natively
- UI placeholder: `메모, 할 일, 파일 등 무엇이든 입력하세요 / Drop anything...`

### 5.4 Real-Time Streaming Chat
The web chat uses **Server-Sent Events (SSE)** streaming:
- Tokens stream token-by-token as the model generates (`GET /api/chat/stream`)
- Tool-call transparency chips appear inline: `🔧 Calling save_item... → ✅ Saved`
- AI attribution footer: `⚡ GPT-4o via Azure AI · 1.2s`
- Rate limiting: 20 requests/minute per IP via `express-rate-limit`

### 5.5 GitHub Copilot Chat Extension
`POST /api/copilot` implements the Copilot Extensions protocol using `@copilot-extensions/preview-sdk`:
- `verifyAndParseRequest` for ECDSA signature verification
- Full conversation history passed as `payload.messages`
- User identity extracted from the `_session` message (no separate auth needed)
- SSE response with tool call events and confirmation requests
- Works via `@lipcoding` mention in GitHub Copilot Chat (VS Code, github.com)

### 5.6 Scheduled Notifications
- **In-browser**: `node-cron` fires every minute → queries due events → SSE push to connected `EventSource` → `NotificationToast` component appears top-right
- **Email** (separate worker service): `worker/notifier.ts` runs as a separate Azure Container App → `NotificationDispatcher` → `EmailChannel` → Azure Communication Services HTML email
- Worker is decoupled from web server: uses shared Cosmos DB, dispatches outbound channels only

### 5.7 Search and Filtering
`GET /api/inbox` supports compound filters:
- `?search=` — full-text search on raw + summary + tags
- `?type=note|task|event|file` — filter by item type
- `?tag=` — filter by specific tag
- `?from=&to=` — date range on `created_at`
- `?priority=high|medium|low` — filter by AI-assigned priority

### 5.8 Multi-User Authentication
Pre-shared token system (no registration needed for demo):
- `ALLOWED_USERS=userId:displayName:token:email` — defines fixed user list
- `lip_session` httpOnly cookie (7-day expiry, sameSite: strict)
- Login page with token input
- All data routes check `req.userId` ownership (403 if mismatch)
- Single-user mode (no auth) when `ALLOWED_USERS` is not set

---

## 6. Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser — React 18 + Vite + Tailwind CSS            │
│  EventSource → /api/notifications (SSE)              │
│  fetch/EventSource → /api/chat/stream (SSE tokens)   │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────┐
│  Azure Container App — ca-web (Korea Central)        │
│  Express + Node.js 24 + TypeScript                   │
│                                                      │
│  /api/copilot   → Copilot Chat Extension (SSE)       │
│  /api/chat      → POST (non-streaming)               │
│  /api/chat/stream → GET SSE streaming                │
│  /api/transcribe → Voice → Whisper STT               │
│  /api/extract   → PDF → Document Intelligence        │
│  /api/inbox     → CRUD + search                      │
│  /api/events    → Scheduled events                   │
│  /api/notifications → SSE stream                    │
│  /api/auth      → Login / logout / me                │
│  /api/health    → Multi-service health check         │
└──┬──────────┬────────┬───────────┬──────────────────┘
   │          │        │           │
   ▼          ▼        ▼           ▼
Azure      Azure    Azure       Azure
OpenAI    Cosmos   Blob        Doc Intel
GPT-4o    DB       Storage     (Form Rec)
(eastus)  (NoSQL)  (uploads)   (eastus2)
          ↑
┌─────────┴───────────────────────────────────────────┐
│  Azure Container App — ca-worker (separate service)  │
│  worker/notifier.ts — node-cron every 1 min          │
│  NotificationDispatcher → EmailChannel (ACS)         │
└─────────────────────────────────────────────────────┘
```

### AI Client Architecture

| Path | SDK | Auth | Model |
|---|---|---|---|
| Copilot Chat extension | `@copilot-extensions/preview-sdk` | `X-GitHub-Token` | GitHub Copilot API |
| Web UI chat | `@github/copilot-sdk` BYOK | Azure API key | gpt-4o (eastus) |
| Web UI fallback | `openai` direct | Azure API key | gpt-4o (eastus) |
| Voice transcription | `openai` AzureOpenAI | Azure API key | whisper (eastus2) |
| PDF extraction | `@azure/ai-form-recognizer` | Azure API key | prebuilt-read |

---

## 7. Azure Services Used

| Service | Purpose | Resource |
|---|---|---|
| **Azure Container Apps** | Hosts web server + worker | `ca-web-*`, `ca-worker-*` |
| **Azure OpenAI (East US)** | GPT-4o for agent tool calling | `cog-lipcoding-eastus` |
| **Azure AI Services (East US 2)** | Whisper speech-to-text | `aisvc-lipcoding-eastus2` |
| **Azure Cosmos DB (NoSQL)** | Persistent storage, partition by userId | `cosmos*`, database: `lipcoding` |
| **Azure Blob Storage** | Raw uploaded files (PDFs, audio) | `st*`, container: `lipcoding-uploads` |
| **Azure Document Intelligence** | Korean/CJK PDF OCR | `doc-intel-lipcoding` |
| **Azure Communication Services** | Email notifications | `acs-lipcoding` |
| **Azure Container Registry** | Docker image storage | `cr*` |
| **Log Analytics** | Structured log aggregation | `cae-*-logs` |

---

## 8. Security & Responsible AI

### Security Measures
- **Prompt injection (XPIA) prevention**: User-stored data injected into system prompt is wrapped in `<user_data>` XML tags with explicit instructions not to follow any embedded directives. All values HTML-escaped and capped at 200 chars.
- **CORS**: Explicit allowlist (`ALLOWED_ORIGIN` env var) — not `origin: true`
- **Authorization**: Every data route verifies `item.user_id === req.userId` (403 otherwise)
- **Rate limiting**: 20 AI requests/minute per IP
- **Secrets**: No secrets committed to git; all via env vars / Azure Key Vault references
- **Input validation**: MIME type + file size checks on upload endpoints
- **Parameterized queries**: All SQLite and Cosmos DB queries use parameter binding

### Responsible AI
- **Human-in-the-loop**: `window.confirm()` before deleting items; Copilot extension uses `createConfirmationEvent` before scheduling
- **Transparency**: AI attribution footer shows model name + latency on every response
- **Hallucination mitigation**: Agent cites stored item IDs (`[ref:abc123]`) when answering search queries
- **Input sanitization**: Heuristic check for prompt injection patterns in user messages

---

## 9. Data Model

```typescript
interface InboxItem {
  id: string;
  userId: string;         // partition key (Cosmos DB)
  type: "note" | "task" | "event" | "file";
  raw: string;            // original user input
  summary: string;        // AI-generated summary
  tags: string[];         // AI-extracted tags + "priority:high/medium/low"
  due_date?: string;      // ISO8601 — extracted by agent
  scheduled: boolean;
  completed: boolean;     // for task items
  file_url?: string;      // Azure Blob URL if file was uploaded
  created_at: string;
}

interface ScheduledEvent {
  id: string;
  userId: string;
  item_id?: string;       // linked inbox item
  title: string;
  description?: string;
  due_at: string;         // ISO8601
  notified: boolean;
  created_at: string;
}
```

---

## 10. Demo Scenarios

### Demo 1 — "Meeting-to-Action Pipeline" (2 min)
1. Drag `demo/회의록_2026-06-20.pdf` onto the capture bar
2. Azure Document Intelligence extracts Korean text
3. Streaming response types out — tool chips appear: `🔧 save_item "Q4 budgeting decision"` → `🔧 schedule_event "Budget review" Friday`
4. Schedule page shows the Friday event with countdown
5. Ask: "What action items came out of today's meeting?" → agent cites items with `[ref:...]`

### Demo 2 — "Voice to Bilingual Schedule" (90 sec)
1. Press Voice → speak Korean: *"다음 주 금요일에 팀 미팅이 있어요. 발표 자료를 목요일까지 준비해야 하는데, 긴급해요."*
2. Whisper transcribes → `⚡ Whisper via Azure AI · 0.8s`
3. Agent creates 🔴 High priority task + schedules events — tool chips visible
4. Type "Translate my last task to English" → `translate_text` fires

### Demo 3 — "GitHub Copilot Extension" (2 min)
1. In VS Code Copilot Chat: `@lipcoding I merged the auth PR. Save a note and schedule a security review next Monday.`
2. SSE streams token-by-token. Two tool calls visible.
3. Switch to LipCoding web app — note and event appear (shared Cosmos DB)
4. Ask: `@lipcoding What do I have next week?` → agent returns Monday event

---

## 11. Environment Variables

| Variable | Purpose |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI (GPT-4o) endpoint |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Chat model deployment (`gpt-4o`) |
| `AZURE_OPENAI_WHISPER_ENDPOINT` | Separate Whisper endpoint (East US 2) |
| `AZURE_OPENAI_WHISPER_KEY` | Whisper API key |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | Whisper deployment name (`whisper`) |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Form Recognizer endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Form Recognizer key |
| `STORAGE_BACKEND` | `sqlite` (dev) or `cosmos` (prod) |
| `COSMOS_CONNECTION_STRING` | Azure Cosmos DB connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage connection string |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | ACS for email notifications |
| `NOTIFICATION_FROM_EMAIL` | Sender address (ACS verified domain) |
| `ALLOWED_USERS` | `userId:name:token:email` — fixed user list |
| `ALLOWED_ORIGIN` | CORS allowed origin |
| `LOG_LEVEL` | `info` (default) |

---

## 12. Live Deployment

- **Web app**: https://ca-web-3qujsv4wy3voi.gentlebeach-87f2d7cb.koreacentral.azurecontainerapps.io
- **Region**: Korea Central (Azure Container Apps), East US (GPT-4o), East US 2 (Whisper)
- **Repository**: https://github.com/gjc-detour/lipcoding
