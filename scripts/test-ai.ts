import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const models = ["gpt-4o", "Kimi-K2.6", "Kimi-K2.6-2026-04-20"];
  
  console.log("Endpoint:", process.env.AZURE_OPENAI_ENDPOINT);
  console.log("Testing models...\n");

  const client = new OpenAI({
    baseURL: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
  });

  for (const model of models) {
    try {
      const r = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "What is 2+2? Reply with just the number." }],
        max_tokens: 50,
      });
      const content = r.choices[0]?.message?.content;
      console.log(`[${model}] => "${content}" (finish: ${r.choices[0]?.finish_reason})`);
    } catch (e: any) {
      console.log(`[${model}] ERROR: ${e.status} - ${e.message?.slice(0, 100)}`);
    }
  }
}
main();
