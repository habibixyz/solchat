import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  id: string;
  username: string;
  text: string;
};

// Shorten wallet addresses for display
function formatUsername(username: string) {
  if (username === "AI") return "🤖 SolChat AI";
  // If it looks like a wallet address (long, no spaces)
  if (username.length > 20 && !username.includes(" ")) {
    return `${username.slice(0, 4)}...${username.slice(-4)}`;
  }
  return username;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, username, text")
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
        requestAnimationFrame(() =>
          bottomRef.current?.scrollIntoView({ behavior: "auto" })
        );
      }
    };

    loadMessages();
  }, []);

  // Realtime messages
  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          requestAnimationFrame(() =>
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div
      style={{
        overflowY: "auto",
        flex: 1,
        minHeight: 0,
        padding: "20px",
      }}
    >
      {messages.map((m) => {
        const isAI = m.username === "AI";

        return (
          <div
            key={m.id}
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              borderRadius: isAI ? 8 : 0,
              marginBottom: isAI ? 8 : 0,
              // ✅ AI messages get a subtle highlight, user messages unchanged
              background: isAI
                ? "rgba(99, 102, 241, 0.08)"
                : "transparent",
              borderLeft: isAI
                ? "2px solid #6366f1"
                : "none",
            }}
          >
            <div
              style={{
                color: isAI ? "#a5b4fc" : "#7aa2ff",
                fontWeight: 600,
                fontSize: isAI ? 13 : 14,
                marginBottom: 2,
              }}
            >
              {formatUsername(m.username)}
            </div>

            <div
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: 1.4,
                color: isAI ? "#e2e8f0" : "inherit",
              }}
            >
              {m.text}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}