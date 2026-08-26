// Config endpoint for /globe (a static page served from public/globe/). Next.js
// doesn't template files under public/, so the globe page fetches its Ably
// config here at load time instead of the old build-time-generated
// shared/config.js the standalone static site used to rely on.
export async function GET() {
  const HEALTH_MAX = Number(process.env.FUNGUY_HEALTH_MAX ?? 100);
  return Response.json({
    ABLY_API_KEY: process.env.ABLY_API_KEY,
    CHANNEL_NAME: "funguy-healing",
    // Tied to HEALTH_MAX rather than a flat default — the bar should read
    // "full" at ~300 messages, so the per-message step is derived from
    // that target instead of a magic number that'd drift out of sync if
    // HEALTH_MAX ever changes.
    HEALTH_INCREMENT: Number(process.env.FUNGUY_HEALTH_INCREMENT ?? HEALTH_MAX / 300),
    HEALTH_MAX,
  });
}
