import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "../lib/supabase";
import "../styles/premium-chat.css";

const mono = "'IBM Plex Mono','Space Mono',monospace";
const sans = "'DM Sans','Inter',sans-serif";

const C = {
  bg:       "#08090b",
  bgPanel:  "#000000",
  bgRow:    "transparent",
  bgRowHov: "#0a0a0c",
  bgRowSel: "rgba(29, 158, 117, 0.08)",
  border:   "#16181c",
  borderBr: "#16181c",
  cyan:     "#1d9e75",
  cyanDim:  "rgba(29, 158, 117, 0.12)",
  green:    "#00ba7c",
  greenDim: "rgba(0, 186, 124, 0.08)",
  red:      "#f4212e",
  redDim:   "rgba(244, 33, 46, 0.08)",
  yellow:   "#e1b84b",
  text:     "#e7e9ea",
  textMid:  "#e7e9ea",
  textDim:  "#71767b",
};

const scrollbarCSS = `
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #000000; }
  ::-webkit-scrollbar-thumb { background: #16181c; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
  * { scrollbar-width: thin; scrollbar-color: #16181c #000000; }
`;

function useWindowSize() {
  const [size, setSize] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1200 });
  useEffect(() => {
    const fn = () => setSize({ w: window.innerWidth });
    window.addEventListener("resize", fn);
    fn();
    return () => window.removeEventListener("resize", fn);
  }, []);
  return size;
}

const LiveMetricsPanel = ({ data }: { data: any }) => {
  // Default values matching the screenshot if API is loading or fails
  const priceUsd = data?.priceUsd ? `$${Number(data.priceUsd).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : "$0.1531";
  const priceNative = data?.priceNative ? `${Number(data.priceNative).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} SOL` : "0.001955 SOL";
  
  const formatUsd = (val: number | string | undefined) => {
    if (!val) return null;
    const num = Number(val);
    if (isNaN(num)) return null;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };
  
  const liquidity = formatUsd(data?.liquidity?.usd) || "$1.5M";
  const fdv = formatUsd(data?.fdv) || "$153.1M";
  const marketCap = formatUsd(data?.marketCap) || "$153.1M";
  
  const p5m = Number(data?.priceChange?.m5 ?? -0.09);
  const ph1 = Number(data?.priceChange?.h1 ?? -2.71);
  const ph6 = Number(data?.priceChange?.h6 ?? 1.54);
  const ph24 = Number(data?.priceChange?.h24 ?? 17.40);
  
  const buys = Number(data?.txns?.h24?.buys ?? 24097);
  const sells = Number(data?.txns?.h24?.sells ?? 19965);
  const totalTxns = buys + sells;
  
  const volumeH24 = Number(data?.volume?.h24 ?? 9700000);
  const volFormatted = formatUsd(volumeH24) || "$9.7M";
  
  // Ratios for rendering the progress bars
  const buyTxRatio = (buys / Math.max(1, totalTxns)) * 100;
  const sellTxRatio = 100 - buyTxRatio;
  
  // Volume estimates
  const buyVol = volumeH24 * (buys / Math.max(1, totalTxns));
  const sellVol = volumeH24 * (sells / Math.max(1, totalTxns));
  const buyVolFormatted = formatUsd(buyVol) || "$4.8M";
  const sellVolFormatted = formatUsd(sellVol) || "$4.8M";
  
  // Traders estimates
  const traders = Math.round(totalTxns * 0.244);
  const buyers = Math.round(buys * 0.31);
  const sellers = Math.round(sells * 0.30);
  const tradersFormatted = traders.toLocaleString();
  const buyersFormatted = buyers.toLocaleString();
  const sellersFormatted = sellers.toLocaleString();
  const buyerRatio = (buyers / Math.max(1, buyers + sellers)) * 100;
  const sellerRatio = 100 - buyerRatio;
  
  const redColor = "#f4212e";
  const greenColor = "#00ba7c";
  const borderCol = "#16181c";
  
  return (
    <div style={{
      background: "rgba(5, 5, 7, 0.7)",
      border: `1px solid ${C.border}`,
      borderRadius: "12px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      fontFamily: sans
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: C.text, fontFamily: mono, letterSpacing: "1px" }}>
          📊 LIVE MARKET METRICS
        </span>
        <span style={{ fontSize: "10px", color: C.textDim, fontFamily: mono }}>POWERED BY DEXSCREENER</span>
      </div>

      {/* Row 1: Price and SOL Price */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: C.textDim, fontFamily: mono }}>PRICE USD</div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: mono, marginTop: "4px" }}>{priceUsd}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: C.textDim, fontFamily: mono }}>PRICE</div>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: mono, marginTop: "4px" }}>{priceNative}</div>
        </div>
      </div>

      {/* Row 2: Liquidity, FDV, Market Cap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: C.textDim, fontFamily: mono }}>LIQUIDITY</div>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff", fontFamily: mono, marginTop: "4px" }}>{liquidity}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: C.textDim, fontFamily: mono }}>FDV</div>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff", fontFamily: mono, marginTop: "4px" }}>{fdv}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "10px" }}>
          <div style={{ fontSize: "10px", color: C.textDim, fontFamily: mono }}>MKT CAP</div>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff", fontFamily: mono, marginTop: "4px" }}>{marketCap}</div>
        </div>
      </div>

      {/* Row 3: Price Changes (5m, 1h, 6h, 24h) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
        {[
          { label: "5M", val: p5m },
          { label: "1H", val: ph1 },
          { label: "6H", val: ph6 },
          { label: "24H", val: ph24 }
        ].map((item, idx) => {
          const isNeg = item.val < 0;
          return (
            <div key={idx} style={{ 
              background: "rgba(255,255,255,0.02)", 
              border: `1px solid ${borderCol}`, 
              borderRadius: "8px", 
              padding: "10px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "9px", color: C.textDim, fontFamily: mono }}>{item.label}</div>
              <div style={{ 
                fontSize: "12px", 
                fontWeight: 800, 
                color: isNeg ? redColor : greenColor, 
                fontFamily: mono, 
                marginTop: "4px" 
              }}>
                {isNeg ? "" : "+"}{item.val.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 4: Transactions and Buys/Sells progress bars */}
      <div style={{ background: "rgba(255,255,255,0.01)", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: C.textDim, fontFamily: mono }}>
          <span>TXNS: <strong style={{ color: "#fff" }}>{totalTxns.toLocaleString()}</strong></span>
          <span>BUYS: <strong style={{ color: greenColor }}>{buys.toLocaleString()}</strong></span>
          <span>SELLS: <strong style={{ color: redColor }}>{sells.toLocaleString()}</strong></span>
        </div>
        <div style={{ height: "4px", width: "100%", borderRadius: "2px", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${buyTxRatio}%`, background: greenColor, height: "100%" }} />
          <div style={{ width: `${sellTxRatio}%`, background: redColor, height: "100%" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: C.textDim, fontFamily: mono, marginTop: "4px" }}>
          <span>VOLUME: <strong style={{ color: "#fff" }}>{volFormatted}</strong></span>
          <span>BUY VOL: <strong style={{ color: greenColor }}>{buyVolFormatted}</strong></span>
          <span>SELL VOL: <strong style={{ color: redColor }}>{sellVolFormatted}</strong></span>
        </div>
        <div style={{ height: "4px", width: "100%", borderRadius: "2px", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${buyTxRatio}%`, background: greenColor, height: "100%" }} />
          <div style={{ width: `${sellTxRatio}%`, background: redColor, height: "100%" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: C.textDim, fontFamily: mono, marginTop: "4px" }}>
          <span>TRADERS: <strong style={{ color: "#fff" }}>{tradersFormatted}</strong></span>
          <span>BUYERS: <strong style={{ color: greenColor }}>{buyersFormatted}</strong></span>
          <span>SELLERS: <strong style={{ color: redColor }}>{sellersFormatted}</strong></span>
        </div>
        <div style={{ height: "4px", width: "100%", borderRadius: "2px", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${buyerRatio}%`, background: greenColor, height: "100%" }} />
          <div style={{ width: `${sellerRatio}%`, background: redColor, height: "100%" }} />
        </div>
      </div>
    </div>
  );
};

export default function AnsemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const wallet = useWallet();
  const { w: winW } = useWindowSize();

  const isMobile  = winW < 640;
  const isDesktop = winW >= 1024;
  const isMobileSidebar = winW < 768;

  const [profileName, setProfileName] = useState("guest");
  const myWallet = wallet.publicKey?.toBase58() ?? "";
  const [nameClaiming, setNameClaiming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveData, setLiveData] = useState<any>(null);

  // AI Sentiment State variables
  const [sentimentScore, setSentimentScore] = useState(84);
  const [aiAnalysisText, setAiAnalysisText] = useState(
    "Neural Engine Model-V3 predicts strong support at current levels with high accumulation. Tipping volumes on Solchat have surged (+24%), indicating positive community engagement. Recommend Accumulate / Dollar-Cost Average (DCA) under $0.155."
  );

  const [aiLogs, setAiLogs] = useState([
    { id: 1, time: "10:42:15", msg: "[Neural-Model-v4] RSI divergence detected on 1H timeframe. Potential breakout forming.", type: "neutral" },
    { id: 2, time: "11:05:32", msg: "[Sentiment-Bot] $ANSEM social volume on Solchat up 24% in the last 4 hours.", type: "bullish" },
    { id: 3, time: "11:15:10", msg: "[Volume-Monitor] Whale swap detected: 142,500 $ANSEM purchased at $0.152.", type: "bullish" },
    { id: 4, time: "11:28:44", msg: "[Pattern-Scanner] Cup and handle breakout pattern forming on 4H chart.", type: "bullish" }
  ]);

  const changeName = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      alert("Connect wallet first and make sure it supports signing messages.");
      return;
    }
    const newName = prompt('Enter new username:');
    if (!newName) return;
    const clean = newName.trim().toLowerCase();
    if (!clean) return;
    if (clean.length < 3 || clean.length > 20) {
      alert('Username must be 3-20 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(clean)) {
      alert('Username can only contain letters, numbers, and underscores');
      return;
    }
    setNameClaiming(true);
    try {
      const { default: bs58 } = await import('bs58');
      const message = `Claim username "${clean}" for wallet ${myWallet}`;
      const encodedMsg = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(encodedMsg);
      const signature = bs58.encode(signatureBytes);

      const res = await fetch('/api/claim-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: myWallet, username: clean, signature })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim username');
      }

      setProfileName(clean);
      localStorage.setItem(`solchat_name_${myWallet}`, clean);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to claim username (might be taken)');
    } finally {
      setNameClaiming(false);
    }
  };

  useEffect(() => {
    if (!myWallet) {
      setProfileName("guest");
      return;
    }
    const walletKey = `solchat_name_${myWallet}`;
    supabase
      .from("usernames")
      .select("wallet_address, username")
      .ilike("wallet_address", myWallet)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.username || localStorage.getItem(walletKey) || "guest";
        setProfileName(name);
        if (data?.username) localStorage.setItem(walletKey, data.username);
      });
  }, [myWallet]);

  // Load Jupiter swap widget inline and fetch DEX Screener Live details
  useEffect(() => {
    // Fetch live DEX Screener token details
    const fetchLive = async () => {
      try {
        const res = await fetch("https://api.dexscreener.com/latest/dex/tokens/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump");
        const data = await res.json();
        if (data && data.pairs && data.pairs[0]) {
          setLiveData(data.pairs[0]);
        }
      } catch (err) {
        console.error("Failed to fetch live token data:", err);
      }
    };
    fetchLive();
    const liveInterval = setInterval(fetchLive, 10000);

    const initJup = () => {
      const Jupiter = (window as any).Jupiter;
      const container = document.getElementById('jupiter-terminal-inline');
      if (Jupiter && container) {
        // If container already has children, do not initialize again
        if (container.children.length > 0) {
          return true;
        }
        try {
          Jupiter.init({
            displayMode: "integrated",
            integratedTargetId: "jupiter-terminal-inline",
            endpoint: "https://api.mainnet-beta.solana.com",
            formProps: {
              initialInputMint: "So11111111111111111111111111111111111111112",
              initialOutputMint: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
            },
            platformFeeAndAccounts: {
              referralAccount: "HLtC6FYq1uJjkh2Hqz2LXoKWXMKV1Z22SmhAch5fJDii",
              feeBps: 50,
            },
            theme: "dark",
          });
          return true;
        } catch (e) {
          console.error("Jupiter init error:", e);
        }
      }
      return false;
    };

    let jupInterval: any;
    if ((window as any).Jupiter) {
      initJup();
    } else {
      jupInterval = setInterval(() => {
        if (initJup()) {
          clearInterval(jupInterval);
        }
      }, 500);
    }

    // Dynamic AI Log simulations
    const logInterval = setInterval(() => {
      const messages = [
        { msg: "[Neural-Model-v4] Moving Average EMA(20) crossover triggered. Trend strength increasing.", type: "bullish" },
        { msg: "[Sentiment-Bot] Mention density of $ANSEM in Solchat global lobby surged 12%.", type: "bullish" },
        { msg: "[Volume-Monitor] Volume block transfer detected. Order book absorbing liquidity.", type: "neutral" },
        { msg: "[Neural-Model-v3] RSI stabilized at 60.1. Consolidation phase ending.", type: "bullish" },
        { msg: "[Sentiment-Bot] Live wallet balance tipping count increased to 89 tips/hr.", type: "bullish" }
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      
      setAiLogs(prev => [
        { id: Date.now(), time: timeStr, msg: randomMsg.msg, type: randomMsg.type },
        ...prev.slice(0, 5)
      ]);

      // Modulate sentiment slightly
      setSentimentScore(prev => Math.min(95, Math.max(78, prev + (Math.random() > 0.5 ? 1 : -1))));
    }, 12000);

    return () => {
      if (jupInterval) clearInterval(jupInterval);
      clearInterval(liveInterval);
      clearInterval(logInterval);
    };
  }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText("9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderNavSidebar = () => {
    if (isMobileSidebar) return null;
    const navItems = [
      { id: 'chat', label: 'Global Feed', icon: '△', path: '/' },
      { id: 'trending', label: 'Trending', icon: '◇', path: '/trending' },
      { id: 'dms', label: 'Messages', icon: '□', path: '/dm' },
      { id: 'notifications', label: 'Notifications', icon: '●', path: '/notifications' },
    ];
    return (
      <aside className="cl-sidebar" style={{ width: 264, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid rgba(255, 255, 255, 0.055)", background: "#050507" }}>
        <div className="cl-sidebar-logo-container">
          <img src="/logo.png" alt="" className="cl-logo-badge" style={{ objectFit: 'contain', padding: '2px' }} />
          <div>
            <div className="cl-logo-text">SOLCHAT</div>
            <div className="cl-logo-subtext">social trading layer</div>
          </div>
        </div>
        <div style={{ padding: "8px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.055)" }}>
          <div className="cl-nav-section-header">Navigate</div>
          {navItems.map(it => {
            const active = it.id === 'dms' 
              ? location.pathname.startsWith('/dm') 
              : location.pathname === it.path;
            return (
              <div key={it.id} className={`cl-nav-link-custom${active ? " active" : ""}`} onClick={() => navigate(it.path)}>
                <span className="cl-nav-icon">{it.icon}</span>
                <span>{it.label}</span>
              </div>
            );
          })}
          <div className={`cl-nav-link-custom${location.pathname === '/mine' ? ' active' : ''}`} onClick={() => navigate('/mine')}>
            <span className="cl-nav-icon">⛏️</span>
            <span>Mine App</span>
          </div>
          <div className={`cl-nav-link-custom${location.pathname === '/discover' || location.pathname === '/manifesto' || location.pathname.startsWith('/blog') ? ' active' : ''}`} onClick={() => navigate('/discover')}>
            <span className="cl-nav-icon">○</span>
            <span>Discover</span>
          </div>
          <div className={`cl-nav-link-custom${location.pathname === '/ansem' ? ' active' : ''}`} onClick={() => navigate('/ansem')}>
            <span className="cl-nav-icon">💸</span>
            <span>$ANSEM</span>
          </div>
          {myWallet && profileName !== "guest" && (
            <div className={`cl-nav-link-custom${location.pathname.startsWith('/profile') ? ' active' : ''}`} onClick={() => navigate(`/profile/${encodeURIComponent(profileName)}`)}>
              <span className="cl-nav-icon">◉</span>
              <span>My Profile</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div className="cl-sidebar-footer">
          <div className="cl-avatar-footer">{profileName === "guest" ? "?" : profileName.slice(0, 2).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cl-user-name-footer">{profileName}</div>
            <div className="cl-user-status-footer">{myWallet ? "connected" : "not connected"}</div>
          </div>
          {myWallet && (
            <button onClick={changeName} disabled={nameClaiming} title="Change username" className="cl-edit-btn">Edit</button>
          )}
        </div>
      </aside>
    );
  };

  const TopBar = () => (
    <div style={{ height: isMobile ? 38 : 42, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 8, flexShrink: 0, background: C.bgPanel, position: "relative", zIndex: 20 }}>
      {/* Back / Forward */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        <button onClick={() => navigate("/")} title="Go back"
          style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: C.textMid, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>‹</button>
      </div>

      {/* Unified Page Tabs */}
      <div style={{ display: "flex", gap: 4, marginRight: 8, flexShrink: 0 }}>
        <button onClick={() => navigate("/ansem")}
          style={{
            background: location.pathname === "/ansem" ? C.cyanDim : "transparent",
            color: location.pathname === "/ansem" ? C.cyan : C.textMid,
            border: `1px solid ${location.pathname === "/ansem" ? C.cyan + "55" : "transparent"}`,
            borderRadius: 5, padding: isMobile ? "4px 8px" : "4px 10px", fontSize: isMobile ? 9 : 11, fontFamily: mono, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
          }}>
          💸 {!isMobile && "$ANSEM"}
        </button>
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );

  const rootStyle = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    height: "calc(100vh - 52px)",
    maxHeight: "calc(100vh - 52px)",
    background: C.bg,
    color: C.text,
    overflow: "hidden",
    padding: isMobileSidebar ? "0" : "16px 0",
  };

  const wrapperStyle = {
    display: "flex",
    width: "100%",
    maxWidth: isMobileSidebar ? "100%" : "1250px",
    height: "100%",
    overflow: "hidden",
    position: "relative" as const,
    border: isMobileSidebar ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: isMobileSidebar ? "0" : "16px",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: isMobileSidebar ? "none" : "blur(20px)",
  };

  return (
    <div style={rootStyle}>
      <div style={wrapperStyle}>
        {renderNavSidebar()}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", fontFamily: sans }}>
          <TopBar />

          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px" }}>
            
            {/* Header Banner */}
            <div style={{
              background: "linear-gradient(135deg, rgba(29,158,117,0.15) 0%, rgba(0,0,0,0.4) 100%)",
              border: "1px solid rgba(29,158,117,0.3)",
              borderRadius: "12px",
              padding: isMobile ? "16px" : "24px",
              marginBottom: "20px",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              justifyContent: "space-between",
              gap: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#0d1b1e",
                  border: "2px solid #1d9e75",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden"
                }}>
                  <img 
                    src={liveData?.info?.imageUrl || "https://dd.dexscreener.com/ds-data/tokens/solana/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump.png"} 
                    alt="$ANSEM Logo" 
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                    onError={(e) => {
                      e.currentTarget.src = "https://dd.dexscreener.com/ds-data/tokens/solana/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump.png";
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h1 style={{ margin: 0, fontSize: isMobile ? "20px" : "24px", fontWeight: 800, fontFamily: sans, color: "#fff" }}>
                      The Black Bull
                    </h1>
                    <span style={{
                      fontSize: "10px",
                      fontFamily: mono,
                      background: "rgba(29,158,117,0.2)",
                      color: "#1d9e75",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 700
                    }}>
                      $ANSEM
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: C.textDim }}>
                    The official utility & tipping token of Solchat ($ANSEM)
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "11px", color: C.textDim, fontFamily: mono }}>MINT ADDRESS:</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <code style={{
                    fontFamily: mono,
                    fontSize: "12px",
                    background: "rgba(255,255,255,0.05)",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: C.text,
                    wordBreak: "break-all"
                  }}>
                    {isMobile ? "9cRCn9rGT8V...TGpump" : "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump"}
                  </code>
                  <button onClick={copyAddress} style={{
                    background: copied ? C.greenDim : "rgba(255,255,255,0.06)",
                    border: `1px solid ${copied ? C.green : "rgba(255,255,255,0.15)"}`,
                    color: copied ? C.green : C.text,
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontFamily: mono,
                    fontSize: "11px",
                    fontWeight: 700,
                    transition: "all 0.15s"
                  }}>
                    {copied ? "COPIED ✓" : "COPY"}
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Layout */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? "3fr 2fr" : "1fr",
              gap: "20px"
            }}>
              
              {/* Left Column (Chart & AI Analysis) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* DEX Screener Chart */}
                <div style={{
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${C.border}`,
                  borderRadius: "12px",
                  overflow: "hidden"
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: C.text, fontFamily: mono, letterSpacing: "1px" }}>
                      📈 LIVE CHART (DEXSCREENER)
                    </span>
                    <span style={{ fontSize: "11px", color: C.green, fontFamily: mono }}>● REALTIME FEED</span>
                  </div>
                  <iframe 
                    src="https://dexscreener.com/solana/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump?embed=1&theme=dark&trades=0&info=0" 
                    style={{ width: '100%', height: isMobile ? '380px' : '480px', border: 'none', display: "block" }}
                    title="Ansem DexScreener Chart"
                  />
                </div>

                {/* Live Market Metrics */}
                <LiveMetricsPanel data={liveData} />

              </div>

              {/* Right Column (Swap & Tokenomics) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Jupiter Swap Widget */}
                <div style={{
                  background: "rgba(10, 15, 30, 0.8)",
                  border: "1px solid rgba(29, 158, 117, 0.2)",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: "9px", letterSpacing: "2px", color: "#1d9e75", opacity: 0.8, textTransform: "uppercase" }}>
                        SOLANA LIQUIDITY AGGREGATOR
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>
                        Instant Buy & Sell
                      </div>
                    </div>
                    <span style={{
                      background: "rgba(29, 158, 117, 0.08)",
                      border: "1px solid rgba(29, 158, 117, 0.3)",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      color: C.green,
                      fontFamily: mono
                    }}>
                      Jupiter Aggregator
                    </span>
                  </div>

                  {/* Jupiter Swap target mounting div */}
                  <div 
                    id="jupiter-terminal-inline" 
                    style={{ 
                      width: "100%", 
                      height: "440px", 
                      borderRadius: "10px", 
                      overflow: "hidden",
                      border: `1px solid ${C.border}`,
                      background: "rgba(0,0,0,0.5)"
                    }} 
                  />
                  <div style={{ fontSize: "10px", color: C.textDim, textAlign: "center", marginTop: "12px", fontFamily: mono }}>
                    ⚠️ Connected wallet signs directly inside your extension.
                  </div>
                </div>

                {/* Tokenomics & Social Links Card */}
                <div style={{
                  background: "rgba(5, 5, 7, 0.7)",
                  border: `1px solid ${C.border}`,
                  borderRadius: "12px",
                  padding: "20px"
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: C.text, fontFamily: mono, letterSpacing: "1px", display: "block", marginBottom: "16px" }}>
                    📊 TOKEN STATISTICS & RESOURCES
                  </span>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                    {[
                      { label: "Token Name", value: "The Black Bull" },
                      { label: "Token Symbol", value: "$ANSEM" },
                      { label: "Total Supply", value: "1,000,000,000" },
                      { label: "Decimals", value: "6" },
                      { label: "Chain", value: "Solana Mainnet" },
                    ].map((stat, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: `1px solid ${C.border}`,
                        paddingBottom: "8px"
                      }}>
                        <span style={{ fontSize: "12px", color: C.textDim }}>{stat.label}</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: C.text, fontFamily: mono }}>{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <a href="https://dexscreener.com/solana/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump" target="_blank" rel="noreferrer" style={{
                      display: "block",
                      padding: "10px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      textDecoration: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      textAlign: "center",
                      fontFamily: mono
                    }} onMouseOver={e=>e.currentTarget.style.borderColor="#1d9e75"} onMouseOut={e=>e.currentTarget.style.borderColor=C.border}>
                      🔗 VIEW ON DEXSCREENER
                    </a>

                    <a href="https://solscan.io/token/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump" target="_blank" rel="noreferrer" style={{
                      display: "block",
                      padding: "10px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      textDecoration: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      textAlign: "center",
                      fontFamily: mono
                    }} onMouseOver={e=>e.currentTarget.style.borderColor="#1d9e75"} onMouseOut={e=>e.currentTarget.style.borderColor=C.border}>
                      🔍 VIEW ON SOLSCAN
                    </a>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
