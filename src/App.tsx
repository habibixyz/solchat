import { Routes, Route, Link, useLocation } from "react-router-dom";
import ChatLayout from "./components/ChatLayout";
import GenesisPage from "./ritual/GenesisPage";

function App() {
  const location = useLocation();
  const isChat = location.pathname === "/chat";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Premium Fixed Header */}
      <header className="fixed top-0 left-0 w-full z-[100] bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="flex justify-center py-6">
          <Link
            to="/chat"
            className="flex items-center gap-3 group"
          >
            <span className="text-lg tracking-[0.35em] font-light text-zinc-400 group-hover:text-white transition">
              SOLCHAT
            </span>

            <span className="text-[10px] px-2 py-1 rounded bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 tracking-widest">
              BETA
            </span>
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 pt-24">
        <Routes>
          <Route path="/" element={<GenesisPage />} />
          <Route path="/chat" element={<ChatLayout />} />
        </Routes>
      </main>

      {/* Footer only on Chat */}
      {isChat && (
        <footer className="text-center text-xs text-zinc-600 py-6 border-t border-white/10">
          © 2026 Solchat · Built by{" "}
          <a
            href="https://twitter.com/ritmir11"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition"
          >
            @ritmir11
          </a>
        </footer>
      )}
    </div>
  );
}

export default App;