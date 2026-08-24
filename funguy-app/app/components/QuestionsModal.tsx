"use client";

import Image from "next/image";
import { Topic } from "../types";

interface QuestionsModalProps {
  topic: Topic;
  onAsk: (question: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export default function QuestionsModal({ topic, onAsk, onBack, onClose }: QuestionsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-[var(--color-bg-secondary)] rounded-[18px] w-full max-w-sm p-6" style={{ boxShadow: "0 12px 24px rgba(0,0,0,0.17)" }}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-6 h-6 flex items-center justify-center text-[var(--color-text-secondary)]"
            >
              <Image src="/assets/icon-back.svg" alt="Back" width={16} height={16} />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{topic.label}</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Pick a question to ask</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <Image src="/assets/icon-close.svg" alt="Close" width={16} height={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {topic.questions.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="group flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-[var(--color-bg-primary)] transition-colors"
            >
              <span className="w-4 h-4 flex-shrink-0 rounded-full border-2 border-[var(--color-border-strong)] group-hover:border-[var(--color-green-600)] transition-colors" />
              <span className="text-sm text-[var(--color-text-primary)]">{q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
