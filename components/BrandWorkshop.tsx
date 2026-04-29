"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string };

const TOOL_META = {
  vision: {
    label: "Vision",
    num: "01",
    tagline: "The why behind everything you do.",
    intro: "Let's start by getting to know you a little. You can share your website URL, any brand documents you have, or just dive in. The more you share, the better I can help.\n\nFirst, do you have a website you'd like to share?",
    next: { href: "/brand-builder/value", label: "Value" },
  },
  value: {
    label: "Value",
    num: "02",
    tagline: "What makes you irreplaceable.",
    intro: "This session is your time to BRAG, and I mean that. We're going to uncover everything that makes you uniquely valuable. Don't be modest.\n\nBefore we start, if you have your Vision summary from the last session, feel free to paste it here so I can reference it. Otherwise, let's just dive in.\n\nFirst question: What formal education or certifications do you have?",
    next: { href: "/brand-builder/voice", label: "Voice" },
  },
  voice: {
    label: "Voice",
    num: "03",
    tagline: "The words your clients need to hear.",
    intro: "Finding your voice means finding the words that sound like you and resonate with your ideal clients. If you have your Vision and Value summaries, paste them here and they'll help me guide you better.\n\nLet's start: Who do you help? (We'll build your 'I Help' statement from here.)",
    next: { href: "/brand-builder/visuals", label: "Visuals" },
  },
  visuals: {
    label: "Visuals",
    num: "04",
    tagline: "A look that stops the scroll.",
    intro: "Before we dig in: how confident do you feel about your visual identity right now? Are you a complete beginner, somewhat confident, or do you already have a strong vision?\n\nAlso, if you have a logo, hex colors, or any reference photos you love, feel free to describe them. Let's build something beautiful.",
    next: { href: "/brand-builder/visibility", label: "Visibility" },
  },
  visibility: {
    label: "Visibility",
    num: "05",
    tagline: "Where and how you show up.",
    intro: "In this session we're going to figure out exactly where you should be showing up online, what kind of content will work best for you, and what photos you need.\n\nLet's start with the most important question: Who is your ideal client, and where do they hang out online?",
    next: null,
  },
};

export default function BrandWorkshop({ tool }: { tool: string }) {
  const meta = TOOL_META[tool as keyof typeof TOOL_META];
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: meta.intro },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveProgress = useCallback(
    async (msgs: Message[]) => {
      try {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool, messages: msgs, completed: false }),
        });
      } catch {
        // Silently fail; progress saving is non-critical
      }
    },
    [tool]
  );

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, tool }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantText };
          return updated;
        });
      }

      // Auto-save after each exchange
      const finalMessages: Message[] = [
        ...newMessages,
        { role: "assistant", content: assistantText },
      ];
      saveProgress(finalMessages);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[#E8E0D6] bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-[#C9A96E] tracking-[0.2em]">{meta.num}</span>
            <h1
              className="text-xl font-light text-[#2B2B2B]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {meta.label}
            </h1>
          </div>
          <p className="text-xs text-[#6B6560]">{meta.tagline}</p>
        </div>
        <div className="flex items-center gap-3">
          {meta.next && (
            <span className="text-xs text-[#6B6560]">
              Next: {meta.next.label} →
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                msg.role === "assistant"
                  ? "bg-[#2B2B2B] text-[#C9A96E]"
                  : "bg-[#AF493B] text-white"
              }`}
            >
              {msg.role === "assistant" ? "L" : "You"}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[75%] rounded-lg px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "assistant"
                  ? "bg-white border border-[#E8E0D6] text-[#2B2B2B]"
                  : "bg-[#AF493B] text-white"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#2B2B2B] text-[#C9A96E] flex items-center justify-center text-xs font-medium">
              L
            </div>
            <div className="bg-white border border-[#E8E0D6] rounded-lg px-5 py-4">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#C9A96E] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#E8E0D6] bg-white px-4 md:px-8 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-[#E8E0D6] bg-[#FAF7F2] px-4 py-3 text-sm text-[#2B2B2B] placeholder:text-[#6B6560]/50 focus:outline-none focus:border-[#AF493B]/40 focus:ring-1 focus:ring-[#AF493B]/20 transition-colors"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 h-[70px] px-5 bg-[#AF493B] text-white text-sm rounded-lg hover:bg-[#9D4134] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-[10px] text-[#6B6560]/50 mt-2 text-center">
          Your responses are saved automatically to your Brand Guide
        </p>
      </div>
    </div>
  );
}
