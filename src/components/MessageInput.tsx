import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function MessageInput({
  currentUser,
}: {
  currentUser: string;
}) {
  const [text, setText] = useState("");

  const send = async () => {
    if (!text.trim()) return;

    await supabase.from("messages").insert({
      username: currentUser,
      text,
    });

    setText("");
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="What's happening?"
        style={{ flex: 1 }}
      />
      <button onClick={send}>Post</button>
    </div>
  );
}
