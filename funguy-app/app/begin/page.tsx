"use client";

import { useEffect, useState } from "react";
import Ably from "ably";
import LoadingScreen from "../components/LoadingScreen";

// Same key/shape /globe/script.js uses — this page and the static globe
// display share localStorage on the same kiosk browser.
const STORAGE_KEY = "funguy-health-state";

export default function BeginPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A direct/manual visit to /begin (kiosk boot, QR/NFC target, someone
    // typing the URL) is always the reset-and-attract entry point — no
    // ?reset param needed. But /globe/script.js's own idle-cycle-back also
    // lands here (after 2 min of no messages) to show the attract screen
    // again WITHOUT losing accumulated progress — it marks that handoff
    // with ?resume, which skips the wipe.
    const isResume = new URLSearchParams(window.location.search).has("resume");
    if (!isResume) {
      localStorage.removeItem(STORAGE_KEY);
    }

    setReady(true);

    let ably: InstanceType<typeof Ably.Realtime> | undefined;
    (async () => {
      const config = await fetch("/api/globe-config").then((r) => r.json());
      if (!config?.ABLY_API_KEY) return;

      ably = new Ably.Realtime({ key: config.ABLY_API_KEY, clientId: "begin" });
      const channel = ably.channels.get(config.CHANNEL_NAME);
      channel.subscribe("message", () => {
        // This is the ONLY place that ever sees this particular Ably
        // event — /globe/script.js doesn't subscribe until after the
        // navigation below, so by then this message is already gone (Ably
        // doesn't replay past events to a fresh subscriber). If we just
        // navigated without recording it, /globe would load with
        // messageCount still 0 and immediately bounce back here — the
        // "even after I send 1 message it redirects back" bug. So this
        // page has to apply the exact same health-state bump
        // /globe/script.js's onMessageReceived() does, before handing off.
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
          const state =
            saved && typeof saved.healthValue === "number"
              ? saved
              : { healthValue: 0, messageCount: 0 };
          const healthMax = config.HEALTH_MAX || 100;
          const healthIncrement = config.HEALTH_INCREMENT || 2;
          state.messageCount += 1;
          state.healthValue = Math.min(healthMax, state.healthValue + healthIncrement);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
          /* corrupt storage — still navigate; /globe falls back to its own defaults */
        }
        window.location.href = "/globe/";
      });
    })();

    return () => {
      ably?.close();
    };
  }, []);

  if (!ready) return null;
  return <LoadingScreen mode="kiosk" />;
}
