import { Routes, Route, NavLink } from "react-router-dom";
import ChatLayout from "./components/ChatLayout";
import GenesisPage from "./ritual/GenesisPage";
import ManifestoPage from "./pages/ManifestoPage";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
  <div className="header-inner">
    <div className="logo">
      SOLCHAT <span className="beta">BETA</span>
    </div>

    <div className="nav-links">
  <NavLink to="/">Sigil</NavLink>
  <NavLink to="/chat">Chat</NavLink>
  <NavLink to="/manifesto">Manifesto</NavLink>
</div>
  </div>
</header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<GenesisPage />} />
          <Route path="/chat" element={<ChatLayout />} />
          <Route path="/manifesto" element={<ManifestoPage />} />
        </Routes>
      </main>

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