import ChatLayout from "./components/ChatLayout";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0b0b0b",
        color: "white",
      }}
    >
      {/* CHAT AREA */}
      <div style={{ flex: 1, padding: 20 }}>
        <ChatLayout />
      </div>

      {/* FOOTER */}
      <div
        style={{
          padding: "12px 0",
          fontSize: 12,
          opacity: 0.7,
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        © 2026 Solchat · Built by{" "}
        <a
          href="https://twitter.com/ritmir11"
          target="_blank"
          rel="noreferrer"
          style={{
            color: "white",
            textDecoration: "underline",
          }}
        >
          @ritmir11
        </a>
      </div>
    </div>
  );
}
