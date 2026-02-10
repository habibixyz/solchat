import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  id: string;
  username: string;
  text: string;
};

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

  // Realtime inserts (deduped)
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
    <div style={{ overflowY: "auto", flex: 1 }}>
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
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.4,
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
