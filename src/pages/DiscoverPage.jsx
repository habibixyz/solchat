import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import SwapDrawer from "../components/SwapDrawer";

const mono = "'Space Mono', monospace";
const syne = "'Syne', sans-serif";

function formatNum(n) {
  if (!n) return "—";
  const num = Number(n);
  if (num >= 1e9) return `$${(num/1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num/1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num/1e3).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function formatPrice(p) {
  if (!p) return "—";
  const n = Number(p);
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts * 1000) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  return `${Math.floor(s/3600)}h`;
}

export default function Discover() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [activeMint, setActiveMint] = useState(null);
  const [filter, setFilter] = useState("trending");

  const fetchTokens = useCallback(async (query = "") => {
    setLoading(true);
    try {
      let url = query
        ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
        : "https://api.dexscreener.com/token-boosts/top/v1";

      const res = await fetch(url);
      const data = await res.json();

      if (query) {
        const pairs = (data?.pairs || [])
          .filter(p => p.chainId === "solana" && Number(p.liquidity?.usd || 0) > 5000)
          .slice(0, 50);
        setTokens(pairs.map(p => ({ pair: p, tokenAddress: p.baseToken?.address, icon: p.info?.imageUrl })));
      } else {
        const boosts = Array.isArray(data) ? data.filter(t => t.chainId === "solana").slice(0, 50) : [];
        if (boosts.length === 0) {
          const fallback = await fetch("https://api.dexscreener.com/latest/dex/search?q=solana");
          const fdata = await fallback.json();
          const pairs = (fdata?.pairs || [])
            .filter(p => p.chainId === "solana" && Number(p.liquidity?.usd || 0) > 50000)
            .slice(0, 50);
          setTokens(pairs.map(p => ({ pair: p, tokenAddress: p.baseToken?.address, icon: p.info?.imageUrl })));
          return;
        }
        const addresses = boosts.map(t => t.tokenAddress).join(",");
        const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
        const priceData = await priceRes.json();
        const pairs = priceData?.pairs || [];
        let merged = boosts.map(t => {
          const pair = pairs.find(p => p.baseToken?.address === t.tokenAddress && p.chainId === "solana");
          return { ...t, pair };
        }).filter(t => t.pair && Number(t.pair.liquidity?.usd || 0) > 5000);

        if (filter === "gainers") {
          merged = [...merged].sort((a, b) => Number(b.pair?.priceChange?.h24 || 0) - Number(a.pair?.priceChange?.h24 || 0));
        } else if (filter === "volume") {
          merged = [...merged].sort((a, b) => Number(b.pair?.volume?.h24 || 0) - Number(a.pair?.volume?.h24 || 0));
        }
        setTokens(merged);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchTokens(); }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => fetchTokens(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTrades = useCallback(async (pairAddress) => {
    if (!pairAddress) return;
    setLoadingTrades(true);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      const data = await res.json();
      const pair = data?.pairs?.[0];
      if (pair) {
        const mockTrades = Array.from({ length: 40 }, () => ({
          type: Math.random() > 0.45 ? "buy" : "sell",
          amount: (Math.random() * 200000).toFixed(0),
          usd: (Math.random() * 10000).toFixed(2),
          time: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 7200),
          sig: Array.from({ length: 64 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join(""),
        })).sort((a, b) => b.time - a.time);
        setTrades(mockTrades);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  const selectToken = (token) => {
    setSelected(token);
    if (token.pair?.pairAddress) fetchTrades(token.pair.pairAddress);
  };

  const pair = selected?.pair;
  const change24 = Number(pair?.priceChange?.h24 || 0);
  const change1h = Number(pair?.priceChange?.h1 || 0);
  const change5m = Number(pair?.priceChange?.m5 || 0);

  const pct = (v) => (
    <span style={{ color: v >= 0 ? "#00c97a" : "#ff4d4d", fontWeight: 700 }}>
      {v >= 0 ? "+" : ""}{v.toFixed(2)}%
    </span>
  );

  return (
    <div style={{
      position: "fixed",
      top: "64px", left: 0, right: 0, bottom: 0,
      display: "flex", flexDirection: "column",
      fontFamily: mono,
      background: "#080f1a",
      overflow: "hidden",
    }}>

      {/* Top bar */}
      <div style={{
        height: "38px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        padding: "0 16px", gap: "20px",
        flexShrink: 0,
        background: "rgba(0,247,255,0.02)",
      }}>
        <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#00f7ff", opacity: 0.5, textTransform: "uppercase" }}>
          Solchat Terminal
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {["trending", "gainers", "volume"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "3px 10px", borderRadius: "3px", fontSize: "10px",
              letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer",
              border: `1px solid ${filter === f ? "rgba(0,247,255,0.4)" : "rgba(255,255,255,0.06)"}`,
              background: filter === f ? "rgba(0,247,255,0.08)" : "transparent",
              color: filter === f ? "#00f7ff" : "#3a5a6a",
              fontFamily: mono,
            }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: "10px", color: "#2a3a4a", letterSpacing: "1px" }}>
          {tokens.length} pairs · Solana · data via dexscreener
        </div>
      </div>
       
      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — token list */}
        <div style={{
          width: "300px", flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ padding: "8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%", padding: "8px 12px", borderRadius: "4px",
                border: "1px solid rgba(0,247,255,0.1)",
                background: "rgba(255,255,255,0.02)",
                color: "#c8d8e8", fontFamily: mono, fontSize: "12px",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 68px",
            padding: "7px 12px",
            fontSize: "10px", letterSpacing: "1px", color: "#2a4a5a",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div>Token</div>
            <div style={{ textAlign: "right" }}>Price</div>
            <div style={{ textAlign: "right" }}>24h</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading && <div style={{ padding: "24px", textAlign: "center", fontSize: "12px", color: "#2a4a5a" }}>// loading...</div>}
            {tokens.map((token, i) => {
              const p = token.pair;
              if (!p) return null;
              const ch = Number(p.priceChange?.h24 || 0);
              const isUp = ch >= 0;
              const sym = p.baseToken?.symbol || "—";
              const name = p.baseToken?.name || "";
              const img = token.icon || p.info?.imageUrl;
              const isSelected = selected?.tokenAddress === token.tokenAddress;

              return (
                <div
                  key={token.tokenAddress + i}
                  onClick={() => selectToken(token)}
                  style={{
                    display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 68px",
                    padding: "10px 12px", cursor: "pointer",
                    background: isSelected ? "rgba(0,247,255,0.05)" : "transparent",
                    borderLeft: `2px solid ${isSelected ? "#00f7ff" : "transparent"}`,
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    alignItems: "center",
                    transition: "background 0.1s",
                  }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    {img
                      ? <img src={img} style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0 }} onError={e => e.target.style.display = "none"} />
                      : <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(0,247,255,0.08)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#00f7ff" }}>{sym.slice(0, 2)}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: syne, fontSize: "13px", fontWeight: 700, color: "#d8eaf8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sym}</div>
                      <div style={{ fontSize: "10px", color: "#2a4a5a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "12px", color: "#8ab8cc", fontFamily: syne, fontWeight: 600 }}>{formatPrice(p.priceUsd)}</div>
                  <div style={{ textAlign: "right", fontSize: "12px", fontWeight: 700, color: isUp ? "#00c97a" : "#ff4d4d" }}>
                    {isUp ? "+" : ""}{ch.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {!selected && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
              <div style={{ fontSize: "56px", color: "#00f7ff", opacity: 0.06 }}>⬡</div>
              <div style={{ fontSize: "12px", color: "#2a3a4a", letterSpacing: "3px", textTransform: "uppercase" }}>Select a token to view chart</div>
            </div>
          )}

          {selected && pair && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Token header */}
              <div style={{
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
                flexShrink: 0, background: "rgba(0,0,0,0.2)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {(selected.icon || pair.info?.imageUrl) && (
                    <img src={selected.icon || pair.info?.imageUrl} style={{ width: "32px", height: "32px", borderRadius: "50%" }} onError={e => e.target.style.display = "none"} />
                  )}
                  <div>
                    <div style={{ fontFamily: syne, fontSize: "17px", fontWeight: 800, color: "#e8f4ff" }}>
                      ${pair.baseToken?.symbol}
                      <span style={{ fontFamily: mono, fontSize: "11px", color: "#3a5a6a", fontWeight: 400, marginLeft: "8px" }}>{pair.baseToken?.name}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#2a4a5a", marginTop: "1px" }}>
                      {pair.dexId?.toUpperCase()} · {pair.labels?.join(" · ")}
                    </div>
                  </div>
                </div>

                {/* Price + changes */}
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "#2a4a5a", letterSpacing: "1px", marginBottom: "2px" }}>PRICE</div>
                    <div style={{ fontFamily: syne, fontSize: "16px", fontWeight: 800, color: "#e8f4ff" }}>{formatPrice(pair.priceUsd)}</div>
                  </div>
                  {[["5M", change5m], ["1H", change1h], ["24H", change24]].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: "9px", color: "#2a4a5a", letterSpacing: "1px", marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontFamily: syne, fontSize: "14px", fontWeight: 700, color: Number(val) >= 0 ? "#00c97a" : "#ff4d4d" }}>
                        {Number(val) >= 0 ? "+" : ""}{Number(val).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                  {[["VOL 24H", formatNum(pair.volume?.h24)], ["LIQ", formatNum(pair.liquidity?.usd)], ["MCAP", formatNum(pair.marketCap)]].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: "9px", color: "#2a4a5a", letterSpacing: "1px", marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontFamily: syne, fontSize: "14px", fontWeight: 600, color: "#8ab8cc" }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: "6px", flexShrink: 0 }}>
                  <a href={`https://dexscreener.com/solana/${pair.pairAddress}`} target="_blank" rel="noreferrer"
                    style={{ padding: "7px 12px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.08)", color: "#4a6a7a", fontFamily: mono, fontSize: "11px", textDecoration: "none" }}>
                    Dex ↗
                  </a>
                  <a href={`https://solscan.io/token/${selected.tokenAddress}`} target="_blank" rel="noreferrer"
                    style={{ padding: "7px 12px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.08)", color: "#4a6a7a", fontFamily: mono, fontSize: "11px", textDecoration: "none" }}>
                    Solscan ↗
                  </a>
                  <button onClick={() => setActiveMint(selected.tokenAddress)}
                    style={{ padding: "7px 18px", borderRadius: "4px", border: "1px solid rgba(0,247,255,0.35)", background: "rgba(0,247,255,0.07)", color: "#00f7ff", fontFamily: mono, fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>
                    Buy ◎
                  </button>
                </div>
              </div>

              {/* Chart + trades */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* Chart */}
                {/* Chart */}
<div style={{ flex: 1, overflow: "hidden", borderRight: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
  <iframe
    src={`https://dexscreener.com/solana/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
    style={{ width: "100%", height: "calc(100% + 40px)", border: "none", marginBottom: "-40px" }}
    title="chart"
  />
  <div style={{
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: "36px",
    background: "#080f1a",
    zIndex: 10,
  }} />
</div>

                {/* Trades */}
                <div style={{ width: "280px", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                  {/* Buy/sell summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", padding: "10px" }}>
                    <div style={{ textAlign: "center", padding: "10px 6px", background: "rgba(0,201,122,0.05)", border: "1px solid rgba(0,201,122,0.12)", borderRadius: "6px" }}>
                      <div style={{ fontSize: "9px", color: "#2a4a5a", letterSpacing: "1px", marginBottom: "3px" }}>BUYS 24H</div>
                      <div style={{ fontFamily: syne, fontSize: "20px", fontWeight: 800, color: "#00c97a" }}>{pair.txns?.h24?.buys || 0}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "10px 6px", background: "rgba(255,77,77,0.05)", border: "1px solid rgba(255,77,77,0.12)", borderRadius: "6px" }}>
                      <div style={{ fontSize: "9px", color: "#2a4a5a", letterSpacing: "1px", marginBottom: "3px" }}>SELLS 24H</div>
                      <div style={{ fontFamily: syne, fontSize: "20px", fontWeight: 800, color: "#ff4d4d" }}>{pair.txns?.h24?.sells || 0}</div>
                    </div>
                  </div>

                  {/* Buy/sell volume bar */}
                  {pair.volume?.h24 && (
                    <div style={{ padding: "0 10px 8px" }}>
                      <div style={{ height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.round((pair.txns?.h24?.buys || 0) / ((pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 1)) * 100)}%`,
                          background: "linear-gradient(90deg, #00c97a, #00f7a0)",
                          borderRadius: "2px",
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Trades header */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "30px 1fr 72px 36px",
                    padding: "6px 10px",
                    fontSize: "9px", letterSpacing: "1px", color: "#2a4a5a",
                    textTransform: "uppercase",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div></div>
                    <div>Amount</div>
                    <div style={{ textAlign: "right" }}>USD</div>
                    <div style={{ textAlign: "right" }}>Age</div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {loadingTrades && <div style={{ padding: "20px", textAlign: "center", fontSize: "11px", color: "#2a4a5a" }}>// loading...</div>}
                    {trades.map((trade, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "30px 1fr 72px 36px",
                        padding: "7px 10px",
                        borderBottom: "1px solid rgba(255,255,255,0.025)",
                        alignItems: "center",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.008)",
                      }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: trade.type === "buy" ? "#00c97a" : "#ff4d4d", textTransform: "uppercase" }}>
                          {trade.type === "buy" ? "B" : "S"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#6a8aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {Number(trade.amount).toLocaleString()}
                        </div>
                        <div style={{ textAlign: "right", fontSize: "12px", fontWeight: 600, color: trade.type === "buy" ? "#00c97a" : "#ff4d4d" }}>
                          ${Number(trade.usd).toFixed(2)}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <a href={`https://solscan.io/tx/${trade.sig}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: "10px", color: "#2a4a5a", textDecoration: "none" }}>
                            {timeAgo(trade.time)}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeMint && <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />}
    </div>
  );
}
