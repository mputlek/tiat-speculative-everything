# Fun-Guy

A Next.js app with two parts, deployed together:

- **Chat** (`app/`) — visitors talk to "the fun-guy" (a mycelium personality)
  via a Claude-powered chat interface. `app/api/chat/route.ts` calls Claude
  (Anthropic API) for replies, using `content/fun-guy.json`'s `personality`
  field as the system prompt.
- **Globe** (`public/globe/`) — a Three.js/Globe.gl visualization at `/globe`
  showing the mycelium network healing in real time. Every chat message
  publishes to an Ably channel (`funguy-healing`); the globe subscribes and
  reacts (color/texture grading, a spreading network of glowing threads,
  Dormant → Awakening → Thriving stages).

No custom backend beyond the two API routes above — Ably's pub/sub replaces
the need for a WebSocket server, and both routes are plain Next.js Route
Handlers (deployed as serverless functions on Netlify).

## How the pieces connect

1. Visitor sends a chat message (`app/page.tsx`'s `sendMessage`).
2. `app/api/chat/route.ts` gets a reply from Claude **and**, concurrently,
   publishes the visitor's message to Ably's `funguy-healing` channel
   (`publishToGlobe`, best-effort — a failed publish never breaks the chat
   reply).
3. `/globe` (`public/globe/script.js`) subscribes to that channel, bumps
   `healthValue`, and re-renders.
4. Since `public/` is a static-passthrough folder in Next.js (no build-time
   templating), `/globe` fetches its own config — the Ably key and channel
   name — from `app/api/globe-config/route.ts` at load time, instead of a
   build-time-generated file.

## Local dev

```
npm install
cp .env.local.example .env.local   # if present — otherwise create it manually, see below
npm run dev
```

`.env.local` (gitignored) needs:
```
ANTHROPIC_API_KEY=sk-ant-...
ABLY_API_KEY=appid.keyid:secret
```

For the Ably key: create a free app at [ably.com](https://ably.com), then
create an API key scoped to **Publish + Subscribe only** (no Admin) on the
`funguy-healing` channel — this key is server-side only here (unlike the
project's earlier static-site prototype, it never reaches the browser).

Open `http://localhost:3000/` for chat and `http://localhost:3000/globe`
for the globe.

## Deploy (Netlify)

Netlify's Next.js Runtime auto-detects this app (App Router + API routes,
no custom build script needed). Set the same two env vars
(`ANTHROPIC_API_KEY`, `ABLY_API_KEY`) as site environment variables, plus
optionally `FUNGUY_HEALTH_INCREMENT` / `FUNGUY_HEALTH_MAX` to override the
defaults (2 / 100) baked into `/api/globe-config`.

If this app lives in a subdirectory of a larger repo (as it does here, under
`funguy-app/`), set **Base directory** to `funguy-app` in Netlify's build
settings.

## Testing the real loop

1. Open the deployed `/globe` URL on a laptop or the kiosk machine.
2. On your phone, **on cellular data** (not the same wifi as the globe
   display), open the deployed root URL and chat with the fun-guy.
3. Confirm the globe's status shows "connected" and the health bar/threads
   advance as messages come in.

## Testing without sending real messages

`/globe?debug` shows a slider mapped to message count — drag it to preview
the Dormant → Thriving transition directly, without sending real chat
messages.
