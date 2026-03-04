import SwapDrawer from "./SwapDrawer";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
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
  const [profileName, setProfileName] = useState(
    localStorage.getItem("solchat_name") || "guest"
  );
  const [oldestDate, setOldestDate] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

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
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
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

    const messageText = newMessage;
    setNewMessage("");

    await supabase.from("messages").insert([
      {
        username: profileName,
        text: messageText,
      },
    ]);
  };

  const changeName = () => {
    const name = prompt("Enter display name:");
    if (!name) return;
    localStorage.setItem("solchat_name", name);
    setProfileName(name);
  };

  // ---------------- TOKEN TEST ----------------
const renderText = (text: string) => {
  const parts = text.split(
    /(\$[A-Z]{2,10}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/g
  );

  return parts.map((part, i) => {
    // Mint address detection
    if (MINT_REGEX.test(part)) {
  return (
    <span
      key={i}
      className="token-chip"
      onClick={() => {
        console.log("Opening swap for:", part);
        setActiveMint(part);
      }}
    >
      {part.slice(0, 4)}...{part.slice(-4)}
    </span>
  );
}

    // Ticker detection
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
  <div className="chat-wrapper">

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
          className={`message ${
            msg.username === profileName ? "me" : ""
          }`}
        >
          <div className="meta">{msg.username}</div>
          <div className="text">{renderText(msg.text)}</div>
        </div>
      ))}
    </div>

    {/* Input */}
    <div className="chat-input">
      <input
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Type..."
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
      />
      <button onClick={handleSend}>Send</button>
    </div>

    {/* Swap Drawer */}
    {activeMint && (
      <SwapDrawer
        mint={activeMint}
        onClose={() => setActiveMint(null)}
      />
    )}

  </div>
);
}