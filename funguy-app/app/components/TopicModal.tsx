"use client";

import Image from "next/image";
import { Topic } from "../types";

interface TopicModalProps {
  topics: Topic[];
  onSelect: (topic: Topic) => void;
  onClose: () => void;
}

const illustrationMap: Record<string, string> = {
  sustenance: "/assets/sustenance.png",
  needs: "/assets/needs.png",
  world: "/assets/world.png",
  "2075": "/assets/world.png",
  collab: "/assets/collab.png",
  applications: "/assets/applications.png",
  values: "/assets/values.png",
};

export default function TopicModal({ topics, onSelect, onClose }: TopicModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-[var(--color-bg-secondary)] rounded-[18px] w-full max-w-sm p-6"
        style={{ boxShadow: "0 12px 24px rgba(0,0,0,0.17)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Pick a topic</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Find questions to ask the fun-guy
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <Image src="/assets/icon-close.svg" alt="Close" width={16} height={16} />
          </button>
        </div>

        {/* Topic grid — 2 cols, matching Figma 107×106 cards */}
        <div className="grid grid-cols-2 gap-6 place-items-center">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic, onSelect }: { topic: Topic; onSelect: (t: Topic) => void }) {
  const src =
    illustrationMap[topic.illustration] ??
    illustrationMap[topic.id] ??
    "/assets/sustenance.png";

  return (
    <button
      onClick={() => onSelect(topic)}
      className="flex flex-col items-center justify-center gap-1 pt-4 pb-6 px-[17px] bg-white rounded-[160px] hover:brightness-95 transition-all active:scale-95"
      style={{
        width: 107,
        height: 106,
        boxShadow: "1px 0px 4px rgba(122,122,122,0.22)",
      }}
    >
      {/* Illustration */}
      <div className="relative w-[68px] h-[56px] overflow-hidden shrink-0">
        <Image
          src={src}
          alt={topic.label}
          fill
          className="object-contain"
        />
      </div>
      <span
        className="text-[13px] leading-[1.2] text-[var(--color-icon-primary)] text-center w-[73px]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {topic.label}
      </span>
    </button>
  );
}
