import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RECEIVER = new PublicKey("A3vfDdCu4y5EaVxKqnHmEKjwa2SaMhCZm9wbUQZrA8CV");
const HELIUS_KEY = import.meta.env.VITE_HELIUS_API_KEY;
const ANALYSIS_FEE = 0.05;

export default function Discover() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [step, setStep] = useState("idle");

  const analyze = async () => {
    if (!wallet.publicKey) { alert("Connect your wallet first"); return; }

    try {
      setLoading(true);
      setReport(null);

      // Step 2 — Fetch all wallet data from Helius
      setStep("fetching");
      const address = wallet.publicKey.toString();

      const [assetsRes, txRes, balanceRes] = await Promise.all([
        // All tokens + NFTs
        fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "getAssetsByOwner",
            params: { ownerAddress: address, page: 1, limit: 100 }
          })
        }),
        // Last 50 transactions with full details
        fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=50`),
        // SOL balance
        fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 2,
            method: "getBalance",
            params: [address]
          })
        })
      ]);

      const assetsData = await assetsRes.json();
      const txData = await txRes.json();
      const balanceData = await balanceRes.json();

      const assets = assetsData?.result?.items || [];
      const txs = Array.isArray(txData) ? txData : [];
      const solBalance = (balanceData?.result?.value || 0) / LAMPORTS_PER_SOL;

      // Step 3 — Send to AI edge function
      setStep("analyzing");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const aiRes = await fetch(`${supabaseUrl}/functions/v1/wallet-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ address, assets, transactions: txs, solBalance }),
      });

      const aiData = await aiRes.json();
      setReport(aiData);
      console.log("REPORT DATA:", JSON.stringify(aiData));
setReport(aiData);
      setStep("done");

    } catch (err) {
      console.error(err);
      alert("Analysis failed: " + err.message);
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const stepLabel = {
    idle: "",
    paying: "confirming payment...",
    fetching: "fetching on-chain data...",
    analyzing: "AI analyzing wallet...",
    done: "",
  };

  const riskColor = {
    LOW: "#00f7ff",
    MEDIUM: "#f7a800",
    HIGH: "#ff6b35",
    DEGEN: "#ff3366",
  };

  return (
    <div style={{ minHeight: "calc(100vh - 70px)", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Space Mono', monospace" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px", maxWidth: "520px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "4px", color: "#00f7ff", opacity: 0.6, textTransform: "uppercase", marginBottom: "12px" }}>
          Solchat · Discover
        </div>
        <div style={{ fontSize: "24px", fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#e2edf8", letterSpacing: "-0.5px", marginBottom: "8px" }}>
          Wallet Analyzer
        </div>
        <div style={{ fontSize: "12px", color: "#3a5a6a", lineHeight: 1.8 }}>
          Deep on-chain analysis. Portfolio breakdown, trading patterns, risk profile, and AI verdict.
        </div>
      </div>

      {/* Analyze card */}
      {!report && (
        <div style={{ width: "100%", maxWidth: "480px", border: "1px solid rgba(0,247,255,0.12)", borderRadius: "12px", background: "rgba(8,12,24,0.8)", padding: "32px", textAlign: "center" }}>

          <div style={{ fontSize: "11px", color: "#3a5a6a", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>
            Analysis Fee
          </div>
          <div style={{ fontSize: "36px", fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#00f7ff", marginBottom: "4px" }}>
            0.05 ◎
          </div>
          <div style={{ fontSize: "11px", color: "#2a4a5a", marginBottom: "28px" }}>
            one-time · powered by Helius + AI
          </div>

          <div style={{ textAlign: "left", marginBottom: "28px" }}>
            {[
              "SOL balance + full token portfolio",
              "Top 5 holdings with estimated USD value",
              "NFT collection breakdown",
              "50 transaction deep dive",
              "Most used protocols (Jupiter, Raydium etc)",
              "Trading pattern — flipper, holder, degen",
              "Whale score + wallet age",
              "Risk profile: LOW / MEDIUM / HIGH / DEGEN",
              "AI verdict + specific recommendations",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "11px", color: "#5a7a8a" }}>
                <span style={{ color: "#00f7ff", opacity: 0.4, flexShrink: 0 }}>—</span>
                {item}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "14px", border: "1px solid rgba(0,247,255,0.15)", borderRadius: "8px", color: "#00f7ff", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", opacity: 0.6 }}>
              // {stepLabel[step]}
            </div>
          ) : (
            <button
              onClick={analyze}
              disabled={!wallet.publicKey}
              style={{
                width: "100%", padding: "14px", borderRadius: "8px",
                border: `1px solid ${wallet.publicKey ? "rgba(0,247,255,0.3)" : "rgba(255,255,255,0.05)"}`,
                background: wallet.publicKey ? "rgba(0,247,255,0.06)" : "transparent",
                color: wallet.publicKey ? "#00f7ff" : "#2a4a5a",
                fontFamily: "'Space Mono', monospace", fontSize: "11px",
                letterSpacing: "3px", textTransform: "uppercase",
                cursor: wallet.publicKey ? "pointer" : "not-allowed",
                boxSizing: "border-box",
              }}
            >
              {wallet.publicKey ? "Analyze My Wallet →" : "// connect wallet first"}
            </button>
          )}
        </div>
      )}

      {/* Report */}
      {report && (
        <div style={{ width: "100%", maxWidth: "680px" }}>

          {/* Wallet header */}
          <div style={{ border: "1px solid rgba(0,247,255,0.12)", borderRadius: "12px", background: "rgba(8,12,24,0.8)", padding: "24px 28px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#3a5a6a", textTransform: "uppercase", marginBottom: "6px" }}>Wallet</div>
              <div style={{ fontSize: "12px", color: "#8ab8cc" }}>{wallet.publicKey?.toString().slice(0, 8)}...{wallet.publicKey?.toString().slice(-8)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9px", letterSpacing: "3px", color: "#3a5a6a", textTransform: "uppercase", marginBottom: "6px" }}>SOL Balance</div>
              <div style={{ fontSize: "20px", fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#00f7ff" }}>
  {Number(report.solBalance || 0).toFixed(4)} SOL</div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {[
              ["Tokens", report.tokenCount],
              ["NFTs", report.nftCount],
              ["Txns", report.txCount],
              ["Wallet Age", report.walletAge],
            ].map(([label, value], i) => (
              <div key={i} style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", background: "rgba(8,12,24,0.8)", padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#3a5a6a", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
                <div style={{ fontSize: "16px", fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#c8ddf0" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Risk + Pattern */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            <div style={{ border: `1px solid ${riskColor[report.riskProfile] || "#3a5a6a"}40`, borderRadius: "8px", background: "rgba(8,12,24,0.8)", padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#3a5a6a", textTransform: "uppercase", marginBottom: "8px" }}>Risk Profile</div>
              <div style={{ fontSize: "18px", fontFamily: "'Syne', sans-serif", fontWeight: 800, color: riskColor[report.riskProfile] || "#8ab8cc" }}>{report.riskProfile}</div>
            </div>
            <div style={{ border: "1px solid rgba(138,99,255,0.2)", borderRadius: "8px", background: "rgba(8,12,24,0.8)", padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#3a5a6a", textTransform: "uppercase", marginBottom: "8px" }}>Trader Type</div>
              <div style={{ fontSize: "18px", fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#8a63ff" }}>{report.traderType}</div>
            </div>
          </div>

          {/* Top tokens */}
          {report.topTokens?.length > 0 && (
            <div style={{ border: "1px solid rgba(0,247,255,0.12)", borderRadius: "12px", background: "rgba(8,12,24,0.8)", padding: "24px 28px", marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#00f7ff", opacity: 0.5, textTransform: "uppercase", marginBottom: "16px" }}>Top Holdings</div>
              {report.topTokens.map((token, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "12px" }}>
                  <div style={{ color: "#8ab8cc" }}>{token.name}</div>
                  <div style={{ color: "#c8ddf0", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{token.amount}</div>
                </div>
              ))}
            </div>
          )}

          {/* Protocols */}
          {report.protocols?.length > 0 && (
            <div style={{ border: "1px solid rgba(0,247,255,0.12)", borderRadius: "12px", background: "rgba(8,12,24,0.8)", padding: "24px 28px", marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#00f7ff", opacity: 0.5, textTransform: "uppercase", marginBottom: "16px" }}>Most Used Protocols</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {report.protocols.map((p, i) => (
                  <div key={i} style={{ padding: "6px 12px", border: "1px solid rgba(0,247,255,0.15)", borderRadius: "4px", fontSize: "11px", color: "#00f7ff", opacity: 0.7, letterSpacing: "1px" }}>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div style={{ border: "1px solid rgba(0,247,255,0.12)", borderRadius: "12px", background: "rgba(8,12,24,0.8)", padding: "24px 28px", marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#00f7ff", opacity: 0.5, textTransform: "uppercase", marginBottom: "16px" }}>AI Analysis</div>
            <div style={{ fontSize: "13px", color: "#8ab8cc", lineHeight: 2 }}>{report.summary}</div>
          </div>

          {/* Activity */}
          <div style={{ border: "1px solid rgba(0,247,255,0.12)", borderRadius: "12px", background: "rgba(8,12,24,0.8)", padding: "24px 28px", marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#00f7ff", opacity: 0.5, textTransform: "uppercase", marginBottom: "16px" }}>On-chain Behaviour</div>
            <div style={{ fontSize: "13px", color: "#5a7a8a", lineHeight: 2 }}>{report.activity}</div>
          </div>

          {/* Verdict */}
          <div style={{ border: "1px solid rgba(138,99,255,0.25)", borderRadius: "12px", background: "rgba(138,99,255,0.04)", padding: "24px 28px", marginBottom: "24px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#8a63ff", opacity: 0.7, textTransform: "uppercase", marginBottom: "16px" }}>AI Verdict + Recommendations</div>
            <div style={{ fontSize: "13px", color: "#a890ff", lineHeight: 2 }}>{report.verdict}</div>
          </div>

          <button
            onClick={() => { setReport(null); setStep("idle"); }}
            style={{ padding: "10px 20px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", background: "transparent", color: "#3a5a6a", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "2px", cursor: "pointer" }}
          >
            ← analyze another wallet
          </button>
        </div>
      )}
    </div>
  );
}