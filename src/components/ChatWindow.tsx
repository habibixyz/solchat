import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  id: number;
  username: string;
  text: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);

  // Initial fetch
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, username, text")
        .order("id", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      if (data) {
        setMessages(data as Message[]);

        // Jump to bottom once on load
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
          hasMountedRef.current = true;
        });
      }
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
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Smart auto-scroll (only if user is near bottom)
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
        height: "100%",
        overflowY: "auto",
        padding: "8px 4px",
      }}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            padding: "12px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {/* Username */}
          <div style={{ color: "#7aa2ff", fontWeight: 600, fontSize: 13 }}>
            {m.username}
          </div>

          {/* Message */}
          <div
            style={{
              marginTop: 2,
              fontSize: 15,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
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
