"use client";

import { useState } from "react";
import Image from "next/image";

interface CompostItem {
  id: number;
  text: string;
  rotation: number;  // degrees
  left: number;      // % within compost zone
  top: number;       // % within compost zone
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function MessageView() {
  const [text, setText] = useState("");
  const [compostItems, setCompostItems] = useState<CompostItem[]>([]);
  const [nextId, setNextId] = useState(0);

  function handleSend() {
    if (!text.trim()) return;
    setCompostItems((prev) => [
      ...prev,
      {
        id: nextId,
        text: text.trim(),
        rotation: randomBetween(-22, 22),
        left: randomBetween(8, 72),
        top: randomBetween(5, 65),
      },
    ]);
    setNextId((n) => n + 1);
    setText("");
  }

  return (
    <div className="flex flex-col items-center px-8 pt-16 pb-12 gap-9">
      <p
        className="text-2xl font-medium text-center leading-snug tracking-tight"
        style={{ color: "var(--color-text-system)" }}
      >
        How do you feel about mycelium and fungi now? Have you learnt anything here that changed
        your perspective?
      </p>

      {/* Message box */}
      <div
        className="relative w-full flex flex-col rounded-sm overflow-hidden"
        style={{ height: 273, boxShadow: "1px 0px 4px 0px rgba(122,122,122,0.22)" }}
      >
        <GridBackground />
        <div className="relative z-10 flex flex-col h-full p-4 gap-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
            placeholder="Type here..."
            className="flex-1 resize-none bg-transparent outline-none leading-snug placeholder:text-[var(--color-text-placeholder)] text-[var(--color-text-primary)]"
            style={{ fontSize: text ? 20 : 16, fontWeight: text ? 500 : 400, minHeight: 0 }}
          />
          {text.trim() && (
            <button
              onClick={handleSend}
              className="flex items-center justify-center gap-2 h-11 rounded-full bg-[var(--color-interactive-accent)] shrink-0 self-center transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{ width: 300 }}
            >
              <span className="text-sm font-semibold text-[var(--color-text-accent)]">
                Send Message
              </span>
              <Image src="/assets/icon-arrow-right.svg" alt="" width={14} height={14} />
            </button>
          )}
        </div>
      </div>

      {/* Mushroom + fixed-height compost scatter zone */}
      <div className="flex flex-col items-center w-full">
        <Image
          src="/assets/mushroom-message.png"
          alt="mycelium"
          width={165}
          height={84}
          className="object-contain"
        />

        {/* Fixed-height zone — items scatter here, no scroll added */}
        <div className="relative w-full" style={{ height: 140 }}>
          {compostItems.map((item) => (
            /* Outer div: positions the anchor point; inner p: animates the fall */
            <div
              key={item.id}
              className="absolute"
              style={{ left: `${item.left}%`, top: `${item.top}%`, transform: "translateX(-50%)" }}
            >
              <p
                className="animate-compost text-xs text-[var(--color-text-secondary)] text-center leading-snug"
                style={{
                  maxWidth: 160,
                  fontStyle: "italic",
                  ["--rot"]: `${item.rotation}deg`,
                } as React.CSSProperties}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GridBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#A59F9C" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}
