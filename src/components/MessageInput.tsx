import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Composer({ username }: { username: string }) {
  const [text, setText] = useState("");

  const send = async () => {
    if (!text.trim()) return;

    // Save to DB (history)
    await supabase.from("messages").insert({
      username,
      text,
    });

    // Broadcast realtime
    const channel = supabase.channel("solchat-room");
    await channel.send({
      type: "broadcast",
      event: "message",
      payload: { username, text },
    });

    setText("");
  };

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={send}>Send</button>
    </div>
  );
}
