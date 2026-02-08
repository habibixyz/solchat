import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  id: number;
  username: string;
  text: string;
  created_at: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial fetch
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (data) setMessages(data as Message[]);
    };

    fetchMessages();
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Smart auto-scroll (only if near bottom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      style={{
        overflowY: "auto",
        padding: "8px 4px",
        height: "100%",
      }}
    >
      {messages.map((m) => (
        <div key={m.id} style={{ padding: "10px 0" }}>
          {/* Username */}
          <div style={{ color: "#7aa2ff", fontWeight: 600 }}>
            {m.username}
          </div>

          {/* Message text (long text safe) */}
          <div
            style={{
              wordWrap: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
              lineHeight: 1.4,
            }}
          >
            {m.text}
          </div>

          {/* Time */}
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {new Date(m.created_at).toLocaleTimeString()}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
