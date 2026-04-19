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
import ManifestoPage from "./pages/ManifestoPage";
import DiscoverPage from "./pages/DiscoverPage";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import TokenPage from "./pages/TokenPage";
import { DMPage } from './pages/DMPage';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    injectBottomNav();
  }, []);

  const isDiscover =
    location.pathname === "/discover" ||
    location.pathname.startsWith("/token") ||
    location.pathname.startsWith("/blog") ||
    location.pathname.startsWith("/dm");

  const isProfile = location.pathname.startsWith("/profile");

  // Pages that need to scroll freely (not chat)
  const isScrollPage =
    location.pathname === "/manifesto" ||
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
        <div className="sc-logo">
          SOL<span className="sc-logo-accent">CHAT</span>
          <span className="sc-logo-beta">BETA</span>
        </div>

        {/* Desktop nav links — hidden on mobile via CSS */}
        <nav className="sc-desktop-nav">
          <NavLink to="/"          className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>Chat</NavLink>
          <NavLink to="/discover"  className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>Discover</NavLink>
          <NavLink to="/manifesto" className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>Manifesto</NavLink>
          <NavLink to="/blog"      className={({ isActive }) => isActive ? "sc-nav-link active" : "sc-nav-link"}>Blog</NavLink>
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
          <Route path="/manifesto"           element={<ManifestoPage />} />
          <Route path="/discover"            element={<DiscoverPage />} />
          <Route path="/token/:address"      element={<TokenPage />} />
          <Route path="/profile/:username"   element={<ProfilePage />} />
          <Route path="/blog"                element={<Blog />} />
          <Route path="/blog/:slug"          element={<BlogPost />} />
          <Route path="/dm"                  element={<DMPage />} />
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
        </footer>
      )}

      {/* ── BOTTOM NAV — rendered by injectBottomNav, NOT here ── */}

    </div>
  );
}
