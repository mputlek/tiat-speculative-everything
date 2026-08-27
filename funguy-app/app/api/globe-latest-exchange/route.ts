import { getDatabase } from "@netlify/database";

// Seeds /globe's live feed on load with the most recent logged interaction.
// Needed because Ably doesn't replay past events to a fresh subscriber —
// the first exchange of a kiosk session is often published (via
// publishExchange() in app/api/chat/route.ts) before /globe's page load +
// Ably reconnect (triggered by app/begin/page.tsx's redirect) finishes, so
// it would otherwise be silently lost. Best-effort, same as the rest of
// the interaction-log/Ably plumbing.
export async function GET() {
  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT question, answer FROM interactions ORDER BY created_at DESC LIMIT 1
    `;
    const row = rows[0];
    if (!row) return Response.json({ exchange: null });
    return Response.json({ exchange: { question: row.question, answer: row.answer } });
  } catch (err) {
    console.error("[globe-latest-exchange] Failed to fetch latest interaction:", err);
    return Response.json({ exchange: null });
  }
}
