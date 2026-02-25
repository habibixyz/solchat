import { Routes, Route, Link, useLocation } from "react-router-dom";
import ChatLayout from "./components/ChatLayout";
import GenesisPage from "./ritual/GenesisPage";

function App() {
  const location = useLocation();
  const isChat = location.pathname === "/chat";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Persistent Header */}
      <div className="fixed top-0 left-0 w-full flex justify-center py-6 z-50">
        <Link
          to="/chat"
          className="text-lg tracking-[0.3em] text-zinc-400 hover:text-white transition"
        >
          SOLCHAT
        </Link>
      </div>

      {/* Page Content */}
      <div className="flex-1 pt-20">
        <Routes>
          <Route path="/" element={<GenesisPage />} />
          <Route path="/chat" element={<ChatLayout />} />
        </Routes>
      </div>

      {/* Footer ONLY on chat */}
      {isChat && (
        <div className="text-center text-xs text-zinc-600 py-6 border-t border-white/10">
          © 2026 Solchat · Built by{" "}
          <a
            href="https://twitter.com/ritmir11"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition"
          >
            @ritmir11
          </a>
        </div>
      )}
    </div>
  );
}

export default App;