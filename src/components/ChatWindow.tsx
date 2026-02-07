import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Message = {
  username: string;
  text: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const channel = supabase.channel("solchat-room");

    channel
      .on("broadcast", { event: "message" }, (payload) => {
        setMessages((prev) => [...prev, payload.payload as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>
          <b>{m.username}</b>: {m.text}
        </div>
      ))}
    </div>
  );
}
