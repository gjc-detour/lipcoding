import { AzureOpenAI } from "@azure/openai";

const SYSTEM_PROMPT = `You are a productivity assistant integrated into a developer's workflow via GitHub Copilot.
Your goal is to help users manage their tasks, time, and focus.

You can:
- Help break down complex tasks into actionable items
- Suggest time estimates for tasks
- Prioritize tasks based on urgency and importance
- Provide focus session recommendations
- Summarize progress and suggest next steps

Be concise, actionable, and respectful of the user's time.
Always explain your reasoning briefly when making suggestions.`;

interface AgentInput {
  message: string;
  confirmation?: { accepted: boolean; metadata?: Record<string, unknown> } | null;
  token: string;
}

interface AgentOutput {
  response: string;
  confirmationRequest?: {
    message: string;
    metadata?: Record<string, unknown>;
  };
}

export async function processWithAgent(input: AgentInput): Promise<AgentOutput> {
  const { message, confirmation } = input;

  // Handle confirmation responses
  if (confirmation) {
    if (confirmation.accepted) {
      return { response: "✅ Action confirmed and executed." };
    }
    return { response: "❌ Action cancelled." };
  }

  // Use Azure OpenAI for intelligent processing
  const client = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: "2024-08-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
  });

  const completion = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  const responseText =
    completion.choices[0]?.message?.content ?? "I couldn't process that request.";

  return { response: responseText };
}
