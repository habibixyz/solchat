import { Canvas } from "@react-three/fiber";
import World from "./three/World";
import ProfilePage from './pages/ProfilePage';
import { useEffect } from 'react';
import { injectBottomNav } from './utils/injectBottomNav';
import { Routes, Route, NavLink, useLocation, Navigate } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import './styles/mobile-redesign.css';

import ChatLayout from "./components/ChatLayout";
import GenesisPage from "./ritual/GenesisPage";
import DiscoverPage from "./pages/DiscoverPage";
import TokenPage from "./pages/TokenPage";
import { DMPage } from './pages/DMPage';
import MiningPage from './pages/MiningPage';
import AnsemPage from './pages/AnsemPage';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    injectBottomNav();
  }, []);

  const isDiscover =
    location.pathname === "/discover" ||
    location.pathname === "/manifesto" ||
    location.pathname === "/ansem" ||
    location.pathname.startsWith("/token") ||
    location.pathname.startsWith("/blog") ||
    location.pathname.startsWith("/mine");

  const isProfile = location.pathname.startsWith("/profile");

  // Pages that need to scroll freely (not chat)
  const isScrollPage =
    location.pathname === "/manifesto" ||
    location.pathname === "/ansem" ||
    location.pathname.startsWith("/blog") ||
    location.pathname.startsWith("/token");

  return (
    <div className={`sc-app-root${isScrollPage ? ' sc-app-root--scroll' : ''}`}>

      {/* 3D background canvas */}
      <Canvas
        className="sc-3d-canvas"
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
        camera={{ position: [0, 0, 8], fov: 60 }}
      >
        <World />
      </Canvas>

      {/* ── HEADER ── */}
      <header className="sc-header">

        {/* Logo */}
        <div className="sc-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="" style={{ height: '20px', width: '20px', objectFit: 'contain', borderRadius: '4px' }} />
          <span>SOL<span className="sc-logo-accent">CHAT</span></span>
          <span className="sc-logo-beta">BETA</span>
        </div>

        <nav className="sc-desktop-nav">
          <NavLink to="/"          className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>Chat</NavLink>
          <NavLink to="/mine"      className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>Mine ⛏️</NavLink>
          <NavLink to="/discover"  className={({ isActive }) => (isActive || location.pathname.startsWith("/manifesto") || location.pathname.startsWith("/blog")) ? "sc-nav-link active" : "sc-nav-link"}>Discover</NavLink>
          <NavLink to="/ansem"     className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>$ANSEM</NavLink>
        </nav>

        {/* Wallet button */}
        <div className="sc-wallet-wrap">
          <WalletMultiButton className="wallet-btn" />
        </div>

      </header>

      {/* ── MAIN ── */}
      <main className={`sc-main ${isDiscover || isProfile ? "sc-main--full" : "sc-main--center"}`}>
        <Routes>
          <Route path="/"                    element={<ChatLayout />} />
          <Route path="/chat"                element={<Navigate to="/" />} />
          <Route path="/manifesto"           element={<DiscoverPage />} />
          <Route path="/discover"            element={<DiscoverPage />} />
          <Route path="/ansem"               element={<AnsemPage />} />
          <Route path="/token/:address"      element={<TokenPage />} />
          <Route path="/profile/:username"   element={<ProfilePage />} />
          <Route path="/blog"                element={<DiscoverPage />} />
          <Route path="/blog/:slug"          element={<DiscoverPage />} />
          <Route path="/dm"                  element={<ChatLayout />} />
          <Route path="/mine"                element={<MiningPage />} />
          <Route path="/trending"            element={<ChatLayout />} />
          <Route path="/notifications"       element={<ChatLayout />} />
          <Route path="/profile/me"          element={<ProfilePage />} />
          <Route path="/genesis"             element={<GenesisPage />} />
        </Routes>
      </main>

      {/* Footer — desktop only, not on discover */}
      {!isDiscover && (
        <footer className="sc-footer">
          © 2026 · Solchat.fun · Built by{" "}
          <a href="https://twitter.com/ritmir11" target="_blank" rel="noreferrer">@ritmir11</a>
          {" · "}
          <a href="https://gitlab.com/tanizcoldz/solchat.fun" target="_blank" rel="noreferrer">GitLab</a>
        </footer>
      )}

      {/* ── BOTTOM NAV — rendered by injectBottomNav, NOT here ── */}

    </div>
  );
}
