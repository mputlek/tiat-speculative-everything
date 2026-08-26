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
    // /begin is always the reset-and-attract entry point — every visit
    // wipes saved progress and shows the attract screen fresh, no ?reset
    // query param needed. Same key /globe/script.js uses, so it clears
    // for both pages at once (they share localStorage on this origin).
    localStorage.removeItem(STORAGE_KEY);

    setReady(true);

    let ably: InstanceType<typeof Ably.Realtime> | undefined;
    (async () => {
      const config = await fetch("/api/globe-config").then((r) => r.json());
      if (!config?.ABLY_API_KEY) return;

      ably = new Ably.Realtime({ key: config.ABLY_API_KEY, clientId: "begin" });
      const channel = ably.channels.get(config.CHANNEL_NAME);
      channel.subscribe("message", () => {
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
