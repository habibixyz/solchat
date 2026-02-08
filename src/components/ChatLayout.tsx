import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

export default function ChatLayout() {
  // Get current user from localStorage (profile page edits this)
  const currentUser =
    JSON.parse(localStorage.getItem("solchat_profile") || "{}")?.name ||
    "guest";

  return (
    <div style={styles.wrapper}>
  {/* CA BAR */}
  <div
    style={{
      textAlign: "center",
      fontWeight: 700,
      fontSize: 14,
      padding: "10px 0",
      marginBottom: 8,
      color: "#ffffff",
      letterSpacing: 0.4,
      textShadow:
        "0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    CA: GgKtQGBBEEjXbtaptvSmVFFDYiQrc6TGZMt2HS1cBAGS
  </div>

  <ChatWindow />
  <MessageInput currentUser={currentUser} />
</div>
  );
}

const styles = {
  wrapper: {
    maxWidth: 720,
    margin: "0 auto",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: "12px 16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  },
} as const;
