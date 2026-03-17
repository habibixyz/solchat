import { useEffect, useState, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { supabase } from "../lib/supabase";
import { sendPaidMessage } from "../services/sendMessage";
import SwapDrawer from "./SwapDrawer";
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
  const [profileName, setProfileName] = useState("guest");
  const [oldestDate, setOldestDate] = useState<string | null>(null);
  const [nameClaiming, setNameClaiming] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wallet = useWallet();
  const { connection } = useConnection();

  // ✅ Load username from Supabase when wallet connects
  useEffect(() => {
    const loadUsername = async () => {
      if (!wallet.publicKey) {
        setProfileName("guest");
        return;
      }

      const walletAddr = wallet.publicKey.toString();

      const { data } = await supabase
        .from("usernames")
        .select("username")
        .eq("wallet_address", walletAddr)
        .maybeSingle();

      if (data?.username) {
        setProfileName(data.username);
        localStorage.setItem("solchat_name", data.username);
      } else {
        // Wallet connected but no username claimed yet
        const saved = localStorage.getItem("solchat_name");
        setProfileName(saved || "guest");
      }
    };

    loadUsername();
  }, [wallet.publicKey]);

  // ✅ Claim or update username — checks uniqueness
  const changeName = async () => {
    if (!wallet.publicKey) {
      alert("Connect your wallet first to claim a username");
      return;
    }

    const name = prompt("Enter display name (3-20 chars):");
    if (!name) return;
    if (name.length < 3 || name.length > 20) {
      alert("Username must be 3-20 characters");
      return;
    }

    setNameClaiming(true);
    const walletAddr = wallet.publicKey.toString();

    try {
      // Check if username is taken by another wallet
      const { data: existing } = await supabase
        .from("usernames")
        .select("wallet_address")
        .eq("username", name)
        .single();

      if (existing && existing.wallet_address !== walletAddr) {
        alert(`"${name}" is already taken. Choose another.`);
        return;
      }

      // Upsert — insert or update
      const { error } = await supabase
        .from("usernames")
        .upsert({
          wallet_address: walletAddr,
          username: name,
        }, { onConflict: "wallet_address" });

      if (error) throw error;

      setProfileName(name);
      localStorage.setItem("solchat_name", name);
      alert(`✅ Username "${name}" claimed!`);

    } catch (err: any) {
      console.error(err);
      alert("Failed to claim username. Try again.");
    } finally {
      setNameClaiming(false);
    }
  };

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    if (!wallet.publicKey) {
      alert("Connect your wallet to post — it costs 0.001 SOL");
      return;
    }
    const messageText = newMessage;
    try {
      setLoading(true);
      setNewMessage("");
      await sendPaidMessage(wallet, connection, messageText, profileName);
    } catch (err: any) {
      console.error("PAYMENT ERROR:", err);
      setNewMessage(messageText);
      alert(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- TOKEN DETECTION ----------------
  const renderText = (text: string) => {
    const parts = text.split(/(\$[A-Z]{2,10}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/g);
    return parts.map((part, i) => {
      if (MINT_REGEX.test(part)) {
        return (
          <span key={i} className="token-chip" onClick={() => setActiveMint(part)}>
            {part.slice(0, 4)}...{part.slice(-4)}
          </span>
        );
      }
      if (TICKER_REGEX.test(part)) {
        return (
          <span key={i} className="token-chip" onClick={() => alert(`Ticker clicked: ${part}`)}>
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
      <div className="chat-header">
        <span>GLOBAL SIGNAL</span>
        <button onClick={changeName} disabled={nameClaiming}>
          {nameClaiming ? "claiming..." : profileName}
          {wallet.publicKey && profileName === "guest" && (
            <span style={{ color: "#00f7ff", fontSize: "10px", marginLeft: "6px" }}>
              · claim name
            </span>
          )}
        </button>
      </div>

      <div className="chat-feed" ref={scrollRef}>
        {oldestDate && (
          <div className="load-older" onClick={loadOlder}>
            Load older messages
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.username === profileName ? "me" : ""} ${msg.username === "AI" ? "ai-message" : ""}`}>
            <div className="meta">
              {msg.username === "AI" ? "🤖 SolChat AI" : msg.username}
            </div>
            <div className="text">{renderText(msg.text)}</div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={wallet.publicKey ? "Type... use @ai to ask the AI" : "Connect wallet to post"}
          disabled={loading}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSend(); }}
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? "Posting..." : "Send (0.001◎)"}
        </button>
      </div>

      {activeMint && (
        <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />
      )}
    </div>
  );
}