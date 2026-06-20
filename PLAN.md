# LipCoding — AI Personal Assistant · Project Plan

## What's Built (summary)
Full-stack AI productivity assistant — text/voice/PDF input → GPT-4o agent with 6 tools → Azure Cosmos DB → SSE notifications + ACS email.

**Live:** https://ca-web-3qujsv4wy3voi.gentlebeach-87f2d7cb.koreacentral.azurecontainerapps.io

---

## Remaining Features (by priority)

### 🔥🔥🔥 Priority 1 — Highest ROI

| # | Feature | Criterion | Effort |
|---|---|---|---|
| 1 | **GPT-4o Vision — screenshot paste** (5th input modality) | Azure 18% + Innovation 5% | Low-Med |
| 2 | **Copilot Extension slash commands** `/meeting` `/todo` `/analyze` | SDK 25% + UX 12% | Low |
| 3 | **Azure OpenAI Moderation pre-flight** — content safety check | Responsible AI 6% + Azure 18% | Low |
| 4 | **`getUserFeedback` thumbs up/down** in Copilot Chat extension | SDK 25% | Low |

### 🔥🔥 Priority 2

| # | Feature | Criterion | Effort |
|---|---|---|---|
| 5 | **ACS SMS urgent alerts** for `priority:high` items | Azure 18% + Productivity 18% | Low-Med |
| 6 | **`@github/copilot-sdk` streaming: true** → SDK drives tokens | SDK 25% | Medium |
| 7 | **GitHub Issue creation tool** in Copilot ext path | SDK 25% + Innovation 5% | Medium |
| 8 | **Meeting notes extraction mode** — structured task/attendee extraction | Innovation 5% | Medium |
| 9 | **Source citation** `[ref:abc123]` in agent responses | Responsible AI 6% | Medium |

### 🔥 Priority 3

| # | Feature | Criterion | Effort |
|---|---|---|---|
| 10 | **Azure AI Language PII Detection** before storage | Responsible AI 6% + Azure 18% | Medium |
| 11 | **Azure AI Search + Vector Embeddings** for semantic search | Azure 18% + Productivity 18% | Medium |
| 12 | **Weekly PDF export** (pdfkit already installed) | Productivity 18% + Func 16% | Medium |
| 13 | **App Insights telemetry** — 3-line Azure observability | Azure 18% | Low |
| 14 | **Keyboard shortcuts** `Ctrl+K` focus, `Ctrl+Shift+V` voice | UX 12% | Low |

---

## 🎬 Demo Scenarios

### Demo 1 — "Meeting-to-Action Pipeline" (2 min)
1. Drag `demo/회의록_2026-06-20.pdf` onto capture bar
2. Azure Document Intelligence extracts Korean text
3. Streaming response with tool chips: `🔧 save_item` → `🔧 schedule_event`
4. Schedule page shows Friday event with countdown
5. Ask "What action items came from today's meeting?" → agent cites `[ref:...]`
> *"From a PDF drop to a fully scheduled action plan — in 30 seconds, in Korean."*

### Demo 2 — "Voice to Bilingual Schedule" (90 sec)
1. Press Voice → speak Korean: *"다음 주 금요일에 팀 미팅이 있어요. 긴급해요."*
2. Whisper transcribes → `⚡ Whisper via Azure AI · 0.8s`
3. Agent creates 🔴 High priority task + schedules event — tool chips visible
> *"One voice input in Korean — two tasks, one event. Zero typing."*

### Demo 3 — "Copilot Extension Flow" (2 min)
1. Copilot Chat: `@lipcoding I merged the auth PR. Save a note and schedule a security review Monday.`
2. SSE streams token-by-token. Tool chips fire.
3. Switch to web app — note and event appear (shared Cosmos DB)
> *"Your AI coding assistant and productivity system share the same memory."*

---

## Azure Resources

| Service | Resource | Purpose |
|---|---|---|
| Container Apps | `ca-web-*` (Korea Central) | Web server |
| OpenAI GPT-4o | `cog-lipcoding-eastus` (East US) | Chat agent |
| AI Services Whisper | `aisvc-lipcoding-eastus2` (East US 2) | Voice STT |
| Cosmos DB | `cosmos*` | Storage (prod) |
| Blob Storage | `st*` | File uploads |
| Document Intelligence | `doc-intel-lipcoding` | PDF OCR |
| Communication Services | `acs-lipcoding` | Email notifications |
