"use client"

import { useId, useEffect, useState } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"

const MushroomModel = dynamic(() => import("./MushroomModel"), { ssr: false })

const TEXTS = [
  "What if...we could communicate with mycelium networks?",
  "It is 2075, and you are in a community garden at a local school on the West Coast",
  "Talk to the fun-guy in front of you and learn how to leave the world better than you find it",
]

// Kiosk display (the /globe attract screen, no touchscreen interaction) —
// same narrative, plus a final instructional line replacing the phone's
// tappable CTA below, since there's nothing to click on a passive display.
const KIOSK_TEXTS = [...TEXTS, "Tap your phone on the rock to begin"]

const MORPH = 1.2  // seconds to blur in or blur out
const HOLD  = 3.8  // seconds each text stays fully visible
const SLOT  = MORPH + HOLD  // 5s between the start of each text

// Texts 1 & 2: in → hold → out
const TRANS_DUR = MORPH * 2 + HOLD  // 6.2s
const T_IN   = ((MORPH           / TRANS_DUR) * 100).toFixed(3)  // fully visible
const T_HOLD = (((MORPH + HOLD)  / TRANS_DUR) * 100).toFixed(3)  // start fading out

// Text 3: in → hold → stay (never fades out)
const LAST_DUR = MORPH + HOLD  // 5s
const T_LAST_IN = ((MORPH / LAST_DUR) * 100).toFixed(3)

// Show the CTA after text 3 has fully morphed in
const BUTTON_DELAY_MS = (SLOT * 2 + MORPH) * 1000

export default function LoadingScreen({
  onEnter,
  mode = "phone",
}: {
  onEnter?: () => void
  mode?: "phone" | "kiosk"
}) {
  const texts = mode === "kiosk" ? KIOSK_TEXTS : TEXTS
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    if (mode === "kiosk") return // no CTA to show — the last text is the instruction itself
    const t = setTimeout(() => setShowButton(true), BUTTON_DELAY_MS)
    return () => clearTimeout(t)
  }, [mode])

  const rawId    = useId()
  const safeId   = rawId.replace(/[^a-zA-Z0-9]/g, "")
  const filterId = `goo-${safeId}`
  const animOut  = `morph-out-${safeId}`   // used by texts 1 & 2
  const animStay = `morph-stay-${safeId}`  // used by text 3

  const keyframes = `
@keyframes ${animOut} {
  0%           { opacity:0; filter:blur(18px); transform:translate(-50%,-50%) scale(0.88); }
  ${T_IN}%     { opacity:1; filter:blur(0px);  transform:translate(-50%,-50%) scale(1);    }
  ${T_HOLD}%   { opacity:1; filter:blur(0px);  transform:translate(-50%,-50%) scale(1);    }
  100%         { opacity:0; filter:blur(18px); transform:translate(-50%,-50%) scale(1.06); }
}
@keyframes ${animStay} {
  0%              { opacity:0; filter:blur(18px); transform:translate(-50%,-50%) scale(0.88); }
  ${T_LAST_IN}%   { opacity:1; filter:blur(0px);  transform:translate(-50%,-50%) scale(1);    }
  100%            { opacity:1; filter:blur(0px);  transform:translate(-50%,-50%) scale(1);    }
}
`

  const animationFor = (i: number) => {
    const isLast = i === texts.length - 1
    return isLast
      ? `${animStay} ${LAST_DUR}s ${(SLOT * i).toFixed(3)}s 1 ease-in-out forwards`
      : `${animOut}  ${TRANS_DUR}s ${(SLOT * i).toFixed(3)}s 1 ease-in-out forwards`
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f1ffc6]">
      <style>{keyframes}</style>

      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* 3D mushroom model */}
      <div className="shrink-0 w-full" style={{ height: 320 }}>
        <MushroomModel />
      </div>

      {/* Morphing text area */}
      <div className="flex-1 relative" style={{ filter: `url(#${filterId})` }}>
        {texts.map((text, i) => (
          <p
            key={i}
            className="absolute text-[30px] font-medium text-[#5b554f] text-center leading-tight"
            style={{
              top: "50%",
              left: "50%",
              width: "calc(100% - 64px)",
              transform: "translate(-50%, -50%)",
              letterSpacing: "-0.6px",
              opacity: 0,
              animation: animationFor(i),
              willChange: "opacity, filter, transform",
            }}
          >
            {text}
          </p>
        ))}
      </div>

      {/* CTA — outside the filter so it stays sharp. Kiosk mode has nothing
          to tap (the last text above is the instruction instead), so it's
          omitted entirely rather than shown disabled. */}
      {mode !== "kiosk" && (
        <div className="shrink-0 pb-14 px-8 flex justify-center">
          <button
            onClick={onEnter}
            className="flex items-center justify-center gap-2 py-6 rounded-[52px] bg-[var(--color-interactive-accent)] w-[300px] transition-opacity duration-700"
            style={{ opacity: showButton ? 1 : 0, pointerEvents: showButton ? "auto" : "none" }}
          >
            <span className="text-base font-normal text-[var(--color-text-accent)]">
              Let&apos;s Begin
            </span>
            <Image src="/assets/icon-arrow-right.svg" alt="" width={20} height={20} />
          </button>
        </div>
      )}
    </div>
  )
}
