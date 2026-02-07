import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Message = {
  id: number;
  username: string;
  text: string;
  created_at: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);

  // 1️⃣ Initial fetch
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

  // 2️⃣ REALTIME SUBSCRIPTION (THIS IS THE FIX)
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("🔥 REALTIME MESSAGE:", payload.new);
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe((status) => {
        console.log("📡 SUB STATUS:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.username}</strong>: {m.text}
        </div>
      ))}
    </div>
  );
}
