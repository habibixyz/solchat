import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import useMintCountdown from "../utils/useMintCountdown";
import { mintNFT } from "../mint";

export default function GenesisPage() {
  const countdown = useMintCountdown();
  const wallet = useWallet();
  const navigate = useNavigate();
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);

  const handleMint = async () => {
    if (!wallet.publicKey) { alert("Connect your wallet first"); return; }
    try { setMinting(true); await mintNFT(wallet); setMinted(true); }
    catch (err) { console.error(err); }
    finally { setMinting(false); }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      background: "radial-gradient(circle at 30% 10%, rgba(0,247,255,0.06), transparent 40%), radial-gradient(circle at 70% 0%, rgba(140,100,255,0.06), transparent 40%), #020b14",
    }}>

      <img src="/sigil-glyph.svg" className="sigil-bg" alt="sigil" />

      <div style={{
        width: "380px",
        maxWidth: "92vw",
        borderRadius: "16px",
        background: "rgba(8,12,24,0.90)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0,247,255,0.12)",
        boxShadow: "0 0 60px rgba(100,90,255,0.12)",
        position: "relative",
        zIndex: 5,
        overflow: "hidden",
      }}>

        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,247,255,0.5), rgba(138,99,255,0.5), transparent)" }} />

        <div style={{ padding: "32px 32px 28px" }}>

          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "4px", color: "#00f7ff", opacity: 0.6, textTransform: "uppercase", marginBottom: "14px" }}>
            Solchat · Origin Collection
          </div>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "38px", fontWeight: 800, letterSpacing: "6px", background: "linear-gradient(90deg, #00f7ff, #8a63ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 6px", lineHeight: 1 }}>
            NULL SIGIL
          </h1>

          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: "#4a6a7a", margin: "0 0 20px", letterSpacing: "1px" }}>
            The first signal precedes the system.
          </p>

          <div style={{ fontSize: "18px", color: "#00f7ff", letterSpacing: "8px", textShadow: "0 0 20px rgba(0,247,255,0.5)", marginBottom: "20px" }}>
            ⟁ ⟁ ⟁
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "0 0 20px" }} />

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", overflow: "hidden" }}>
            {[["Supply","1000"],["Public Mint","899"],["Price","FREE"],["Max / wallet","1"]].map(([label, value], i) => (
              <div key={i} style={{ padding: "12px 14px", borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.06)" : "none", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none", background: i % 2 === 0 ? "rgba(0,247,255,0.02)" : "transparent" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "#3a5a6a", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "3px" }}>{label}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: value === "FREE" ? "#00f7ff" : "#c8ddf0" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Awakening soon button */}
          <div style={{ width: "100%", padding: "13px", borderRadius: "8px", border: "1px solid rgba(0,247,255,0.15)", background: "rgba(0,247,255,0.03)", color: "#3a5a6a", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", textAlign: "center", cursor: "not-allowed", boxSizing: "border-box", marginBottom: "12px" }}>
            // Sigil Awakening Soon
          </div>

          {/* ✅ Push to chat */}
          <button
            onClick={() => navigate("/chat")}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "8px",
              border: "1px solid rgba(0,247,255,0.25)",
              background: "transparent",
              color: "#00f7ff",
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              textAlign: "center",
              cursor: "pointer",
              boxSizing: "border-box",
              transition: "all 0.2s",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(0,247,255,0.06)")}
            onMouseOut={e => (e.currentTarget.style.background = "transparent")}
          >
            Enter Global Feed →
          </button>

          {/* Follow hint */}
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#2a4a5a", letterSpacing: "1px", textAlign: "center", marginTop: "12px" }}>
            follow{" "}
            <a href="https://twitter.com/ritmir11" target="_blank" rel="noreferrer" style={{ color: "#00f7ff", opacity: 0.5, textDecoration: "none" }}>@ritmir11</a>
            {" "}for launch signal
          </div>

        </div>

        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(138,99,255,0.3), transparent)" }} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "16px", fontFamily: "'Space Mono', monospace", fontSize: "10px", color: "#1a2a3a", letterSpacing: "1px" }}>
        devnet · null sigil v1 · solchat.fun
      </div>

    </div>
  );
}