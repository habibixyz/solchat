import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import SwapDrawer from "../components/SwapDrawer";

const mono = "'IBM Plex Mono','Space Mono',monospace";
const sans = "'DM Sans','Inter',sans-serif";

const C = {
  bg:       "#080c14",
  bgPanel:  "#0b0f1d",
  bgRow:    "#0d1120",
  bgRowHov: "#111828",
  bgRowSel: "#0d1d38",
  border:   "rgba(255,255,255,0.05)",
  borderBr: "rgba(255,255,255,0.08)",
  cyan:     "#22d3ee",
  cyanDim:  "rgba(34,211,238,0.1)",
  green:    "#22c55e",
  greenDim: "rgba(34,197,94,0.08)",
  red:      "#ef4444",
  redDim:   "rgba(239,68,68,0.08)",
  yellow:   "#f59e0b",
  text:     "#dde6f0",
  textMid:  "#8899aa",
  textDim:  "#3a4d62",
};

const scrollbarCSS = `
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #080c14; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
  * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) #080c14; }
`;

function fmtPrice(p) {
  if (!p) return "—";
  const n = Number(p);
  if (n === 0) return "$0";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 0.0001)   return `$${n.toFixed(7)}`;
  if (n < 0.01)     return `$${n.toFixed(5)}`;
  if (n < 1)        return `$${n.toFixed(4)}`;
  if (n < 1000)     return `$${n.toFixed(2)}`;
  return `$${(n/1000).toFixed(1)}K`;
}
function fmtNum(n) {
  if (!n && n !== 0) return "—";
  const v = Number(n);
  if (v >= 1e9) return `$${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtAge(ts) {
  const s = Math.floor((Date.now() - ts*1000)/1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  return `${Math.floor(s/3600)}h`;
}

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

function TokenAvatar({ src, sym, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const colors = ["#6366f1","#22d3ee","#f59e0b","#ec4899","#10b981","#8b5cf6","#f97316","#06b6d4"];
  const col = colors[((sym||"?").charCodeAt(0)+(sym||"?").length)%colors.length];
  if (src && !failed) {
    return (
      <img
        src={src}
        onError={() => setFailed(true)}
        style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, objectFit:"cover", border:`1px solid ${col}33`, display:"block" }}
      />
    );
  }
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, background:`${col}1a`, border:`1px solid ${col}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.32, fontWeight:700, color:col, fontFamily:mono, overflow:"hidden" }}>
      {(sym||"?").slice(0,2).toUpperCase()}
    </div>
  );
}

function PctBadge({ val, size=13 }) {
  const n = Number(val||0);
  return <span style={{ fontSize:size, fontWeight:700, fontFamily:mono, color:n>0?C.green:n<0?C.red:C.textMid, letterSpacing:-0.3 }}>{n>=0?"+":""}{n.toFixed(2)}%</span>;
}

function BoostBadge({ amount }) {
  if (!amount) return null;
  return <span style={{ fontSize:9, fontFamily:mono, color:C.yellow, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.18)", borderRadius:3, padding:"1px 4px", letterSpacing:1, flexShrink:0 }}>⚡{amount>=1000?`${(amount/1000).toFixed(0)}K`:amount}</span>;
}

// ── Ad Panel ────────────────────────────────────────────────────
function AdPanel({ ads, wallet, connection, isMobileView=false }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", ticker:"", desc:"", url:"", twitter:"" });
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [err, setErr] = useState("");

  const SOLCHAT_WALLET = import.meta.env.VITE_SOLCHAT_WALLET;
  const PROMOTE_FEE_SOL = 0.2;

  async function handlePay() {
    if (!wallet?.publicKey) { setErr("Connect your wallet first"); return; }
    if (!form.name || !form.ticker) { setErr("Name and ticker required"); return; }
    if (!form.twitter) { setErr("Twitter handle required"); return; }
    if (!SOLCHAT_WALLET) { setErr("Payment wallet not configured"); return; }
    setErr(""); setPaying(true);
    try {
      const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const lamports = Math.round(PROMOTE_FEE_SOL * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(SOLCHAT_WALLET),
          lamports,
        })
      );
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(sig, "confirmed");

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ad_submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          name: form.name,
          ticker: form.ticker,
          description: form.desc,
          url: form.url,
          twitter: form.twitter.replace(/^@/,""),
          wallet_address: wallet.publicKey?.toBase58?.(),
          tx_signature: sig,
          status: "pending",
          submitted_at: new Date().toISOString(),
        })
      });

      setPaid(true);
      setForm({ name:"", ticker:"", desc:"", url:"", twitter:"" });
    } catch(e) {
      console.error(e);
      setErr(e?.message?.includes("rejected") ? "Transaction cancelled" : e?.message || "Payment failed");
    }
    setPaying(false);
  }

  return (
    <div style={{
      width: isMobileView ? "100%" : 220,
      flexShrink: isMobileView ? undefined : 0,
      borderLeft: isMobileView ? "none" : `1px solid ${C.border}`,
      display:"flex", flexDirection:"column",
      background:C.bgPanel,
      overflowY: "auto",
    }}>
      <div style={{ padding:"12px 12px 8px", flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:C.textDim, fontFamily:mono, letterSpacing:3, marginBottom:6 }}>PROMOTED</div>
        <div style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:8, padding:"10px" }}>
          <div style={{ fontSize:12, color:C.textMid, lineHeight:1.5, marginBottom:4 }}>Pin your token here for <strong style={{ color:C.text }}>24 hours</strong></div>
          <div style={{ fontSize:18, fontWeight:800, color:C.yellow, fontFamily:mono }}>0.2 SOL</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>Pay directly with your wallet</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"0 0 8px" }}>
        {ads.length === 0 ? (
          <div style={{ padding:"20px 14px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:0.15 }}>📢</div>
            <div style={{ fontSize:11, color:C.textDim, fontFamily:mono, lineHeight:1.8 }}>No promoted tokens yet</div>
            <div style={{ fontSize:11, color:C.textDim, fontFamily:mono }}>Be the first!</div>
          </div>
        ) : ads.map((ad, i) => (
          <a key={i} href={ad.url||"#"} target="_blank" rel="noreferrer"
            style={{ display:"block", padding:"12px", margin:"4px 8px", borderRadius:8, border:`1px solid ${C.border}`, textDecoration:"none", background:C.bgRow }}
            onMouseOver={e=>e.currentTarget.style.borderColor=C.cyan+"44"}
            onMouseOut={e=>e.currentTarget.style.borderColor=C.border}
          >
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              {ad.icon && <img src={ad.icon} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}` }} onError={e=>e.target.style.display="none"} />}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.cyan }}>{ad.ticker}</div>
                <div style={{ fontSize:10, color:C.textDim }}>{ad.name}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:C.textMid, lineHeight:1.4 }}>{ad.desc}</div>
            <div style={{ fontSize:9, color:C.yellow, fontFamily:mono, marginTop:6 }}>AD · 24H PROMO</div>
          </a>
        ))}
      </div>

      {paid ? (
        <div style={{ margin:"8px 10px 12px", padding:"12px", borderRadius:8, border:"1px solid rgba(34,197,94,0.3)", background:"rgba(34,197,94,0.06)", textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:16, marginBottom:4 }}>✓</div>
          <div style={{ fontSize:12, color:C.green, fontFamily:mono, fontWeight:700 }}>Payment sent!</div>
          <div style={{ fontSize:10, color:C.textDim, fontFamily:mono, marginTop:4, lineHeight:1.5 }}>We'll add your token within 1 hour</div>
          <button onClick={()=>setPaid(false)} style={{ marginTop:8, background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textDim, fontFamily:mono, fontSize:10, cursor:"pointer", padding:"3px 10px" }}>Submit another</button>
        </div>
      ) : !showForm ? (
        <button onClick={()=>setShowForm(true)}
          style={{ margin:"8px 10px 12px", padding:"10px", borderRadius:8, border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.06)", color:C.yellow, fontFamily:mono, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:1, flexShrink:0 }}>
          + PROMOTE TOKEN
        </button>
      ) : (
        <div style={{ padding:"10px 12px 12px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ fontSize:9, color:C.textDim, fontFamily:mono, letterSpacing:2, marginBottom:8 }}>SUBMIT AD · 0.2 SOL</div>
          {[
            ["Token Name *","name","e.g. ChibiBeast"],
            ["Ticker *","ticker","e.g. CHIBI"],
            ["Twitter Handle *","twitter","@yourhandle"],
            ["Description","desc","One line pitch"],
            ["Website / Link","url","https://..."],
          ].map(([ph,key,hint])=>(
            <div key={key} style={{ marginBottom:6 }}>
              <input value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={ph}
                style={{ width:"100%", padding:"7px 8px", borderRadius:6, border:`1px solid ${key==="twitter"&&!form.twitter&&err?C.red+"55":C.border}`, background:C.bgRow, color:C.text, fontFamily:mono, fontSize:11, outline:"none", boxSizing:"border-box" }} />
              <div style={{ fontSize:9, color:C.textDim, fontFamily:mono, marginTop:1 }}>{hint}</div>
            </div>
          ))}
          <div style={{ fontSize:10, fontFamily:mono, margin:"8px 0 6px", padding:"7px 8px", borderRadius:6, background:C.bgRow, border:`1px solid ${C.border}` }}>
            {wallet?.publicKey
              ? <span style={{ color:C.green }}>✓ Wallet: {wallet.publicKey?.toBase58?.().slice(0,6)}…{wallet.publicKey?.toBase58?.().slice(-4)}</span>
              : <span style={{ color:C.yellow }}>⚠ Connect wallet to pay</span>
            }
          </div>
          {err && <div style={{ fontSize:10, color:C.red, fontFamily:mono, marginBottom:6, lineHeight:1.4 }}>⚠ {err}</div>}
          <div style={{ display:"flex", gap:6, marginTop:4 }}>
            <button onClick={()=>{ setShowForm(false); setErr(""); }}
              style={{ flex:1, padding:"7px", borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", color:C.textDim, fontFamily:mono, fontSize:10, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={handlePay} disabled={paying || !wallet?.publicKey}
              style={{ flex:1, padding:"7px", borderRadius:6, border:"1px solid rgba(245,158,11,0.4)", background: paying?"rgba(245,158,11,0.03)":"rgba(245,158,11,0.08)", color: paying?C.textDim:C.yellow, fontFamily:mono, fontSize:10, cursor: paying||!wallet?.publicKey?"not-allowed":"pointer", fontWeight:700 }}>
              {paying ? "Sending..." : "PAY 0.2 SOL"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { w: winW } = useWindowSize();

  // Responsive breakpoints — single source of truth
  const isMobile  = winW < 640;
  const isTablet  = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;

  const [tokens,        setTokens]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [selected,      setSelected]      = useState(null);
  const [boostMap,      setBoostMap]      = useState({});
  const [trades,        setTrades]        = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [activeMint,    setActiveMint]    = useState(null);
  const [filter,        setFilter]        = useState("trending");
  const [sortCol,       setSortCol]       = useState(null);
  const [sortDir,       setSortDir]       = useState("desc");
  const [mobileView,    setMobileView]    = useState("list");   // "list" | "detail" | "promote"
  const [detailTab,     setDetailTab]     = useState("chart");  // "chart" | "trades"
  const iframeRef = useRef(null);
  const [ads] = useState([]);

  // Navbar height to offset fixed positioning — keeps layout consistent
  const NAVBAR_H = 64;
  // Bottom tab bar height on mobile
  const BOTTOM_TAB_H = 52;

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = scrollbarCSS;
    style.id = "discover-scrollbar";
    if (!document.getElementById("discover-scrollbar")) document.head.appendChild(style);
    return () => document.getElementById("discover-scrollbar")?.remove();
  }, []);

  const fetchTokens = useCallback(async (query="") => {
    setLoading(true);
    try {
      if (query) {
        const data = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`).then(r=>r.json());
        const pairs = (data?.pairs||[]).filter(p=>p.chainId==="solana"&&Number(p.liquidity?.usd||0)>500).slice(0,100);
        setTokens(pairs.map(p=>({ pair:p, tokenAddress:p.baseToken?.address, icon:p.info?.imageUrl, boostAmount:0 })));
      } else {
        const boostData = await fetch("https://api.dexscreener.com/token-boosts/top/v1").then(r=>r.json()).catch(()=>[]);
        const boosts = Array.isArray(boostData) ? boostData.filter(t=>t.chainId==="solana") : [];
        const bmap = {};
        boosts.forEach(b=>{ bmap[b.tokenAddress]=b.totalAmount||b.amount||0; });
        setBoostMap(bmap);
        if (!boosts.length) {
          const fdata = await fetch("https://api.dexscreener.com/latest/dex/search?q=solana").then(r=>r.json());
          const pairs = (fdata?.pairs||[]).filter(p=>p.chainId==="solana"&&Number(p.liquidity?.usd||0)>5000).slice(0,100);
          setTokens(pairs.map(p=>({ pair:p, tokenAddress:p.baseToken?.address, icon:p.info?.imageUrl, boostAmount:0 })));
          return;
        }
        const allBoosts = boosts.slice(0,80);
        let pairs = [];
        for (let i = 0; i < allBoosts.length; i += 30) {
          const chunk = allBoosts.slice(i, i+30);
          const addresses = chunk.map(t=>t.tokenAddress).join(",");
          try {
            const priceData = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`).then(r=>r.json());
            pairs = pairs.concat(priceData?.pairs||[]);
          } catch(e) { console.error("chunk fetch failed", e); }
        }
        let merged = allBoosts.map(t=>({
          tokenAddress:t.tokenAddress,
          pair:pairs.find(p=>p.baseToken?.address===t.tokenAddress&&p.chainId==="solana"),
          icon:pairs.find(p=>p.baseToken?.address===t.tokenAddress)?.info?.imageUrl||t.icon||t.url,
          boostAmount:t.totalAmount||t.amount||0,
        })).filter(t=>t.pair&&Number(t.pair.liquidity?.usd||0)>500);
        if (filter==="gainers") merged.sort((a,b)=>Number(b.pair?.priceChange?.h24||0)-Number(a.pair?.priceChange?.h24||0));
        if (filter==="volume")  merged.sort((a,b)=>Number(b.pair?.volume?.h24||0)-Number(a.pair?.volume?.h24||0));
        setTokens(merged);
      }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(()=>{ fetchTokens(); },[filter]);
  useEffect(()=>{ const t=setTimeout(()=>fetchTokens(search),500); return ()=>clearTimeout(t); },[search]);

  const sortedTokens = sortCol ? [...tokens].sort((a,b)=>{
    if(!a.pair||!b.pair) return 0;
    const d=sortDir==="desc"?-1:1;
    const m={
      price:()=>Number(b.pair.priceUsd||0)-Number(a.pair.priceUsd||0),
      m5:()=>Number(b.pair.priceChange?.m5||0)-Number(a.pair.priceChange?.m5||0),
      h1:()=>Number(b.pair.priceChange?.h1||0)-Number(a.pair.priceChange?.h1||0),
      h24:()=>Number(b.pair.priceChange?.h24||0)-Number(a.pair.priceChange?.h24||0),
      volume:()=>Number(b.pair.volume?.h24||0)-Number(a.pair.volume?.h24||0),
      liq:()=>Number(b.pair.liquidity?.usd||0)-Number(a.pair.liquidity?.usd||0),
      mcap:()=>Number(b.pair.marketCap||0)-Number(a.pair.marketCap||0),
      txns:()=>(Number(b.pair.txns?.h24?.buys||0)+Number(b.pair.txns?.h24?.sells||0))-(Number(a.pair.txns?.h24?.buys||0)+Number(a.pair.txns?.h24?.sells||0)),
      buys:()=>Number(b.pair.txns?.h24?.buys||0)-Number(a.pair.txns?.h24?.buys||0),
      sells:()=>Number(b.pair.txns?.h24?.sells||0)-Number(a.pair.txns?.h24?.sells||0),
    };
    return m[sortCol]?m[sortCol]()*d:0;
  }):tokens;

  const handleSort = col=>{if(sortCol===col)setSortDir(d=>d==="desc"?"asc":"desc");else{setSortCol(col);setSortDir("desc");}};

  const loadTrades = useCallback(async (pairAddress) => {
    if (!pairAddress) return;
    setLoadingTrades(true);
    setTrades([]);
    try {
      const data = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`).then(r=>r.json());
      const pair = data?.pairs?.[0];
      const buys  = pair?.txns?.h24?.buys  || 0;
      const sells = pair?.txns?.h24?.sells || 0;
      const volH24 = Number(pair?.volume?.h24 || 0);
      const price  = Number(pair?.priceUsd || 0);
      const total  = buys + sells || 1;
      const count = Math.min(80, total);
      const buyCount = Math.round((buys/total)*count);
      const mockTrades = Array.from({ length:count }, (_, i) => {
        const isBuy = i < buyCount;
        const avgTrade = volH24 / total;
        const usd = Math.max(1, avgTrade * (0.2 + Math.random() * 2)).toFixed(2);
        const tokens = price > 0 ? (Number(usd)/price).toFixed(0) : "0";
        return {
          type:isBuy?"buy":"sell", usd, tokens,
          time:Math.floor(Date.now()/1000)-Math.floor(Math.random()*3600),
          sig:Array.from({length:44},()=>"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random()*58)]).join(""),
          pairAddress
        };
      });
      for(let i=mockTrades.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mockTrades[i],mockTrades[j]]=[mockTrades[j],mockTrades[i]];}
      mockTrades.sort((a,b)=>b.time-a.time);
      setTrades(mockTrades);
    } catch(e){ console.error(e); }
    finally { setLoadingTrades(false); }
  }, []);

  const selectToken = useCallback((token) => {
    if (iframeRef.current && token.pair?.pairAddress) {
      iframeRef.current.src = `https://dexscreener.com/solana/${token.pair.pairAddress}?embed=1&theme=dark&trades=0&info=0&chartLeftToolbar=0`;
    }
    setSelected(token);
    loadTrades(token.pair?.pairAddress);
    if (window.innerWidth < 1024) {
      setMobileView("detail");
      setDetailTab("chart");
    }
  }, [loadTrades]);

  const goBack = useCallback(()=>{ setSelected(null); setMobileView("list"); },[]);

  const pair   = selected?.pair;
  const buys   = pair?.txns?.h24?.buys  || 0;
  const sells  = pair?.txns?.h24?.sells || 0;
  const buyPct = Math.round((buys/(buys+sells||1))*100);

  // ── Narrow row (used in sidebars and mobile list) ─────────────
  const NarrowRow = ({ token }) => {
    const p=token.pair; if(!p) return null;
    const isSel=selected?.tokenAddress===token.tokenAddress;
    const sym=p.baseToken?.symbol||"?";
    const img=token.icon||p.info?.imageUrl;
    return (
      <div onClick={()=>selectToken(token)}
        style={{ display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderBottom:`1px solid ${C.border}`,background:isSel?C.bgRowSel:"transparent",cursor:"pointer",borderLeft:`2px solid ${isSel?C.cyan:"transparent"}` }}
        onMouseOver={e=>{ if(!isSel) e.currentTarget.style.background=C.bgRowHov; }}
        onMouseOut={e=> { if(!isSel) e.currentTarget.style.background="transparent"; }}
      >
        <TokenAvatar src={img} sym={sym} size={34} />
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ fontSize:14,fontWeight:700,color:isSel?C.cyan:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{sym}</span>
          </div>
          <div style={{ fontSize:11,color:C.textDim,fontFamily:mono }}>{fmtNum(p.volume?.h24)} vol</div>
        </div>
        <div style={{ textAlign:"right",flexShrink:0,minWidth:80 }}>
          <div style={{ fontSize:13,color:C.text,fontFamily:mono,fontWeight:600 }}>{fmtPrice(p.priceUsd)}</div>
          <PctBadge val={p.priceChange?.h24} size={12} />
        </div>
      </div>
    );
  };

  // ── Trades panel ─────────────────────────────────────────────
  const TradesPanel = () => (
    <div style={{ width:(isMobile||isTablet)?"100%":240, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden", borderLeft:(isMobile||isTablet)?"none":`1px solid ${C.border}` }}>
      <div style={{ padding:"10px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
          <div style={{ background:C.greenDim, border:`1px solid rgba(34,197,94,0.12)`, borderRadius:7, padding:"8px 6px", textAlign:"center" }}>
            <div style={{ fontSize:8, color:C.textDim, fontFamily:mono, letterSpacing:2, marginBottom:2 }}>BUYS 24H</div>
            <div style={{ fontSize:17, fontWeight:800, color:C.green, fontFamily:sans }}>{buys.toLocaleString()}</div>
          </div>
          <div style={{ background:C.redDim, border:`1px solid rgba(239,68,68,0.12)`, borderRadius:7, padding:"8px 6px", textAlign:"center" }}>
            <div style={{ fontSize:8, color:C.textDim, fontFamily:mono, letterSpacing:2, marginBottom:2 }}>SELLS 24H</div>
            <div style={{ fontSize:17, fontWeight:800, color:C.red, fontFamily:sans }}>{sells.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.04)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${buyPct}%`, background:`linear-gradient(90deg,${C.green},#4ade80)`, borderRadius:2, transition:"width 0.6s" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
          <span style={{ fontSize:9, color:C.green, fontFamily:mono }}>{buyPct}% buys</span>
          <span style={{ fontSize:9, color:C.red, fontFamily:mono }}>{100-buyPct}% sells</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"18px 1fr 42px", padding:"5px 10px", fontSize:9, letterSpacing:1, color:C.textDim, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, background:C.bgPanel, fontFamily:mono, flexShrink:0 }}>
        <div/><div>USD</div><div style={{ textAlign:"right" }}>AGO</div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {loadingTrades && <div style={{ padding:20, textAlign:"center", fontSize:11, color:C.textDim, fontFamily:mono }}>loading trades...</div>}
        {trades.map((tr, i) => (
          <a key={i}
            href={`https://dexscreener.com/solana/${tr.pairAddress}`}
            target="_blank" rel="noreferrer"
            title="View pair on DexScreener"
            style={{ display:"grid", gridTemplateColumns:"18px 1fr 42px", padding:"6px 10px", borderBottom:`1px solid rgba(255,255,255,0.03)`, alignItems:"center", textDecoration:"none", cursor:"pointer", background:"transparent" }}
            onMouseOver={e=>{ e.currentTarget.style.background=tr.type==="buy"?"rgba(34,197,94,0.04)":"rgba(239,68,68,0.04)"; }}
            onMouseOut={e=>{ e.currentTarget.style.background="transparent"; }}
          >
            <div style={{ width:14, height:14, borderRadius:3, background:tr.type==="buy"?C.greenDim:C.redDim, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:7, fontWeight:700, color:tr.type==="buy"?C.green:C.red, fontFamily:mono }}>{tr.type==="buy"?"B":"S"}</span>
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:tr.type==="buy"?C.green:C.red, fontFamily:mono }}>
              ${Number(tr.usd).toLocaleString(undefined,{maximumFractionDigits:0})}
              <span style={{ fontSize:9, color:C.textDim, marginLeft:4 }}>↗</span>
            </div>
            <div style={{ textAlign:"right", fontSize:10, color:C.textDim, fontFamily:mono }}>{fmtAge(tr.time)}</div>
          </a>
        ))}
      </div>
    </div>
  );

  // ── Detail header ─────────────────────────────────────────────
  const DetailHeaderContent = () => {
    if (!pair) return null;
    const img = selected?.icon || pair?.info?.imageUrl;
    const sym = pair?.baseToken?.symbol;
    return (
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:C.bgPanel, position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
          <TokenAvatar src={img} sym={sym} size={38} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:18, fontWeight:700, color:C.text, fontFamily:sans }}>${sym}</span>
              <BoostBadge amount={selected?.boostAmount||boostMap[selected?.tokenAddress]} />
              <span style={{ fontSize:11, color:C.textDim, fontFamily:mono, background:"rgba(255,255,255,0.04)", padding:"2px 6px", borderRadius:4 }}>{pair?.dexId?.toUpperCase()}</span>
            </div>
            <div style={{ fontSize:11, color:C.textDim }}>{pair?.baseToken?.name}</div>
          </div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            <button onClick={()=>navigator.clipboard.writeText(selected?.tokenAddress||"")}
              style={{ padding:"5px 9px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:C.textDim, fontFamily:mono, fontSize:10, cursor:"pointer" }}>
              {(selected?.tokenAddress||"").slice(0,4)}…{(selected?.tokenAddress||"").slice(-4)} ⧉
            </button>
            <button onClick={()=>setActiveMint(selected?.tokenAddress)}
              style={{ padding:"7px 16px", borderRadius:6, border:`1px solid ${C.cyan}55`, background:C.cyanDim, color:C.cyan, fontFamily:mono, fontSize:12, fontWeight:700, letterSpacing:1, cursor:"pointer" }}>
              BUY ◎
            </button>
          </div>
        </div>

        {/* Stats grid — wraps on small screens */}
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
          {[
            ["PRICE",     fmtPrice(pair?.priceUsd),    C.text],
            ["5M",        `${Number(pair?.priceChange?.m5||0)>=0?"+":""}${Number(pair?.priceChange?.m5||0).toFixed(2)}%`,  Number(pair?.priceChange?.m5||0)>=0?C.green:C.red],
            ["1H",        `${Number(pair?.priceChange?.h1||0)>=0?"+":""}${Number(pair?.priceChange?.h1||0).toFixed(2)}%`,  Number(pair?.priceChange?.h1||0)>=0?C.green:C.red],
            ["24H",       `${Number(pair?.priceChange?.h24||0)>=0?"+":""}${Number(pair?.priceChange?.h24||0).toFixed(2)}%`,Number(pair?.priceChange?.h24||0)>=0?C.green:C.red],
            ["VOL 24H",   fmtNum(pair?.volume?.h24),   C.textMid],
            ["LIQUIDITY", fmtNum(pair?.liquidity?.usd),C.textMid],
            ["MCAP",      fmtNum(pair?.marketCap),     C.textMid],
            ["TXNS",      (buys+sells).toLocaleString(),C.textMid],
            ["BUYS",      buys.toLocaleString(),        C.green],
            ["SELLS",     sells.toLocaleString(),       C.red],
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:C.bgRow, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 10px", minWidth:52 }}>
              <div style={{ fontSize:8, color:C.textDim, fontFamily:mono, letterSpacing:2, marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:12, fontWeight:700, color:c, fontFamily:mono }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {pair?.info?.websites?.[0]?.url&&<a href={pair.info.websites[0].url} target="_blank" rel="noreferrer" style={{ fontSize:11,color:C.textDim,fontFamily:mono,textDecoration:"none",padding:"3px 9px",border:`1px solid ${C.border}`,borderRadius:5 }}>🌐 Web</a>}
          {pair?.info?.socials?.find(s=>s.type==="twitter")&&<a href={pair.info.socials.find(s=>s.type==="twitter").url} target="_blank" rel="noreferrer" style={{ fontSize:11,color:C.textDim,fontFamily:mono,textDecoration:"none",padding:"3px 9px",border:`1px solid ${C.border}`,borderRadius:5 }}>𝕏 Twitter</a>}
          <a href={`https://dexscreener.com/solana/${pair?.pairAddress}`} target="_blank" rel="noreferrer" style={{ fontSize:11,color:C.textDim,fontFamily:mono,textDecoration:"none",padding:"3px 9px",border:`1px solid ${C.border}`,borderRadius:5 }}>DEX ↗</a>
          <a href={`https://solscan.io/token/${selected?.tokenAddress}`} target="_blank" rel="noreferrer" style={{ fontSize:11,color:C.textDim,fontFamily:mono,textDecoration:"none",padding:"3px 9px",border:`1px solid ${C.border}`,borderRadius:5 }}>SCAN ↗</a>
        </div>
      </div>
    );
  };

  // ── Desktop full-width token row ─────────────────────────────
  const COLS = [
    {col:"price", label:"Price",  w:"10%", minW:110},
    {col:"m5",    label:"5M",     w:"6%",  minW:72},
    {col:"h1",    label:"1H",     w:"6%",  minW:72},
    {col:"h24",   label:"24H",    w:"7%",  minW:80},
    {col:"volume",label:"Volume", w:"9%",  minW:96},
    {col:"txns",  label:"Txns",   w:"6%",  minW:72},
    {col:"liq",   label:"Liq",    w:"8%",  minW:88},
    {col:"mcap",  label:"MCap",   w:"8%",  minW:88},
    {col:"buys",  label:"Buys",   w:"6%",  minW:72},
    {col:"sells", label:"Sells",  w:"6%",  minW:72},
  ];

  const TokenRow = ({ token, idx }) => {
    const p=token.pair; if(!p) return null;
    const isSel=selected?.tokenAddress===token.tokenAddress;
    const sym=p.baseToken?.symbol||"?";
    const img=token.icon||p.info?.imageUrl;
    const boost=token.boostAmount||boostMap[token.tokenAddress];
    const txns=(p.txns?.h24?.buys||0)+(p.txns?.h24?.sells||0);
    return (
      <div onClick={()=>selectToken(token)}
        style={{ display:"flex", alignItems:"center", padding:"0 14px", height:56, cursor:"pointer", background:isSel?C.bgRowSel:"transparent", borderBottom:`1px solid ${C.border}`, borderLeft:`2px solid ${isSel?C.cyan:"transparent"}`, transition:"background 0.1s", minWidth:900 }}
        onMouseOver={e=>{ if(!isSel) e.currentTarget.style.background=C.bgRowHov; }}
        onMouseOut={e=> { if(!isSel) e.currentTarget.style.background="transparent"; }}
      >
        <div style={{ width:30,fontSize:12,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{idx+1}</div>
        <div style={{ flex:1,display:"flex",alignItems:"center",gap:10,minWidth:0,paddingRight:8 }}>
          <TokenAvatar src={img} sym={sym} size={32} />
          <div style={{ minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:14,fontWeight:700,color:isSel?C.cyan:C.text,fontFamily:sans }}>{sym}</span>
              {boost>0&&<BoostBadge amount={boost} />}
            </div>
            <div style={{ fontSize:11,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220 }}>{p.baseToken?.name}</div>
          </div>
        </div>
        <div style={{ width:"10%",minWidth:110,textAlign:"right",fontSize:14,fontWeight:700,color:C.text,fontFamily:mono,flexShrink:0 }}>{fmtPrice(p.priceUsd)}</div>
        <div style={{ width:"6%",minWidth:72,textAlign:"right",flexShrink:0 }}><PctBadge val={p.priceChange?.m5} /></div>
        <div style={{ width:"6%",minWidth:72,textAlign:"right",flexShrink:0 }}><PctBadge val={p.priceChange?.h1} /></div>
        <div style={{ width:"7%",minWidth:80,textAlign:"right",flexShrink:0 }}><PctBadge val={p.priceChange?.h24} /></div>
        <div style={{ width:"9%",minWidth:96,textAlign:"right",fontSize:13,fontWeight:600,color:C.textMid,fontFamily:mono,flexShrink:0 }}>{fmtNum(p.volume?.h24)}</div>
        <div style={{ width:"6%",minWidth:72,textAlign:"right",fontSize:13,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{txns.toLocaleString()}</div>
        <div style={{ width:"8%",minWidth:88,textAlign:"right",fontSize:13,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{fmtNum(p.liquidity?.usd)}</div>
        <div style={{ width:"8%",minWidth:88,textAlign:"right",fontSize:13,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{fmtNum(p.marketCap)}</div>
        <div style={{ width:"6%",minWidth:72,textAlign:"right",fontSize:13,fontWeight:700,color:C.green,fontFamily:mono,flexShrink:0 }}>{(p.txns?.h24?.buys||0).toLocaleString()}</div>
        <div style={{ width:"6%",minWidth:72,textAlign:"right",fontSize:13,fontWeight:700,color:C.red,fontFamily:mono,flexShrink:0 }}>{(p.txns?.h24?.sells||0).toLocaleString()}</div>
      </div>
    );
  };

  // ── Top bar ───────────────────────────────────────────────────
  const TopBar = () => (
    <div style={{ height:isMobile?38:42, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 12px", gap:8, flexShrink:0, background:C.bgPanel, position:"relative", zIndex:20 }}>
      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
        <button onClick={()=>navigate(-1)} title="Go back"
          style={{ width:26,height:26,borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.textMid,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>‹</button>
        <button onClick={()=>navigate(1)} title="Go forward"
          style={{ width:26,height:26,borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.textMid,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>›</button>
      </div>

      {selected && !isDesktop
        ? <button onClick={goBack} style={{ background:"none",border:`1px solid ${C.border}`,borderRadius:5,color:C.textMid,fontFamily:mono,fontSize:10,cursor:"pointer",padding:"3px 9px",letterSpacing:1,flexShrink:0 }}>← DISCOVER</button>
        : (!isMobile && <div style={{ fontSize:11,letterSpacing:3,color:C.cyan,fontWeight:700,fontFamily:mono,opacity:0.55,flexShrink:0 }}>SOLCHAT TERMINAL</div>)
      }

      {!isMobile && <div style={{ width:1,height:16,background:C.border,flexShrink:0 }} />}

      <div style={{ display:"flex",gap:3,flexShrink:0 }}>
        {["trending","gainers","volume"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:isMobile?"4px 8px":"4px 11px",borderRadius:5,fontSize:isMobile?10:11,fontFamily:mono,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",border:`1px solid ${filter===f?C.cyan+"55":C.border}`,background:filter===f?C.cyanDim:"transparent",color:filter===f?C.cyan:C.textDim,transition:"all 0.12s",whiteSpace:"nowrap" }}>
            {f}
          </button>
        ))}
      </div>

      {!isMobile && (
        <div style={{ marginLeft:"auto",position:"relative" }}>
          <span style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.textDim,fontSize:13 }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search token or CA..."
            style={{ width:196,padding:"6px 10px 6px 26px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bgRow,color:C.text,fontFamily:mono,fontSize:12,outline:"none" }}
            onFocus={e=>e.target.style.borderColor=C.cyan+"44"}
            onBlur={e=> e.target.style.borderColor=C.border}
          />
        </div>
      )}
      {!isMobile && <div style={{ fontSize:11,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{tokens.length} pairs · <span style={{ color:C.cyan+"77" }}>SOLANA</span></div>}
    </div>
  );

  // ── Mobile bottom tab bar ────────────────────────────────────
  const MobileTabBar = () => (
    <div style={{ height:BOTTOM_TAB_H, flexShrink:0, borderTop:`1px solid ${C.border}`, display:"flex", background:C.bgPanel, position:"relative", zIndex:20 }}>
      <button onClick={()=>setMobileView("list")}
        style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background:"none", border:"none", cursor:"pointer", borderRight:`1px solid ${C.border}`, color: mobileView==="list" ? C.cyan : C.textDim }}>
        <span style={{ fontSize:16 }}>☰</span>
        <span style={{ fontSize:9, fontFamily:mono, letterSpacing:1 }}>LIST</span>
      </button>
      <button onClick={()=>{ if(selected) { setMobileView("detail"); setDetailTab("chart"); } }}
        style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background:"none", border:"none", cursor: selected?"pointer":"not-allowed", borderRight:`1px solid ${C.border}`, color: mobileView==="detail" && detailTab==="chart" ? C.cyan : selected ? C.textMid : C.textDim, opacity: selected ? 1 : 0.4 }}>
        <span style={{ fontSize:16 }}>📈</span>
        <span style={{ fontSize:9, fontFamily:mono, letterSpacing:1 }}>CHART</span>
      </button>
      <button onClick={()=>{ if(selected) { setMobileView("detail"); setDetailTab("trades"); } }}
        style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background:"none", border:"none", cursor: selected?"pointer":"not-allowed", borderRight:`1px solid ${C.border}`, color: mobileView==="detail" && detailTab==="trades" ? C.cyan : selected ? C.textMid : C.textDim, opacity: selected ? 1 : 0.4 }}>
        <span style={{ fontSize:16 }}>⚡</span>
        <span style={{ fontSize:9, fontFamily:mono, letterSpacing:1 }}>TRADES</span>
      </button>
      <button onClick={()=>setMobileView("promote")}
        style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, background:"none", border:"none", cursor:"pointer", color: mobileView==="promote" ? C.yellow : C.textDim }}>
        <span style={{ fontSize:16 }}>📢</span>
        <span style={{ fontSize:9, fontFamily:mono, letterSpacing:1 }}>PROMOTE</span>
      </button>
    </div>
  );

  // ── Tablet simplified table header & rows ────────────────────
  const TabletTableHeader = () => (
    <div style={{ display:"flex", alignItems:"center", padding:"0 12px", height:34, background:C.bgPanel, borderBottom:`1px solid ${C.borderBr}`, flexShrink:0 }}>
      <div style={{ width:28, flexShrink:0 }} />
      <div style={{ flex:1, fontSize:10, fontWeight:600, color:C.textDim, fontFamily:mono, letterSpacing:1, textTransform:"uppercase" }}>TOKEN</div>
      {[
        {col:"price", label:"Price",  w:"18%"},
        {col:"h1",    label:"1H",     w:"11%"},
        {col:"h24",   label:"24H",    w:"12%"},
        {col:"volume",label:"Volume", w:"15%"},
        {col:"mcap",  label:"MCap",   w:"13%"},
      ].map(({col,label,w}) => (
        <div key={col} onClick={() => handleSort(col)}
          style={{ width:w, textAlign:"right", fontSize:10, fontWeight:600, fontFamily:mono, letterSpacing:1, textTransform:"uppercase", color:sortCol===col?C.cyan:C.textDim, cursor:"pointer", userSelect:"none", flexShrink:0 }}>
          {label}{sortCol===col ? (sortDir==="desc"?" ↓":" ↑") : ""}
        </div>
      ))}
    </div>
  );

  const TabletRow = ({ token, idx }) => {
    const p = token.pair; if (!p) return null;
    const isSel = selected?.tokenAddress === token.tokenAddress;
    const sym = p.baseToken?.symbol || "?";
    const img = token.icon || p.info?.imageUrl;
    return (
      <div onClick={() => selectToken(token)}
        style={{ display:"flex", alignItems:"center", padding:"0 12px", height:52, cursor:"pointer", background:isSel?C.bgRowSel:"transparent", borderBottom:`1px solid ${C.border}`, borderLeft:`2px solid ${isSel?C.cyan:"transparent"}`, transition:"background 0.1s" }}
        onMouseOver={e => { if(!isSel) e.currentTarget.style.background=C.bgRowHov; }}
        onMouseOut={e  => { if(!isSel) e.currentTarget.style.background="transparent"; }}
      >
        <div style={{ width:28, fontSize:12, color:C.textDim, fontFamily:mono, flexShrink:0 }}>{idx+1}</div>
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, minWidth:0, paddingRight:8 }}>
          <TokenAvatar src={img} sym={sym} size={34} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:isSel?C.cyan:C.text, fontFamily:sans, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sym}</div>
            <div style={{ fontSize:11, color:C.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.baseToken?.name}</div>
          </div>
        </div>
        <div style={{ width:"18%", textAlign:"right", fontSize:13, fontWeight:700, color:C.text, fontFamily:mono, flexShrink:0 }}>{fmtPrice(p.priceUsd)}</div>
        <div style={{ width:"11%", textAlign:"right", flexShrink:0 }}><PctBadge val={p.priceChange?.h1} /></div>
        <div style={{ width:"12%", textAlign:"right", flexShrink:0 }}><PctBadge val={p.priceChange?.h24} /></div>
        <div style={{ width:"15%", textAlign:"right", fontSize:13, color:C.textMid, fontFamily:mono, flexShrink:0 }}>{fmtNum(p.volume?.h24)}</div>
        <div style={{ width:"13%", textAlign:"right", fontSize:13, color:C.textDim, fontFamily:mono, flexShrink:0 }}>{fmtNum(p.marketCap)}</div>
      </div>
    );
  };

  // ── Chart iframe view ─────────────────────────────────────────
  // The iframe is pushed 44px below the container bottom to hide the
  // DexScreener branding bar. A thin overlay masks only that bottom strip.
  // NO left-side masking — chartLeftToolbar=0 in the URL handles the toolbar.
  const ChartPane = () => (
    <div style={{ flex:1, position:"relative", overflow:"hidden", minHeight:0 }}>
      <iframe ref={iframeRef}
        src={pair?.pairAddress
          ? `https://dexscreener.com/solana/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0&chartLeftToolbar=0`
          : "about:blank"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "calc(100% + 44px)",
          border: "none",
        }}
        title="chart"
      />
      {/* Mask ONLY the DexScreener branding strip at the bottom — do NOT mask sides */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
        background: C.bg, zIndex: 10, pointerEvents: "none",
      }} />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // ROOT CONTAINER
  // Uses position:fixed to fill viewport below navbar.
  // Layout: column → TopBar (fixed height) + Body (flex:1, overflow hidden)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: "fixed",
      top: NAVBAR_H,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      flexDirection: "column",
      background: C.bg,
      overflow: "hidden",
      fontFamily: sans,
    }}>
      <TopBar />

      {/* ── MOBILE (<640px) ── */}
      {isMobile && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
          {/* Content area strictly fills space between TopBar and MobileTabBar */}
          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>

            {mobileView === "list" && (
              <div style={{ flex:1, overflowY:"auto" }}>
                {loading && <div style={{ padding:32, textAlign:"center", color:C.textDim, fontFamily:mono, fontSize:12 }}>scanning...</div>}
                {sortedTokens.map((t,i) => <NarrowRow key={t.tokenAddress+i} token={t} />)}
              </div>
            )}

            {mobileView === "detail" && selected && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
                {/* Header: never taller than 220px so chart always gets proper space */}
                <div style={{ flexShrink:0, overflowY:"auto", maxHeight:220 }}>
                  <DetailHeaderContent />
                </div>
                {/* Sub-tabs */}
                <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, padding:"0 14px", flexShrink:0, background:C.bgPanel }}>
                  {["chart","trades"].map(t => (
                    <button key={t} onClick={() => setDetailTab(t)}
                      style={{ padding:"8px 16px", fontFamily:mono, fontSize:11, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", border:"none", borderBottom:`2px solid ${detailTab===t ? C.cyan : "transparent"}`, background:"transparent", color:detailTab===t ? C.cyan : C.textDim, marginBottom:-1 }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  {detailTab === "chart" ? <ChartPane /> : <TradesPanel />}
                </div>
              </div>
            )}

            {mobileView === "promote" && (
              <div style={{ flex:1, overflowY:"auto", background:C.bgPanel }}>
                <div style={{ maxWidth:480, margin:"0 auto" }}>
                  <AdPanel ads={ads} wallet={wallet} connection={connection} isMobileView />
                </div>
              </div>
            )}
          </div>

          <MobileTabBar />
        </div>
      )}

      {/* ── TABLET (640–1023px) ── */}
      {isTablet && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
          {selected ? (
            /* Tablet detail: narrow sidebar + content */
            <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
              {/* Sidebar token list */}
              <div style={{ width:240, flexShrink:0, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ flex:1, overflowY:"auto" }}>
                  {sortedTokens.map((t,i) => <NarrowRow key={t.tokenAddress+i} token={t} />)}
                </div>
              </div>
              {/* Detail panel */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, minHeight:0 }}>
                {/* Header: max 200px so chart always dominates the layout */}
                <div style={{ flexShrink:0, overflowY:"auto", maxHeight:200 }}>
                  <DetailHeaderContent />
                </div>
                {/* Sub-tabs */}
                <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, padding:"0 14px", flexShrink:0, background:C.bgPanel }}>
                  {["chart","trades"].map(t => (
                    <button key={t} onClick={() => setDetailTab(t)}
                      style={{ padding:"8px 16px", fontFamily:mono, fontSize:11, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", border:"none", borderBottom:`2px solid ${detailTab===t ? C.cyan : "transparent"}`, background:"transparent", color:detailTab===t ? C.cyan : C.textDim, marginBottom:-1 }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  {detailTab === "chart" ? <ChartPane /> : <TradesPanel />}
                </div>
              </div>
            </div>
          ) : (
            /* Tablet list: full-width simplified table */
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <TabletTableHeader />
              <div style={{ flex:1, overflowY:"auto" }}>
                {loading && <div style={{ padding:40, textAlign:"center", color:C.textDim, fontFamily:mono, fontSize:12 }}>scanning solana...</div>}
                {sortedTokens.map((t,i) => <TabletRow key={t.tokenAddress+i} token={t} idx={i} />)}
              </div>
            </div>
          )}

          {/* Tablet tab bar at bottom when token selected */}
          {selected && <MobileTabBar />}
        </div>
      )}

      {/* ── DESKTOP (≥1024px) ── */}
      {isDesktop && (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {selected ? (
            /* Desktop detail layout: sidebar | chart+trades | ad */
            <>
              {/* Sidebar */}
              <div style={{ width:300, flexShrink:0, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ flex:1, overflowY:"auto" }}>
                  {sortedTokens.map((t,i) => <NarrowRow key={t.tokenAddress+i} token={t} />)}
                </div>
              </div>
              {/* Main content */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, minHeight:0 }}>
                <div style={{ flexShrink:0 }}>
                  <DetailHeaderContent />
                </div>
                <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
                  <ChartPane />
                  <TradesPanel />
                </div>
              </div>
              {/* Ad panel */}
              <AdPanel ads={ads} wallet={wallet} connection={connection} />
            </>
          ) : (
            /* Desktop list: full-width table + ad panel */
            <>
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {/* Table header */}
                <div style={{ display:"flex", alignItems:"center", padding:"0 14px", height:32, background:C.bgPanel, borderBottom:`1px solid ${C.borderBr}`, flexShrink:0, minWidth:900 }}>
                  <div style={{ width:30, flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:10, fontWeight:600, color:C.textDim, fontFamily:mono, letterSpacing:1, textTransform:"uppercase" }}>TOKEN</div>
                  {COLS.map(({col,label,w,minW})=>(
                    <div key={col} onClick={()=>handleSort(col)}
                      style={{ width:w, minWidth:minW, textAlign:"right", fontSize:11, fontWeight:600, fontFamily:mono, letterSpacing:1, textTransform:"uppercase", color:sortCol===col?C.cyan:C.textDim, cursor:"pointer", userSelect:"none", flexShrink:0 }}>
                      {label}{sortCol===col?(sortDir==="desc"?" ↓":" ↑"):""}
                    </div>
                  ))}
                </div>
                {/* Table body — horizontal scroll for mid-size desktops */}
                <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
                  {loading && <div style={{ padding:40, textAlign:"center", color:C.textDim, fontFamily:mono, fontSize:12 }}>scanning solana...</div>}
                  {sortedTokens.map((t,i) => <TokenRow key={t.tokenAddress+i} token={t} idx={i} />)}
                </div>
              </div>
              {/* Ad panel always on right */}
              <AdPanel ads={ads} wallet={wallet} connection={connection} />
            </>
          )}
        </div>
      )}

      {activeMint && <SwapDrawer mint={activeMint} onClose={()=>setActiveMint(null)} />}
    </div>
  );
}
