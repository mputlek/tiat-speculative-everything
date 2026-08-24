// Config endpoint for /globe (a static page served from public/globe/). Next.js
// doesn't template files under public/, so the globe page fetches its Ably
// config here at load time instead of the old build-time-generated
// shared/config.js the standalone static site used to rely on.
export async function GET() {
  return Response.json({
    ABLY_API_KEY: process.env.ABLY_API_KEY,
    CHANNEL_NAME: "funguy-healing",
    HEALTH_INCREMENT: Number(process.env.FUNGUY_HEALTH_INCREMENT ?? 2),
    HEALTH_MAX: Number(process.env.FUNGUY_HEALTH_MAX ?? 100),
  });
}
