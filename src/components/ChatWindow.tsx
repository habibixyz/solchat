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

  // 1️⃣ Load existing messages once
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    loadMessages();
  }, []);

  // 2️⃣ Realtime subscription (INSERT only)
  useEffect(() => {
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3️⃣ Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {messages.map((m) => (
        <div key={m.id} style={{ padding: "12px 0" }}>
          <div style={{ color: "#7aa2ff", fontWeight: 600 }}>
            {m.username}
          </div>
          <div>{m.text}</div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>
            {new Date(m.created_at).toLocaleTimeString()}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
  