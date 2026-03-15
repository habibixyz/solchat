import { Routes, Route, NavLink } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import ChatLayout from "./components/ChatLayout";
import GenesisPage from "./ritual/GenesisPage";
import ManifestoPage from "./pages/ManifestoPage";
import DiscoverPage from "./pages/DiscoverPage";
import TokenPage from "./pages/TokenPage";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 30% 10%, rgba(0,247,255,0.08), transparent 40%), radial-gradient(circle at 70% 0%, rgba(140,100,255,0.08), transparent 40%), radial-gradient(circle at top, #0f172a, #000)",
        color: "#cbd5f5",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "14px 20px",
          alignItems: "center",
          flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(90deg, rgba(0,247,255,0.05), rgba(140,100,255,0.05))",
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 40px rgba(0,247,255,0.08)",
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            letterSpacing: "2px",
            color: "#00f7ff",
            textShadow: "0 0 10px rgba(0,247,255,0.7)",
          }}
        >
          SOLCHAT <span style={{ opacity: 0.6 }}>BETA</span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <NavLink style={{ color: "#cbd5f5", textDecoration: "none", fontSize: "14px", opacity: 0.8 }} to="/">Sigil</NavLink>
          <NavLink style={{ color: "#cbd5f5", textDecoration: "none", fontSize: "14px", opacity: 0.8 }} to="/chat">Chat</NavLink>
          <NavLink style={{ color: "#cbd5f5", textDecoration: "none", fontSize: "14px", opacity: 0.8 }} to="/manifesto">Manifesto</NavLink>
          <NavLink style={{ color: "#cbd5f5", textDecoration: "none", fontSize: "14px", opacity: 0.8 }} to="/discover">Discover</NavLink>

          {/* ✅ Replaced custom button with wallet adapter button */}
          <WalletMultiButton
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              background: "#00f7ff",
              color: "#000",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
              height: "36px",
            }}
          />
        </div>
      </header>

      {/* MAIN ROUTES */}
      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
        }}
      >
        <Routes>
          <Route path="/" element={<GenesisPage />} />
          <Route path="/chat" element={<ChatLayout />} />
          <Route path="/manifesto" element={<ManifestoPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/token/:address" element={<TokenPage />} />
          <Route path="/manifesto" element={
  <div style={{ width: "100%", alignSelf: "stretch" }}>
    <ManifestoPage />
  </div>
} />
        </Routes>
      </main>

      {/* FOOTER */}
      <footer style={{ textAlign: "center", padding: "16px", opacity: 0.6, fontSize: "12px" }}>
        © 2026 · Solchat.fun · Built by{" "}
        <a href="https://twitter.com/ritmir11" target="_blank" rel="noreferrer">
          @ritmir11
        </a>
      </footer>
    </div>
  );
}