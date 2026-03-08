import { Routes, Route, NavLink } from "react-router-dom";

import ChatLayout from "./components/ChatLayout";
import GenesisPage from "./ritual/GenesisPage";
import ManifestoPage from "./pages/ManifestoPage";
import DiscoverPage from "./pages/DiscoverPage";
import TokenPage from "./pages/TokenPage";

function App() {
  return (
    <div className="app-shell">

      {/* BACKGROUND */}
      <div className="bg-container"></div>
      <div className="bg-overlay"></div>

      {/* FLOATING SIGILS */}
      <div className="sigil-bg">
        <span>✦</span>
        <span>✧</span>
        <span>⟁</span>
        <span>✶</span>
        <span>✦</span>
        <span>⟁</span>
      </div>

      {/* HEADER */}
      <header className="app-header">
        <div className="header-inner">

          <div className="logo">
            SOLCHAT <span className="beta">BETA</span>
          </div>

          <div className="nav-links">
            <NavLink to="/">Sigil</NavLink>
            <NavLink to="/chat">Chat</NavLink>
            <NavLink to="/manifesto">Manifesto</NavLink>
            <NavLink to="/discover">Discover</NavLink>
          </div>

        </div>
      </header>

      {/* MAIN */}
      <main className="app-main discover-root">

        <Routes>
          <Route path="/" element={<GenesisPage />} />
          <Route path="/chat" element={<ChatLayout />} />
          <Route path="/manifesto" element={<ManifestoPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/token/:address" element={<TokenPage />} />
        </Routes>

      </main>

      {/* FOOTER */}
      <footer className="app-footer">
        © 2026 · Solchat.fun · Built by{" "}
        <a
          href="https://twitter.com/ritmir11"
          target="_blank"
          rel="noreferrer"
        >
          @ritmir11
        </a>
      </footer>

    </div>
  );
}

export default App;