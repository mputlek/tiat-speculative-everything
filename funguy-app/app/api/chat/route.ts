import Anthropic from "@anthropic-ai/sdk";
import Ably from "ably";
import { readFileSync } from "fs";
import { join } from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ABLY_CHANNEL_NAME = "funguy-healing"; // fixed integration point with /globe — not worth an env var here

function getPersonality(): string {
  const raw = readFileSync(join(process.cwd(), "content/fun-guy.json"), "utf-8");
  return JSON.parse(raw).personality;
}

// Best-effort, one-shot publish per request via Ably's REST client — no
// persistent Realtime connection needed in a serverless function. Any
// failure (missing key, network error, Ably outage) is caught here so it
// can never affect the chat reply the visitor is waiting for.
async function publishToGlobe(text: string) {
  if (!process.env.ABLY_API_KEY) {
    console.warn("[ably] ABLY_API_KEY not set — skipping globe publish");
    return;
  }
  try {
    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    const channel = ably.channels.get(ABLY_CHANNEL_NAME);
    await channel.publish("message", {
      text,
      ts: Date.now(),
      clientId: `fun-guy-chat-${Math.random().toString(36).slice(2, 10)}`,
    });
  } catch (err) {
    console.error("[ably] Failed to publish to globe channel:", err);
  }
}

export async function POST(request: Request) {
  const { messages } = await request.json();

  const personality = getPersonality();

  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user");

  const [response] = await Promise.all([
    client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: personality,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    }),
    lastUserMessage ? publishToGlobe(lastUserMessage.content) : Promise.resolve(),
  ]);

  const reply = response.content[0].type === "text" ? response.content[0].text : "";
  return Response.json({ reply });
}
