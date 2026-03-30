import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { sendPaidMessage } from "../services/sendMessage";

export default function MessageInput({
  currentUser,
}: {
  currentUser: string;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const { connection } = useConnection();
  const wallet = useWallet();

  const send = async () => {
    if (!text.trim()) return;

    if (!wallet.publicKey) {
      alert("Connect wallet first");
      return;
    }

    try {
      setLoading(true);
      // ✅ Pass text into sendPaidMessage — it handles saving + AI trigger
      await sendPaidMessage(wallet, connection, text.trim());
      setText(""); // clear only on success
    } catch (err) {
      console.error(err);
      alert("Payment failed or cancelled");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message... use @ai to ask the AI"
        disabled={loading}
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: 8,
          border: "none",
          background: "#1f2937",
          color: "white",
          opacity: loading ? 0.6 : 1,
        }}
        onKeyDown={(e) => e.key === "Enter" && !loading && send()}
      />

      <button
        onClick={send}
        disabled={loading}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          background: loading ? "#4b5563" : "#6366f1",
          color: "white",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          minWidth: 120,
        }}
      >
        {loading ? "Posting..." : "Post (0.001 SOL)"}
      </button>
    </div>
  );
}
