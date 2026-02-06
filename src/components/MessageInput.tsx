import { useState } from "react";
import { supabase } from "../supabase";

export default function Composer({ username }: { username: string }) {
  const [text, setText] = useState("");

  const send = async () => {
    if (!text.trim()) return;

    const { error } = await supabase.from("messages").insert({
      username,
      text,
    });

    if (error) console.error(error);
    setText("");
  };

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={send}>Send</button>
    </div>
  );
}
