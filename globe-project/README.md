# Fun-Guy — Mycelium Healing Globe

Working prototype: two static pages, no backend server. Visitors "talk to
the fun-guy" on their phone at `/message`; every message they send publishes
to an Ably channel that `/globe` subscribes to, nudging a `healthValue`
(0–100) up and changing the globe's appearance.

**Current state is intentionally bare.** Placeholder copy, a plain colored
sphere, a literal health bar. The goal right now is only: prove phone →
Ably → globe works over real cellular data, on real devices. Mycelium
thread visuals, the Animal Crossing palette, and stage-based copy polish
come after that loop is solid.

## How it works

- `message/` — mobile page. Visitor types a message, it's published to the
  Ably channel as a `message` event.
- `globe/` — display page. Subscribes to the same channel; each message
  increments `healthValue` by `HEALTH_INCREMENT` (default 2, capped at 100)
  and re-renders the globe color / health bar / stage label
  (Dormant → Awakening → Thriving). State persists in `localStorage` so a
  page reload on the kiosk machine doesn't reset progress.
- `shared/config.template.js` — checked into git, placeholder values only.
- `shared/config.js` — **gitignored**. Holds the real Ably API key. Either
  hand-copy the template locally, or let Netlify generate it at build time
  (see below).

No backend: Ably's pub/sub replaces the need for a WebSocket server, and
Netlify serves the static files directly.

## 1. Set up Ably

1. Create a free account at [ably.com](https://ably.com) (no credit card
   needed) and create an app.
2. In the app's **API Keys** tab, create a new key scoped to:
   - Capability: **Publish** + **Subscribe** only (no Admin/Presence/etc.)
   - Resource: the single channel name, `funguy-healing` (or whatever you
     set `CHANNEL_NAME` to).
   
   This key ships to every visitor's browser (there's no server to hide it
   behind), so scoping it tightly means the worst a visitor could do is
   spam the one channel — not touch your Ably account.

## 2. Local dev

```
cp shared/config.template.js shared/config.js
```

Edit `shared/config.js` and paste in your real Ably key. Then serve the
folder with any static server, e.g.:

```
npx serve .
```

Open `http://localhost:3000/globe/` in one tab and
`http://localhost:3000/message/` in another (or on your phone via your
computer's LAN IP) to test locally before deploying.

## 3. Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site > Import an existing project**, pick the
   repo.
3. Build settings (already in `netlify.toml`):
   - Build command: `node scripts/generate-config.js`
   - Publish directory: `.`
   - If `globe-project/` is nested inside a bigger repo, set **Base
     directory** to `globe-project` in Site settings.
4. **Site settings > Environment variables**, add `ABLY_API_KEY` with the
   key from step 1. (Optional: `FUNGUY_CHANNEL_NAME`,
   `FUNGUY_HEALTH_INCREMENT`, `FUNGUY_HEALTH_MAX` to override defaults.)
5. Deploy. Netlify runs the build script, which writes `shared/config.js`
   from the env var — the real key never enters git.

## 4. Test the real loop

1. Open the deployed `/globe/` URL on a laptop or the kiosk machine.
2. On your **phone, on cellular data (not the same wifi)**, open the
   deployed `/message/` URL — type it in manually or generate a QR code for
   it (any free QR generator works; NFC tags come later).
3. Send a message. Confirm the globe's status shows "connected", the health
   bar moves, and the stage label advances after enough messages.
4. Send several more messages from a couple of different phones to confirm
   the increase reads as gradual/cumulative, not a single big jump.

## Open decisions (not yet resolved, don't block the prototype)

- Message payload: raw text only for now. Sentiment scoring (and whether it
  gates the health increment) is deferred.
- Exact `healthValue` → stage thresholds are currently 34/67, arbitrary —
  revisit once you know roughly how many messages an exhibition run
  generates.
- Mycelium thread rendering approach (procedural shader vs. pre-made
  assets) — decide once the plain-color placeholder is confirmed working.
