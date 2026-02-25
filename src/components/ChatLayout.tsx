import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

export default function ChatLayout() {
  const currentUser =
    JSON.parse(localStorage.getItem("solchat_profile") || "{}")?.name ||
    "guest";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        background:
          "linear-gradient(120deg, #05070f, #0b1225, #05070f)",
        backgroundSize: "300% 300%",
        animation: "bgMove 18s ease infinite",
      }}
    >
      {/* CENTER CHAT COLUMN */}
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          background: "rgba(8,12,25,0.85)",
          backdropFilter: "blur(14px)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
      <div className="text-center py-6 border-b border-white/5">
</div>

        {/* CHAT */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ChatWindow />
        </div>

        {/* INPUT */}
        <MessageInput currentUser={currentUser} />
      </div>

      {/* INLINE KEYFRAMES — CANNOT FAIL */}
      <style>{`
        @keyframes bgMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
