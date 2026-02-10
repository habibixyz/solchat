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

    const { error } = await supabase.from("messages").insert({
      username: currentUser,
      text: text.trim(),
    });

    if (!error) setText("");
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening?"
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: 8,
          border: "none",
          background: "#1f2937",
          color: "white",
        }}
        onKeyDown={(e) => e.key === "Enter" && send()}
      />
      <button
        onClick={send}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          background: "#6366f1",
          color: "white",
          border: "none",
        }}
      >
        Post
      </button>
    </div>
  );
}
