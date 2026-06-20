# LipCoding

LipCoding is an AI-powered personal productivity inbox for developers and knowledge workers. Drop in text, voice notes, or PDFs, and the app turns raw capture into structured notes, tasks, reminders, and searchable history. The same agent also speaks the GitHub Copilot Extensions protocol, so your web app and Copilot Chat can share one productivity brain.

## ✨ Key Features
- 📥 **Unified capture inbox** for text, voice, PDFs, and markdown
- 🤖 **Streaming AI agent** that summarizes, classifies, tags, and schedules follow-ups
- 🛠️ **Tool-calling workflow** for saving items, deduping, updating, translating, and scheduling
- 🌐 **Bilingual Korean/English UX** with same-language responses
- 🔔 **Real-time reminders** via browser toasts and optional email notifications
- 🔎 **Search + filters** across summaries, raw captures, tags, type, and dates
- 🧩 **Copilot extension endpoint** for using LipCoding from GitHub Copilot Chat

## 📸 Screenshots
> 📸 Screenshot: Inbox page
>
> 📸 Screenshot: Schedule page
>
> 📸 Screenshot: Search page

## 🚀 Quick Start
### Prerequisites
- Node.js 24+
- npm

### Install and run
```bash
npm install
npm run dev
```

### Useful scripts
```bash
npm run build
npm run test
npm run lint
```

Client runs on `http://localhost:5173` and the Express API runs on `http://localhost:3001`.

## 🔐 Environment Variables
| Variable | Required | Purpose |
|---|---:|---|
| `AZURE_OPENAI_ENDPOINT` | Yes for AI chat/voice | Azure OpenAI endpoint |
| `AZURE_OPENAI_API_KEY` | Yes for AI chat/voice | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Yes for AI chat | Chat deployment name (`gpt-4o`) |
| `AZURE_OPENAI_WHISPER_ENDPOINT` | No | Dedicated Whisper endpoint |
| `AZURE_OPENAI_WHISPER_KEY` | No | Dedicated Whisper API key |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | No | Whisper deployment name |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | No | PDF OCR endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | No | PDF OCR key |
| `AZURE_STORAGE_CONNECTION_STRING` | No | Blob storage for uploaded files |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | No | Email notifications |
| `NOTIFICATION_FROM_EMAIL` | No | Verified ACS sender |
| `NOTIFICATION_TO_EMAIL` | No | Demo recipient for reminders |
| `STORAGE_BACKEND` | No | `sqlite` for local dev, `cosmos` for cloud |
| `COSMOS_CONNECTION_STRING` | No | Cosmos DB connection string |
| `ALLOWED_USERS` | No | Demo auth users in `user:name:token:email` form |
| `ALLOWED_ORIGIN` | No | Allowed browser origin for CORS |

## 🏗️ Architecture
```text
Browser (React + Tailwind)
  ├─ CaptureBar → text / voice / file input
  ├─ SSE chat stream → /api/chat/stream
  └─ SSE notifications → /api/notifications
          │
          ▼
Express API (Node.js 24 + TypeScript)
  ├─ AI agent via @github/copilot-sdk + Azure OpenAI
  ├─ /api/copilot for Copilot Extensions
  ├─ /api/transcribe for Whisper speech-to-text
  ├─ /api/extract for Document Intelligence / PDF fallback
  └─ /api/inbox + /api/events for persistence and reminders
          │
          ├─ Cosmos DB / SQLite
          ├─ Blob Storage
          ├─ Azure Communication Services
          └─ Background notification worker
```

## 🎬 Demo Scenarios
1. **Meeting to action** — Upload a meeting PDF, let the agent summarize it, extract action items, and schedule a deadline reminder.
2. **Voice to schedule** — Record a Korean voice memo, transcribe it with Whisper, then have the agent create a high-priority task and related event.
3. **Copilot handoff** — Save a note from `@lipcoding` in Copilot Chat, then open the web app and see the shared inbox item and reminder.

## 🧱 Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Vite, React 18, TypeScript, Tailwind CSS |
| Backend | Express, `@copilot-extensions/preview-sdk` |
| AI | `@github/copilot-sdk`, Azure OpenAI, Whisper |
| Document processing | Azure Document Intelligence, `pdf-parse` fallback |
| Storage | SQLite (local) or Azure Cosmos DB + Blob Storage |
| Notifications | SSE browser toasts, Azure Communication Services email |
| Testing | Vitest, Testing Library, Supertest, Playwright |
| Deploy | Azure Container Apps via `azd` |
