"use client";

import { useEffect, useState } from "react";
import Ably from "ably";
import LoadingScreen from "../components/LoadingScreen";

// Same key/shape /globe/script.js uses — this page and the static globe
// display share localStorage on the same kiosk browser.
const STORAGE_KEY = "funguy-health-state";

export default function GlobeAttractPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Testing convenience — visiting ?reset clears saved progress with no
    // console/devtools needed. Same key /globe/script.js uses, so it
    // clears for both pages at once (they share localStorage on this
    // origin).
    if (new URLSearchParams(window.location.search).has("reset")) {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Already-engaged kiosk (e.g. after a reboot) should go straight to the
    // globe, not replay the attract screen — /globe/ is a static page
    // outside the Next.js router, so a full navigation is required rather
    // than next/navigation's router.
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.messageCount > 0) {
        window.location.href = "/globe/";
        return;
      }
    } catch {
      /* ignore corrupt storage, fall through to attract mode */
    }

    setReady(true);

    let ably: InstanceType<typeof Ably.Realtime> | undefined;
    (async () => {
      const config = await fetch("/api/globe-config").then((r) => r.json());
      if (!config?.ABLY_API_KEY) return;

      ably = new Ably.Realtime({ key: config.ABLY_API_KEY, clientId: "globe-attract" });
      const channel = ably.channels.get(config.CHANNEL_NAME);
      channel.subscribe("message", () => {
        window.location.href = "/globe/";
      });
    })();

    return () => {
      ably?.close();
    };
  }, []);

  // Avoid a flash of the attract screen for the (common, post-reboot) case
  // where the redirect above fires immediately.
  if (!ready) return null;
  return <LoadingScreen mode="kiosk" />;
}
