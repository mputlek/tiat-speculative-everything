import OpenAI from "openai";
import Ably from "ably";
import { readFileSync } from "fs";
import { join } from "path";

// Constructed lazily inside the handler, not at module scope — the OpenAI
// client throws immediately if credentials are missing, and Next.js
// executes this module at build time too (page-data collection), which
// would break the build in any environment where the Gateway's env vars
// are only injected at runtime, not build time (e.g. local dev without
// .env.local set). No apiKey/baseURL passed — Netlify's AI Gateway
// auto-injects OPENAI_BASE_URL (and auth) once the site has a production
// deploy, so the official SDK picks it up with zero config. Requires the
// Netlify site to be on a credit-based plan.
function getClient() {
  return new OpenAI();
}

const ABLY_CHANNEL_NAME = "funguy-healing"; // fixed integration point with /globe — not worth an env var here

function getPersonality(): string {
  const raw = readFileSync(join(process.cwd(), "content/fun-guy.json"), "utf-8");
  return JSON.parse(raw).personality;
}

// Worldbuilding Q&A lore, kept as a separate markdown file (not JSON) since it's
// prose, not config — read fresh per-request same as getPersonality() above.
function getKnowledgeBase(): string {
  return readFileSync(join(process.cwd(), "content/fun-guy-knowledge.md"), "utf-8");
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
  const knowledge = getKnowledgeBase();
  const systemPrompt = `${personality}

Background knowledge — draw on these facts to ground your answers, but never quote
them at length or copy their length/format. Always stay in your normal 1–3 sentence
voice.

${knowledge}`;

  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user");

  const [response] = await Promise.all([
    getClient().responses.create({
      model: "gpt-5.6-luna",
      // Max reasoning effort per explicit request — note this trades away
      // latency (and, in a serverless function, risks hitting the
      // platform's execution timeout on a slow response). Drop to "high"
      // if that becomes a problem in practice.
      reasoning: { effort: "max" },
      // Generous cap: "max" effort can spend many hidden reasoning tokens
      // before producing the visible reply, on top of it.
      max_output_tokens: 4096,
      input: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    }),
    lastUserMessage ? publishToGlobe(lastUserMessage.content) : Promise.resolve(),
  ]);

  // Logged (not returned to the client) so the actual served model +
  // reasoning-token spend is verifiable per-request in Netlify's function
  // logs — confirms gpt-5.6-luna at max effort is really what's running,
  // rather than trusting the request config alone.
  console.log(
    `[chat] model=${response.model} reasoning_tokens=${response.usage?.output_tokens_details?.reasoning_tokens ?? "n/a"} output_tokens=${response.usage?.output_tokens ?? "n/a"}`
  );

  const reply = response.output_text ?? "";
  return Response.json({ reply });
}
