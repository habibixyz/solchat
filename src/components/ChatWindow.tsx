import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  id: string;          // UUID
  username: string;
  text: string;
  created_at: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 1️⃣ Initial fetch (stable)
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, username, text, created_at")
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        });
      }
    };

    fetchMessages();
  }, []);

  // 2️⃣ Realtime INSERTS (deduped)
  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = payload.new as Message;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          });
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
        flex: 1,
        overflowY: "auto",
        padding: "8px 6px",
      }}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            padding: "10px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ color: "#7aa2ff", fontWeight: 600 }}>
            {m.username}
          </div>

          <div
            style={{
              wordWrap: "break-word",
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
            }}
          >
            {m.text}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
