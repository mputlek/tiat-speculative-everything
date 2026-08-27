import { getStore } from "@netlify/blobs";

const STORE_NAME = "interactions";

// Best-effort, one-record-per-interaction log. One blob per interaction
// (rather than one growing JSON array) avoids read-modify-write races
// between concurrent requests — matches the pattern already used for
// publishToGlobe() in app/api/chat/route.ts. Failures are caught here so
// logging can never affect the chat reply the visitor is waiting for.
export async function logInteraction(question: string, answer: string): Promise<void> {
  try {
    const store = getStore(STORE_NAME);
    const now = new Date();
    const key = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(key, {
      date: now.toISOString().slice(0, 10), // YYYY-MM-DD
      time: now.toISOString().slice(11, 19), // HH:MM:SS (UTC)
      question,
      answer,
    });
  } catch (err) {
    console.error("[interactionLog] Failed to log interaction:", err);
  }
}
