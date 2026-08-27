"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Header from "./components/Header";
import TopicModal from "./components/TopicModal";
import QuestionsModal from "./components/QuestionsModal";
import MessageView from "./components/MessageView";
import LoadingScreen from "./components/LoadingScreen";
import { Topic, Message } from "./types";
import funGuyData from "../content/fun-guy.json";

type Modal = null | { type: "topics" } | { type: "questions"; topic: Topic };

const GREETING = "Hello, friend! I'm the mycelium network beneath your feet. I've been listening, growing and connecting everything for millions of years. What would you like to know about me?";

export default function Home() {
  const [intro, setIntro] = useState(true);
  const [view, setView] = useState<"home" | "chat" | "message">("home");
  const [modal, setModal] = useState<Modal>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [askedQuestions, setAskedQuestions] = useState<Record<string, number[]>>({});
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const greetingMsg: Message = { role: "assistant", content: GREETING };
    const isFirstMessage = messages.length === 0;
    const next = [...(isFirstMessage ? [greetingMsg] : messages), userMsg];
    setMessages(next);
    setInput("");
    setModal(null);
    setView("chat");
    setLoading(true);

    try {
      const [res] = await Promise.all([
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        }),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
      const data = await (res as Response).json();
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "The network is quiet right now. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function sendTopicQuestion(topicId: string) {
    const topic = (funGuyData.topics as Topic[]).find((t) => t.id === topicId);
    if (!topic) return;

    const usedIndices = askedQuestions[topicId] ?? [];
    const unusedIndices = topic.questions
      .map((_, i) => i)
      .filter((i) => !usedIndices.includes(i));

    if (unusedIndices.length === 0) return;

    const pick = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
    setAskedQuestions((prev) => ({
      ...prev,
      [topicId]: [...(prev[topicId] ?? []), pick],
    }));
    sendMessage(topic.questions[pick].question);
  }

  return (
    <div className="flex flex-col h-full w-full relative">
      {intro && <LoadingScreen onEnter={() => setIntro(false)} />}
      <Header
        view={view}
        onPickTopic={() => setModal({ type: "topics" })}
        onShowChat={() => setView(messages.length === 0 ? "home" : "chat")}
        onShowMessage={() => setView("message")}
      />

      <main className={`flex-1 min-h-0 ${view === "message" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {view === "home" && <HomeView onQuestion={sendMessage} />}
        {view === "chat" && (
          <ChatView messages={messages} loading={loading} bottomRef={messagesEndRef} />
        )}
        {view === "message" && (
          <MessageView
            onEnd={() => {
              setMessages([]);
              setAskedQuestions({});
              setView("home");
            }}
          />
        )}
      </main>

      {view === "chat" && (
        <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] pt-4 pb-3 flex flex-col gap-3">
          {/* Topic chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-6">
            {(funGuyData.topics as Topic[]).map((topic) => {
              const used = askedQuestions[topic.id]?.length ?? 0;
              const exhausted = used >= topic.questions.length;
              return (
                <button
                  key={topic.id}
                  disabled={exhausted || loading}
                  onClick={() => sendTopicQuestion(topic.id)}
                  className={`px-4 py-2 rounded-full shrink-0 text-sm whitespace-nowrap border transition-all ${
                    exhausted
                      ? "bg-[#e4e4e7] border-[#e7e0dd] text-white cursor-not-allowed"
                      : loading
                      ? "bg-[#f1ffc6] border-[#d6f085] text-[#1b4734] opacity-50"
                      : "bg-[#f1ffc6] border-[#d6f085] text-[#1b4734] hover:opacity-80 active:scale-95"
                  }`}
                >
                  {topic.label}
                </button>
              );
            })}
          </div>

          {/* Free-text input pill */}
          <div className="px-6">
            <div className="flex items-center gap-3 bg-[var(--color-surface-default)] border border-[var(--color-border-default)] rounded-full h-[54px] pl-5 pr-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder="Ask the mycelium..."
                className="flex-1 bg-transparent outline-none text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)]"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-[38px] h-[38px] rounded-full bg-[var(--color-interactive-primary)] flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity hover:opacity-90"
              >
                <Image src="/assets/icon-arrow-up.svg" alt="Send" width={18} height={18} />
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-[var(--color-text-placeholder)]">
            Built by Gayathri, Mintra and Fonda
          </p>
        </footer>
      )}

      {modal?.type === "topics" && (
        <TopicModal
          topics={funGuyData.topics as Topic[]}
          onSelect={(topic) => setModal({ type: "questions", topic })}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "questions" && (
        <QuestionsModal
          topic={modal.topic}
          onAsk={sendMessage}
          onBack={() => setModal({ type: "topics" })}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const STARTER_QUESTIONS = [
  "What is mycelium?",
  "What does a healthy life look like for you?",
  "What do you want humans to know about you?",
  "Tell me how you help humans in 2075",
];

function HomeView({ onQuestion }: { onQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center px-8 pt-10">
      <div className="w-full mb-6">
        <div className="flex justify-center mb-4">
          <span className="text-xs font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] rounded-full px-3 py-1">
            Today, 19 Aug 2075
          </span>
        </div>
        <p className="text-xl font-medium text-[var(--color-text-primary)] text-center leading-snug">
          Hello, friend! I&apos;m the mycelium network beneath your feet. I&apos;ve been listening,
          growing and connecting everything for millions of years. What would you like to know about
          me?
        </p>
      </div>

      <div className="my-4 flex justify-center">
        <Image
          src="/assets/mushroom-home.png"
          alt="mycelium"
          width={164}
          height={89}
          className="object-contain"
        />
      </div>

      <div className="flex flex-col items-center gap-2 mt-4 w-full">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onQuestion(q)}
            className="px-4 py-2 rounded-full border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-default)] hover:border-[var(--color-green-600)] hover:text-[var(--color-green-900)] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatView({
  messages,
  loading,
  bottomRef,
}: {
  messages: Message[];
  loading: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex justify-center mb-2">
        <span className="text-xs font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] rounded-full px-3 py-1">
          Today, 19 Aug 2075
        </span>
      </div>

      {messages.map((msg, i) =>
        msg.role === "assistant" ? (
          <ReceivedBubble key={i} text={msg.content} />
        ) : (
          <SentBubble key={i} text={msg.content} />
        )
      )}

      {loading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

function ReceivedBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[80%] self-start">
      <div className="bg-[var(--color-surface-default)] rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] text-[var(--color-text-primary)] leading-relaxed shadow-sm">
        {text}
      </div>
    </div>
  );
}

function SentBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[80%] self-end">
      <div className="bg-[var(--color-interactive-primary)] rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] text-[var(--color-text-accent)] leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="self-start">
      <div className="bg-[var(--color-surface-default)] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
