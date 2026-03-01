import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

interface Message {
  id: string;
  username: string;
  text: string;
  created_at: string;
}

const LIMIT = 20;

function ChatLayout() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profileName, setProfileName] = useState(
    localStorage.getItem("solchat_name") || "guest"
  );
  const [oldestDate, setOldestDate] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load latest 20
  const fetchLatest = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (error) return console.error(error);

    if (data) {
      const reversed = data.reverse(); // so oldest → newest visually
      setMessages(reversed);
      setOldestDate(reversed[0]?.created_at || null);
    }
  };

  // Load older messages
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

  useEffect(() => {
    fetchLatest();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          username: profileName,
          text: newMessage,
        },
      ]);

    if (error) return alert(error.message);

    setNewMessage("");
    fetchLatest();
  };

  const changeName = () => {
    const name = prompt("Enter display name:");
    if (!name) return;
    localStorage.setItem("solchat_name", name);
    setProfileName(name);
  };

  return (
    <div className="chat-wrapper">

      <div className="chat-header">
        <span>GLOBAL SIGNAL</span>
        <button onClick={changeName}>{profileName}</button>
      </div>

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
            <div className="text">{msg.text}</div>
          </div>
        ))}
      </div>

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

    </div>
  );
}

export default ChatLayout;