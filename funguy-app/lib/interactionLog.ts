import { getDatabase } from "@netlify/database";

// Best-effort interaction log, backed by Netlify Database (Postgres) —
// see netlify/database/migrations/20260826000000_create_interactions.sql
// for the schema. getDatabase() is called inside the function, not at
// module scope, since Next.js evaluates route modules at build time too
// (same reasoning as the lazy getClient() in app/api/chat/route.ts).
// Failures are caught here so logging can never affect the chat reply
// the visitor is waiting for. The sql tagged template auto-parameterizes
// interpolated values, so visitor-typed text can't inject SQL.
export async function logInteraction(
  question: string,
  answer: string,
  sessionId?: string
): Promise<void> {
  try {
    const db = getDatabase();
    await db.sql`
      INSERT INTO interactions (question, answer, session_id)
      VALUES (${question}, ${answer}, ${sessionId ?? null})
    `;
  } catch (err) {
    console.error("[interactionLog] Failed to log interaction:", err);
  }
}
