import SwapDrawer from "./SwapDrawer";
import { useEffect, useState, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { supabase } from "../lib/supabase";
import { sendPaidMessage } from "../services/sendMessage";
import { MINT_REGEX, TICKER_REGEX } from "../utils/tokenDetector";

interface Message {
  id: string;
  username: string;
  text: string;
  created_at: string;
}

const LIMIT = 20;

export default function ChatLayout() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileName, setProfileName] = useState(
    localStorage.getItem("solchat_name") || "guest"
  );
  const [oldestDate, setOldestDate] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ✅ Get wallet
  const wallet = useWallet();
  const { connection } = useConnection();

  // ---------------- FETCH LATEST ----------------
  const fetchLatest = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (error) return console.error(error);

    if (data) {
      const reversed = data.reverse();
      setMessages(reversed);
      setOldestDate(reversed[0]?.created_at || null);
    }
  };

  // ---------------- LOAD OLDER ----------------
  const loadOlder = async () => {
    if (!oldestDate) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .lt("created_at", oldestDate)
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (error) return console.error(error);

    if (data && data.length > 0) {
      const reversed = data.reverse();
      setMessages((prev) => [...reversed, ...prev]);
      setOldestDate(reversed[0].created_at);
    }
  };

  // ---------------- REALTIME ----------------
  useEffect(() => {
    fetchLatest();

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---------------- AUTO SCROLL ----------------
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ---------------- SEND ----------------
  const handleSend = async () => {
    if (!newMessage.trim()) return;

    // ✅ Must have wallet connected
    if (!wallet.publicKey) {
      alert("Connect your wallet to post — it costs 0.001 SOL");
      return;
    }

    const messageText = newMessage;

    try {
      setLoading(true);
      setNewMessage(""); // clear immediately for UX

      // ✅ Pay + save + trigger AI — all in sendPaidMessage
      // Saves with wallet address but displays profileName in UI via local state
      await sendPaidMessage(wallet, connection, messageText, profileName);

    } catch (err: any) {
      console.error(err);
      setNewMessage(messageText); // restore if failed
      alert("Payment failed or cancelled");
    } finally {
      setLoading(false);
    }
  };

  const changeName = () => {
    const name = prompt("Enter display name:");
    if (!name) return;
    localStorage.setItem("solchat_name", name);
    setProfileName(name);
  };

  // ---------------- TOKEN DETECTION ----------------
  const renderText = (text: string) => {
    const parts = text.split(
      /(\$[A-Z]{2,10}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/g
    );

    return parts.map((part, i) => {
      if (MINT_REGEX.test(part)) {
        return (
          <span
            key={i}
            className="token-chip"
            onClick={() => setActiveMint(part)}
          >
            {part.slice(0, 4)}...{part.slice(-4)}
          </span>
        );
      }
      if (TICKER_REGEX.test(part)) {
        return (
          <span
            key={i}
            className="token-chip"
            onClick={() => alert(`Ticker clicked: ${part}`)}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // ---------------- UI ----------------
  return (
    <div className="chat-wrapper solchat-page">
      {/* Header */}
      <div className="chat-header">
        <span>GLOBAL SIGNAL</span>
        <button onClick={changeName}>{profileName}</button>
      </div>

      {/* Feed */}
      <div className="chat-feed" ref={scrollRef}>
        {oldestDate && (
          <div className="load-older" onClick={loadOlder}>
            Load older messages
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.username === profileName ? "me" : ""} ${
              msg.username === "AI" ? "ai-message" : ""
            }`}
          >
            {/* ✅ AI gets special label, others show username as-is */}
            <div className="meta">
              {msg.username === "AI" ? "🤖 SolChat AI" : msg.username}
            </div>
            <div className="text">{renderText(msg.text)}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="chat-input">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={
            wallet.publicKey
              ? "Type... use @ai to ask the AI"
              : "Connect wallet to post"
          }
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleSend();
          }}
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? "Posting..." : "Send (0.001◎)"}
        </button>
      </div>

      {/* Swap Drawer */}
      {activeMint && (
        <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />
      )}
    </div>
  );
}