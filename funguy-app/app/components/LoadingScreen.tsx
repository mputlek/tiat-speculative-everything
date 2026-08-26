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

// Kiosk display (the /begin attract screen, no touchscreen interaction) —
// same narrative, plus a final instructional line replacing the phone's
// tappable CTA below, since there's nothing to click on a passive display.
const KIOSK_TEXTS = [...TEXTS, "Tap your phone on the rock to begin"]

// Phone entry (the actual chat app) skips the narrative cycle entirely —
// a visitor who scans/taps should land straight on the slide with the
// begin button, not wait through the two intro texts first.
const PHONE_TEXTS = [TEXTS[TEXTS.length - 1]]

const MORPH = 1.2  // seconds to blur in or blur out
const HOLD  = 3.8  // seconds each text stays fully visible
const SLOT  = MORPH + HOLD  // 5s between the start of each text

// Texts 1 & 2: in → hold → out
const TRANS_DUR = MORPH * 2 + HOLD  // 6.2s
const T_IN   = ((MORPH           / TRANS_DUR) * 100).toFixed(3)  // fully visible
const T_HOLD = (((MORPH + HOLD)  / TRANS_DUR) * 100).toFixed(3)  // start fading out

// Last text: in → hold → stay (never fades out)
const LAST_DUR = MORPH + HOLD  // 5s
const T_LAST_IN = ((MORPH / LAST_DUR) * 100).toFixed(3)

export default function LoadingScreen({
  onEnter,
  mode = "phone",
}: {
  onEnter?: () => void
  mode?: "phone" | "kiosk"
}) {
  const texts = mode === "kiosk" ? KIOSK_TEXTS : PHONE_TEXTS
  const [showButton, setShowButton] = useState(false)

  // Show the CTA once the (mode-dependent) last slide has fully morphed
  // in. Generalized from a hardcoded 3-text formula — plugging in the old
  // 3-item array here reproduces the same delay, so kiosk timing is
  // unaffected; a 1-item phone array collapses this to just `MORPH`
  // seconds, since there's no cycle to wait through first.
  const buttonDelayMs = (SLOT * (texts.length - 1) + MORPH) * 1000

  useEffect(() => {
    if (mode === "kiosk") return // no CTA to show — the last text is the instruction itself
    const t = setTimeout(() => setShowButton(true), buttonDelayMs)
    return () => clearTimeout(t)
  }, [mode, buttonDelayMs])

  // Kiosk mode is a passive display with nobody to tap a button, so instead
  // of freezing on the last slide it should just keep cycling indefinitely.
  // CSS keyframes can't express "loop after N different per-text delays" on
  // their own without duplicating the whole timeline into percentage math,
  // so this drives the loop from JS instead: every full cycle, bump a key
  // that remounts the text `<p>` elements, which restarts their (unchanged,
  // one-shot) CSS animations from scratch. The last slide also switches to
  // the same fade-out animation the others use (see animationFor below) —
  // its fade-out finishes exactly when this timer fires, so the restart
  // lands as a continuation of the same crossfade rhythm, not a hard cut.
  const cycleDurationMs = (SLOT * (texts.length - 1) + TRANS_DUR) * 1000
  const [cycleKey, setCycleKey] = useState(0)

  useEffect(() => {
    if (mode !== "kiosk") return
    const t = setInterval(() => setCycleKey((k) => k + 1), cycleDurationMs)
    return () => clearInterval(t)
  }, [mode, cycleDurationMs])

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
    // Only a non-looping last slide (phone mode's single-item array) stays
    // frozen in place — kiosk mode's last slide fades out like every other
    // text so the cycle-restart above reads as a continuation, not a jump.
    const shouldStay = isLast && mode !== "kiosk"
    return shouldStay
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

      {/* Morphing text area — keyed on cycleKey (kiosk mode only; stays 0
          otherwise) so each loop remounts the <p> elements below, which
          restarts their one-shot CSS animations from the beginning. */}
      <div key={cycleKey} className="flex-1 relative" style={{ filter: `url(#${filterId})` }}>
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
