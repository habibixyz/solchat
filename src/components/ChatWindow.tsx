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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);

  // 1️⃣ Initial fetch (jump instantly to bottom ONCE)
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (!data) return;

      setMessages(data as Message[]);

      // Jump to bottom once, no animation
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
        hasMountedRef.current = true;
      });
    };

    fetchMessages();
  }, []);

  // 2️⃣ Realtime updates
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

  // 3️⃣ Smart auto-scroll (ONLY after first load)
  useEffect(() => {
    if (!hasMountedRef.current) return;

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
          <div style={{ color: "#7aa2ff", fontWeight: 600 }}>
            {m.username}
          </div>

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

          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {new Date(m.created_at).toLocaleTimeString()}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
