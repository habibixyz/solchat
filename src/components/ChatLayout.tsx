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
    padding: "16px",
    paddingBottom: 100, // space for fixed composer
  },
};
