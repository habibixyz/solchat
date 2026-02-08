import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

export default function ChatLayout() {
  // Get current user from localStorage (profile page edits this)
  const currentUser =
    JSON.parse(localStorage.getItem("solchat_profile") || "{}")?.name ||
    "guest";

  return (
    <div style={styles.wrapper}>
      {/* Feed */}
      <ChatWindow />

      {/* Composer */}
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
};

