"use client";

import Image from "next/image";

interface HeaderProps {
  onPickTopic: () => void;
  onShowChat: () => void;
  onShowMessage: () => void;
  view: "home" | "chat" | "message";
}

export default function Header({ onPickTopic, onShowChat, onShowMessage, view }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 h-14 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
      <button
        onClick={onPickTopic}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
      >
        <Image src="/assets/icon-topic.svg" alt="" width={16} height={16} />
        <span>Questions</span>
      </button>

      <button
        onClick={onShowChat}
        className="hover:opacity-70 transition-opacity"
        aria-label="Go to chat"
      >
        <Image src="/assets/icon-home.svg" alt="fun-guy" width={30} height={30} />
      </button>

      <button
        onClick={onShowMessage}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
          view === "message"
            ? "bg-[var(--color-interactive-primary)] text-white"
            : "border border-[var(--color-border-default)] text-[var(--color-icon-primary)] hover:bg-[var(--color-bg-tertiary)]"
        }`}
      >
        <Image
          src="/assets/icon-message.svg"
          alt=""
          width={16}
          height={16}
          className={view === "message" ? "brightness-0 invert" : ""}
        />
        <span>End Conversation</span>
      </button>
    </header>
  );
}
