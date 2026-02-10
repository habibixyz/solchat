import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function MessageInput({
  currentUser,
}: {
  currentUser: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim() || sending) return;

    setSending(true);

    const { error } = await supabase.from("messages").insert({
      username: currentUser || "guest",
      text: text.trim(),
    });

    setSending(false);

    if (!error) {
      setText("");
    } else {
      console.error("Insert failed:", error);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        paddingTop: 10,
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening?"
        style={{
          flex: 1,
          padding: "10px 12px",
          borderRadius: 10,
          border: "none",
          outline: "none",
          background: "#1e2633",
          color: "#fff",
        }}
        onKeyDown={(e) => e.key === "Enter" && send()}
      />

      <button
        onClick={send}
        disabled={sending}
        style={{
          padding: "0 16px",
          borderRadius: 10,
          background: "#6c6cff",
          border: "none",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Post
      </button>
    </div>
  );
}
