# lipcoding

This repository contains a web application that is used to improve personal productivity.

## Golden rules

- Testing core features e2e is important. Try to automate e2e tests that are critical for this web application, do not test that are prone to change.

- Consider the following judgement creteria:

1. Effective Use of Copilot SDK — Weight: 25%

Does the Copilot SDK play a core role in the app's value? Evaluation focuses on the quality and appropriateness of prompt/agent design, tool calling, context handling, and streaming—prioritizing depth over the sheer number of features.

2. Productivity Impact & Problem Fit — Weight: 18%

Does it solve a realistic, well-defined productivity problem while delivering tangible, proven benefits to a clearly defined target audience?

3. Azure AI & Cloud Integration — Weight: 18%

Evaluates the meaningfulness of the Azure cloud utilization. Top scores are awarded when the AI/model layer operates on Microsoft Foundry or Azure OpenAI. Bonus points are given for cloud-native practices, while points are deducted for merely shoehorning in Azure services.

4. Functionality & Technical Execution — Weight: 16%

Does the application function end-to-end? Evaluation covers code quality, architecture, error handling, performance, and platform-appropriate implementation (native, cross-platform, or responsive web).

5. User Experience & Workflow Design — Weight: 12%

Evaluates UI that minimizes user friction, natural AI integration, graceful handling of latency/errors/transparency, accessibility, and design that ensures the user retains control.

6. Responsible AI, Security & Trust — Weight: 6%

Evaluates transparency of AI output, human-in-the-loop verification for risky actions, data privacy, hallucination mitigation, awareness of prompt injection, and secure handling of secrets.

7. Innovation & Originality — Weight: 5%

Evaluates how AI is applied in a novel and creative way to enhance productivity, rather than simply replicating existing services or tools.

- In this competition, users will not be able to review all the code. Make sure to provide logging and other observability features so that users can track the progress and debug easily

---

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | Vite + React 18 + TypeScript + Tailwind CSS  |
| Backend    | Express + `@copilot-extensions/preview-sdk`  |
| AI         | Azure OpenAI (`@azure/openai`) via Foundry   |
| Testing    | Vitest + Testing Library + Supertest         |
| Deploy     | Azure Container Apps via `azd` CLI           |
| CI/CD      | GitHub Actions (`.github/workflows/ci.yml`)  |

## Commands

```bash
# Development
npm run dev          # Start both client (Vite) and server (Express) concurrently
npm run dev:client   # Vite dev server only (port 5173)
npm run dev:server   # Express server only (port 3001)

# Testing
npm run test         # Run all tests once
npm run test:watch   # Run tests in watch mode

# Build
npm run build        # TypeScript check + Vite production build

# Lint
npm run lint         # ESLint
```

## Deployment (Azure)

### Prerequisites
- `azd` CLI installed ([https://aka.ms/azd](https://aka.ms/azd))
- Logged in: `azd auth login`
- Azure OpenAI resource provisioned with a `gpt-4o` deployment

### Quick Deploy

```powershell
# Windows
.\scripts\deploy.ps1 -EnvName dev -Location koreacentral

# Linux/Mac
./scripts/deploy.sh dev koreacentral
```

### Manual Steps

```bash
# 1. Set environment
azd env new dev --location koreacentral

# 2. Configure secrets
azd env set AZURE_OPENAI_ENDPOINT https://your-resource.openai.azure.com/
azd env set AZURE_OPENAI_API_KEY your-key
azd env set AZURE_OPENAI_DEPLOYMENT gpt-4o

# 3. Provision infrastructure (creates Resource Group, Container Registry, Container App)
azd provision

# 4. Deploy app (builds Docker image remotely on ACR, deploys to Container App)
azd deploy

# 5. Check deployment URL
azd env get-values | Select-String "WEB_URI"
```

### What Gets Created

| Azure Resource              | Purpose                          |
|-----------------------------|----------------------------------|
| Resource Group (`rg-dev`)   | Contains all resources           |
| Container Registry          | Stores Docker images             |
| Container Apps Environment  | Hosts the container app          |
| Container App               | Runs the application             |
| Log Analytics Workspace     | Logging and monitoring           |

### Tear Down

```bash
azd down   # Deletes all provisioned resources
```

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── pages/              # Route pages
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── server/                 # Express backend
│   ├── routes/
│   │   ├── copilot.ts      # GitHub Copilot Extensions endpoint (SSE)
│   │   └── health.ts       # Health check
│   ├── agents/
│   │   └── productivity-agent.ts  # AI agent logic (Azure OpenAI)
│   └── index.ts            # Server entry point
├── tests/                  # Test files
├── infra/                  # Bicep IaC templates
│   ├── main.bicep          # Main deployment template
│   ├── main.parameters.json
│   └── modules/            # Bicep modules
├── scripts/                # Automation scripts
│   ├── deploy.sh           # Linux/Mac deploy script
│   └── deploy.ps1          # Windows deploy script
├── azure.yaml              # azd project definition
├── Dockerfile              # Production container
└── .github/workflows/ci.yml  # CI pipeline
```

## Environment Variables

| Variable                   | Description                       | Required |
|----------------------------|-----------------------------------|----------|
| `AZURE_OPENAI_ENDPOINT`   | Azure OpenAI resource endpoint    | Yes      |
| `AZURE_OPENAI_API_KEY`    | Azure OpenAI API key              | Yes      |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name (e.g. gpt-4o)| Yes     |
| `PORT`                     | Server port (default: 3001)       | No       |

## Conventions

- Use TypeScript strict mode everywhere
- Tests go in `tests/` directory, co-located by feature
- Mock external services (Azure OpenAI) in tests
- Use Zod for runtime validation of API inputs
- SSE streaming for Copilot extension responses
- `remoteBuild: true` in azure.yaml — Docker builds happen on ACR, no local Docker needed