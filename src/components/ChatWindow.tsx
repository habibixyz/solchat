import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Message = {
  id: number;
  username: string;
  text: string;
  created_at: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);

  // Load existing messages ONCE
  useEffect(() => {
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data);
      });
  }, []);

  // REALTIME
  useEffect(() => {
    const channel = supabase
      .channel("messages-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("NEW MESSAGE:", payload.new);
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <b>{m.username}</b>: {m.text}
        </div>
      ))}
    </div>
  );
}
