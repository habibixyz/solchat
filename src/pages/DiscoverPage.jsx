import { useState, useEffect, useCallback } from "react";
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

const C = {
  bg: "#06090f",
  panel: "rgba(8,15,28,0.95)",
  border: "rgba(0,247,255,0.07)",
  borderHover: "rgba(0,247,255,0.18)",
  cyan: "#00f7ff",
  cyanDim: "rgba(0,247,255,0.35)",
  green: "#00e676",
  red: "#ff3d57",
  text: "#c8dce8",
  textDim: "#3a5a6a",
  textMid: "#6a8a9a",
};

export default function Discover() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [activeMint, setActiveMint] = useState(null);
  const [filter, setFilter] = useState("trending");
  const [mobileView, setMobileView] = useState("list");
  const [isMobile, setIsMobile] = useState(false);
  const [detailTab, setDetailTab] = useState("chart");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchTokens = useCallback(async (query = "") => {
    setLoading(true);
    try {
      let url = query
        ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
        : "https://api.dexscreener.com/token-boosts/top/v1";
      const res = await fetch(url);
      const data = await res.json();
      if (query) {
        const pairs = (data?.pairs || []).filter(p => p.chainId === "solana" && Number(p.liquidity?.usd || 0) > 5000).slice(0, 50);
        setTokens(pairs.map(p => ({ pair: p, tokenAddress: p.baseToken?.address, icon: p.info?.imageUrl })));
      } else {
        const boosts = Array.isArray(data) ? data.filter(t => t.chainId === "solana").slice(0, 50) : [];
        if (boosts.length === 0) {
          const fallback = await fetch("https://api.dexscreener.com/latest/dex/search?q=solana");
          const fdata = await fallback.json();
          const pairs = (fdata?.pairs || []).filter(p => p.chainId === "solana" && Number(p.liquidity?.usd || 0) > 50000).slice(0, 50);
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
        if (filter === "gainers") merged = [...merged].sort((a, b) => Number(b.pair?.priceChange?.h24 || 0) - Number(a.pair?.priceChange?.h24 || 0));
        if (filter === "volume") merged = [...merged].sort((a, b) => Number(b.pair?.volume?.h24 || 0) - Number(a.pair?.volume?.h24 || 0));
        setTokens(merged);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
      await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      const mockTrades = Array.from({ length: 40 }, () => ({
        type: Math.random() > 0.45 ? "buy" : "sell",
        amount: (Math.random() * 200000).toFixed(0),
        usd: (Math.random() * 10000).toFixed(2),
        time: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 7200),
        sig: Array.from({ length: 64 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join(""),
      })).sort((a, b) => b.time - a.time);
      setTrades(mockTrades);
    } catch (err) { console.error(err); }
    finally { setLoadingTrades(false); }
  }, []);

  const selectToken = (token) => {
    setSelected(token);
    if (token.pair?.pairAddress) fetchTrades(token.pair.pairAddress);
    if (isMobile) setMobileView("detail");
  };

  const pair = selected?.pair;
  const change24 = Number(pair?.priceChange?.h24 || 0);
  const change1h = Number(pair?.priceChange?.h1 || 0);
  const change5m = Number(pair?.priceChange?.m5 || 0);

  const TokenList = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Search */}
      <div style={{ padding: "10px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textDim, fontSize: 13 }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search token or CA..."
            style={{ width: "100%", padding: "8px 10px 8px 28px", borderRadius: 6, border: `1px solid ${C.border}`, background: "rgba(0,247,255,0.02)", color: C.text, fontFamily: mono, fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = C.cyanDim}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>
      </div>

      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 64px", padding: "6px 12px", fontSize: 9, letterSpacing: 2, color: C.textDim, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "rgba(0,247,255,0.01)" }}>
        <div>Token</div>
        <div style={{ textAlign: "right" }}>Price</div>
        <div style={{ textAlign: "right" }}>24h</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 11, color: C.textDim, fontFamily: mono, letterSpacing: 2 }}>
            // scanning...
          </div>
        )}
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
            <div key={token.tokenAddress + i} onClick={() => selectToken(token)}
              style={{
                display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 64px",
                padding: "10px 12px", cursor: "pointer",
                background: isSelected ? "rgba(0,247,255,0.04)" : "transparent",
                borderLeft: `2px solid ${isSelected ? C.cyan : "transparent"}`,
                borderBottom: `1px solid ${C.border}`,
                alignItems: "center", transition: "background 0.15s",
              }}
              onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,247,255,0.02)"; }}
              onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {img
                  ? <img src={img} style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: `1px solid ${C.border}` }} onError={e => e.target.style.display = "none"} />
                  : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,247,255,0.06)", border: `1px solid ${C.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.cyan }}>{sym.slice(0, 2)}</div>
                }
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 700, color: isSelected ? C.cyan : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sym}</div>
                  <div style={{ fontSize: 10, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: C.textMid, fontFamily: syne, fontWeight: 600 }}>{formatPrice(p.priceUsd)}</div>
              <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: isUp ? C.green : C.red, fontFamily: mono }}>
                {isUp ? "+" : ""}{ch.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const StatBox = ({ label, value, color }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 2, marginBottom: 2, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: syne, fontSize: isMobile ? 14 : 15, fontWeight: 700, color: color || C.text }}>{value}</div>
    </div>
  );

  const TokenDetail = () => {
    const buys = pair?.txns?.h24?.buys || 0;
    const sells = pair?.txns?.h24?.sells || 0;
    const total = buys + sells || 1;
    const buyPct = Math.round((buys / total) * 100);

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Detail header */}
        <div style={{ padding: isMobile ? "12px 14px" : "12px 18px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,247,255,0.015)", flexShrink: 0 }}>
          {isMobile && (
            <button onClick={() => setMobileView("list")} style={{ background: "transparent", border: "none", color: C.textDim, fontFamily: mono, fontSize: 10, cursor: "pointer", marginBottom: 10, padding: 0, letterSpacing: 1 }}>
              ← BACK
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {(selected?.icon || pair?.info?.imageUrl) && (
              <img src={selected?.icon || pair?.info?.imageUrl} style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${C.border}` }} onError={e => e.target.style.display = "none"} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: syne, fontSize: 18, fontWeight: 800, color: C.text }}>${pair?.baseToken?.symbol}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: mono }}>{pair?.baseToken?.name} · {pair?.dexId?.toUpperCase()}</div>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {/* Copy CA button */}
              <button
                onClick={() => { navigator.clipboard.writeText(selected?.tokenAddress || ''); }}
                title={selected?.tokenAddress}
                style={{ padding: "6px 10px", borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, fontFamily: mono, fontSize: 10, cursor: "pointer", letterSpacing: 1 }}
              >
                {(selected?.tokenAddress || '').slice(0,4)}...{(selected?.tokenAddress || '').slice(-4)} ⧉
              </button>
              <button onClick={() => setActiveMint(selected?.tokenAddress)}
                style={{ padding: "8px 18px", borderRadius: 5, border: `1px solid rgba(0,247,255,0.4)`, background: "rgba(0,247,255,0.08)", color: C.cyan, fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>
                BUY ◎
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: isMobile ? 14 : 24, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 2, marginBottom: 2 }}>PRICE</div>
              <div style={{ fontFamily: syne, fontSize: isMobile ? 18 : 20, fontWeight: 800, color: C.text }}>{formatPrice(pair?.priceUsd)}</div>
            </div>
            {[["5M", change5m], ["1H", change1h], ["24H", change24]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: syne, fontSize: isMobile ? 13 : 14, fontWeight: 700, color: Number(val) >= 0 ? C.green : C.red }}>
                  {Number(val) >= 0 ? "+" : ""}{Number(val).toFixed(2)}%
                </div>
              </div>
            ))}
            {[["VOL 24H", formatNum(pair?.volume?.h24)], ["LIQUIDITY", formatNum(pair?.liquidity?.usd)], ["MCAP", formatNum(pair?.marketCap)]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: syne, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: C.textMid }}>{val}</div>
              </div>
            ))}
            {!isMobile && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignSelf: "center" }}>
                <a href={`https://dexscreener.com/solana/${pair?.pairAddress}`} target="_blank" rel="noreferrer"
                  style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${C.border}`, color: C.textDim, fontFamily: mono, fontSize: 10, textDecoration: "none", letterSpacing: 1 }}>DEX ↗</a>
                <a href={`https://solscan.io/token/${selected?.tokenAddress}`} target="_blank" rel="noreferrer"
                  style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${C.border}`, color: C.textDim, fontFamily: mono, fontSize: 10, textDecoration: "none", letterSpacing: 1 }}>SCAN ↗</a>
              </div>
            )}
          </div>

          {isMobile && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {["chart", "trades"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)} style={{
                  flex: 1, padding: "7px", borderRadius: 5, fontFamily: mono, fontSize: 9,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  border: `1px solid ${detailTab === t ? C.cyanDim : C.border}`,
                  background: detailTab === t ? "rgba(0,247,255,0.06)" : "transparent",
                  color: detailTab === t ? C.cyan : C.textDim,
                }}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* Chart + trades body */}
        {isMobile ? (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {detailTab === "chart" && (
              <div style={{ height: "100%", minHeight: 400, position: "relative" }}>
                <iframe src={`https://dexscreener.com/solana/${pair?.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                  style={{ width: "100%", height: "calc(100% + 40px)", minHeight: 440, border: "none", marginBottom: -40 }} title="chart" />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: C.bg, zIndex: 10 }} />
              </div>
            )}
            {detailTab === "trades" && <TradesPanel buys={buys} sells={sells} buyPct={buyPct} />}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "hidden", borderRight: `1px solid ${C.border}`, position: "relative" }}>
              <iframe src={`https://dexscreener.com/solana/${pair?.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                style={{ width: "100%", height: "calc(100% + 40px)", border: "none", marginBottom: -40 }} title="chart" />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: C.bg, zIndex: 10 }} />
            </div>
            <TradesPanel buys={buys} sells={sells} buyPct={buyPct} />
          </div>
        )}
      </div>
    );
  };

  const TradesPanel = ({ buys, sells, buyPct }) => (
    <div style={{ width: isMobile ? "100%" : 280, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Buy/sell summary */}
      <div style={{ padding: "10px 10px 6px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          <div style={{ textAlign: "center", padding: "8px 6px", background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.12)", borderRadius: 6 }}>
            <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>BUYS 24H</div>
            <div style={{ fontFamily: syne, fontSize: 20, fontWeight: 800, color: C.green }}>{buys}</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 6px", background: "rgba(255,61,87,0.04)", border: "1px solid rgba(255,61,87,0.12)", borderRadius: 6 }}>
            <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 2, marginBottom: 3 }}>SELLS 24H</div>
            <div style={{ fontFamily: syne, fontSize: 20, fontWeight: 800, color: C.red }}>{sells}</div>
          </div>
        </div>
        {/* Buy pressure bar */}
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${buyPct}%`, background: `linear-gradient(90deg, ${C.green}, #00f7a0)`, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 8, color: C.green, fontFamily: mono }}>{buyPct}% buy</span>
          <span style={{ fontSize: 8, color: C.red, fontFamily: mono }}>{100 - buyPct}% sell</span>
        </div>
      </div>

      {/* Trades header */}
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 34px", padding: "6px 10px", fontSize: 8, letterSpacing: 2, color: C.textDim, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "rgba(0,247,255,0.01)" }}>
        <div></div><div>AMT</div><div style={{ textAlign: "right" }}>USD</div><div style={{ textAlign: "right" }}>AGE</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loadingTrades && <div style={{ padding: 20, textAlign: "center", fontSize: 10, color: C.textDim, fontFamily: mono, letterSpacing: 2 }}>// loading...</div>}
        {trades.map((trade, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 34px", padding: "7px 10px", borderBottom: `1px solid rgba(255,255,255,0.02)`, alignItems: "center", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.006)" }}>
            <div style={{ width: 18, height: 18, borderRadius: 3, background: trade.type === "buy" ? "rgba(0,230,118,0.12)" : "rgba(255,61,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: trade.type === "buy" ? C.green : C.red, fontFamily: mono }}>{trade.type === "buy" ? "B" : "S"}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: mono }}>{Number(trade.amount).toLocaleString()}</div>
            <div style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: trade.type === "buy" ? C.green : C.red, fontFamily: mono }}>${Number(trade.usd).toFixed(0)}</div>
            <div style={{ textAlign: "right" }}>
              <a href={`https://solscan.io/tx/${trade.sig}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: C.textDim, textDecoration: "none" }}>{timeAgo(trade.time)}</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", fontFamily: mono, background: C.bg, overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{ height: 40, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 14px", gap: 12, flexShrink: 0, background: "rgba(0,247,255,0.015)" }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.cyan, opacity: 0.5, textTransform: "uppercase", fontWeight: 700 }}>
          {isMobile ? "Terminal" : "Solchat Terminal"}
        </div>
        <div style={{ width: 1, height: 16, background: C.border }} />
        <div style={{ display: "flex", gap: 4 }}>
          {["trending", "gainers", "volume"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "3px 10px", borderRadius: 4, fontSize: 9,
              letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
              border: `1px solid ${filter === f ? C.cyanDim : C.border}`,
              background: filter === f ? "rgba(0,247,255,0.07)" : "transparent",
              color: filter === f ? C.cyan : C.textDim, fontFamily: mono, transition: "all 0.15s",
            }}>{f}</button>
          ))}
        </div>
        {!isMobile && (
          <div style={{ marginLeft: "auto", fontSize: 9, color: C.textDim, letterSpacing: 1 }}>
            {tokens.length} pairs · <span style={{ color: C.cyanDim }}>SOLANA</span>
          </div>
        )}
      </div>

      {isMobile ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          {mobileView === "list" && <TokenList />}
          {mobileView === "detail" && selected && pair && <TokenDetail />}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <TokenList />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
            {!selected
              ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 64, color: C.cyan, opacity: 0.04 }}>⬡</div>
                  <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 3, textTransform: "uppercase" }}>Select a token to analyze</div>
                </div>
              )
              : <TokenDetail />
            }
          </div>
        </div>
      )}

      {activeMint && <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />}
    </div>
  );
}
