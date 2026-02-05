import { useState } from "react";

export default function Composer({
  onPost,
}: {
  onPost: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onPost(text);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={styles.wrap}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="What's happening?"
        style={styles.input}
      />
      <button onClick={submit} style={styles.button}>
        Post
      </button>
    </div>
  );
}

const styles: any = {
  wrap: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    background: "#111827",
    border: "1px solid #1f2933",
    borderRadius: 12,
    padding: 12,
    color: "#e5e7eb",
    resize: "none",
    minHeight: 48,
  },
  button: {
    background: "#6366f1",
    border: "none",
    color: "white",
    padding: "0 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
};
