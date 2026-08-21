// Fun-Guy shared config — TEMPLATE.
//
// For local dev: copy this file to config.js in the same folder and fill in
// your real Ably API key. config.js is gitignored, so it's safe to put a
// real key in it locally.
//
// For Netlify: don't hand-edit config.js at all — scripts/generate-config.js
// runs at build time and writes it from the ABLY_API_KEY environment
// variable set in the Netlify site settings, so the real key never touches
// git.
//
// Ably setup: create a free app at ably.com, then create an API key scoped
// ONLY to this channel with "Publish" + "Subscribe" capabilities (no
// "Admin"). That way, even though this key ships to every visitor's
// browser, it can't do anything beyond talk on this one channel.
window.FUNGUY_CONFIG = {
  ABLY_API_KEY: 'YOUR_ABLY_API_KEY_HERE',
  CHANNEL_NAME: 'funguy-healing',

  // How much healthValue (0-100) goes up per message received.
  // Kept small on purpose — healing should read as collective/cumulative
  // over the course of the exhibition, not a single dramatic jump.
  HEALTH_INCREMENT: 2,
  HEALTH_MAX: 100,
};
