import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import SwapDrawer from "../components/SwapDrawer";
import { POSTS, TAG_COLORS, TAG_TEXT } from "./BlogPost";
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
          name: form.name, ticker: form.ticker, description: form.desc,
          url: form.url, twitter: form.twitter.replace(/^@/,""),
          wallet_address: wallet.publicKey?.toBase58?.(),
          tx_signature: sig, status: "pending", submitted_at: new Date().toISOString(),
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
      width: isMobileView ? "100%" : 220, flexShrink: isMobileView ? undefined : 0,
      borderLeft: isMobileView ? "none" : `1px solid ${C.border}`,
      display:"flex", flexDirection:"column", background:C.bgPanel, overflowY:"auto",
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
              style={{ flex:1, padding:"7px", borderRadius:6, border:"1px solid rgba(245,158,11,0.4)", background:paying?"rgba(245,158,11,0.03)":"rgba(245,158,11,0.08)", color:paying?C.textDim:C.yellow, fontFamily:mono, fontSize:10, cursor:paying||!wallet?.publicKey?"not-allowed":"pointer", fontWeight:700 }}>
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
  const location = useLocation();
  const { slug } = useParams();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { w: winW } = useWindowSize();

  const isMobile  = winW < 640;
  const isTablet  = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;
  const isMobileSidebar = winW < 768;

  const [profileName, setProfileName] = useState("guest");
  const myWallet = wallet.publicKey?.toBase58() ?? "";
  const [nameClaiming, setNameClaiming] = useState(false);

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
    } catch (err) {
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

  const path = location.pathname;
  let activeTab = "discover";
  if (path === "/manifesto") {
    activeTab = "manifesto";
  } else if (path.startsWith("/blog")) {
    activeTab = "blog";
  }
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
  const [mobileView,    setMobileView]    = useState("list");
  const [detailTab,     setDetailTab]     = useState("chart");
  const iframeRef = useRef(null);
  const [ads] = useState([]);

  const NAVBAR_H     = 52;
  const BOTTOM_TAB_H = 52;

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = scrollbarCSS;
    style.id = "discover-scrollbar";
    if (!document.getElementById("discover-scrollbar")) document.head.appendChild(style);
    return () => document.getElementById("discover-scrollbar")?.remove();
  }, []);

  // Ref-based filter so fetchTokens never has stale closure issues
  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  const fetchTokens = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const f = filterRef.current;

      // ── SEARCH ──────────────────────────────────────────────────
      if (query) {
        const data = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`).then(r=>r.json());
        const pairs = (data?.pairs||[]).filter(p=>p.chainId==="solana"&&Number(p.liquidity?.usd||0)>500).slice(0,100);
        setTokens(pairs.map(p=>({ pair:p, tokenAddress:p.baseToken?.address, icon:p.info?.imageUrl, boostAmount:0 })));
        return;
      }

      // ── BOOST MAP (for ⚡ badges) ────────────────────────────────
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

      // ── TRENDING / GAINERS / VOLUME ─────────────────────────────
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
        tokenAddress: t.tokenAddress,
        pair: pairs.find(p=>p.baseToken?.address===t.tokenAddress&&p.chainId==="solana"),
        icon: pairs.find(p=>p.baseToken?.address===t.tokenAddress)?.info?.imageUrl||t.icon||t.url,
        boostAmount: t.totalAmount||t.amount||0,
      })).filter(t=>t.pair&&Number(t.pair.liquidity?.usd||0)>500);

      if (f==="gainers") merged.sort((a,b)=>Number(b.pair?.priceChange?.h24||0)-Number(a.pair?.priceChange?.h24||0));
      if (f==="volume")  merged.sort((a,b)=>Number(b.pair?.volume?.h24||0)-Number(a.pair?.volume?.h24||0));
      setTokens(merged);

    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, []); // empty deps — uses filterRef

  useEffect(()=>{ fetchTokens(); }, [filter]); // eslint-disable-line
  useEffect(()=>{ const t=setTimeout(()=>fetchTokens(search),500); return ()=>clearTimeout(t); }, [search]); // eslint-disable-line

  const sortedTokens = sortCol ? [...tokens].sort((a,b)=>{
    if(!a.pair||!b.pair) return 0;
    const d = sortDir==="desc" ? -1 : 1;
    const m = {
      price:  ()=>Number(b.pair.priceUsd||0)-Number(a.pair.priceUsd||0),
      m5:     ()=>Number(b.pair.priceChange?.m5||0)-Number(a.pair.priceChange?.m5||0),
      h1:     ()=>Number(b.pair.priceChange?.h1||0)-Number(a.pair.priceChange?.h1||0),
      h24:    ()=>Number(b.pair.priceChange?.h24||0)-Number(a.pair.priceChange?.h24||0),
      volume: ()=>Number(b.pair.volume?.h24||0)-Number(a.pair.volume?.h24||0),
      liq:    ()=>Number(b.pair.liquidity?.usd||0)-Number(a.pair.liquidity?.usd||0),
      mcap:   ()=>Number(b.pair.marketCap||0)-Number(a.pair.marketCap||0),
      txns:   ()=>(Number(b.pair.txns?.h24?.buys||0)+Number(b.pair.txns?.h24?.sells||0))-(Number(a.pair.txns?.h24?.buys||0)+Number(a.pair.txns?.h24?.sells||0)),
      buys:   ()=>Number(b.pair.txns?.h24?.buys||0)-Number(a.pair.txns?.h24?.buys||0),
      sells:  ()=>Number(b.pair.txns?.h24?.sells||0)-Number(a.pair.txns?.h24?.sells||0),
    };
    return m[sortCol] ? m[sortCol]()*d : 0;
  }) : tokens;

  const handleSort = col => {
    if (sortCol===col) setSortDir(d=>d==="desc"?"asc":"desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const loadTrades = useCallback(async (pairAddress) => {
    if (!pairAddress) return;
    setLoadingTrades(true);
    setTrades([]);
    try {
      const data = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`).then(r=>r.json());
      const pair = data?.pairs?.[0];
      const buys   = pair?.txns?.h24?.buys  || 0;
      const sells  = pair?.txns?.h24?.sells || 0;
      const volH24 = Number(pair?.volume?.h24 || 0);
      const price  = Number(pair?.priceUsd || 0);
      const total  = buys + sells || 1;
      const count  = Math.min(80, total);
      const buyCount = Math.round((buys/total)*count);
      const mockTrades = Array.from({ length:count }, (_,i) => {
        const isBuy = i < buyCount;
        const avgTrade = volH24 / total;
        const usd = Math.max(1, avgTrade*(0.2+Math.random()*2)).toFixed(2);
        const tokens = price > 0 ? (Number(usd)/price).toFixed(0) : "0";
        return {
          type: isBuy?"buy":"sell", usd, tokens,
          time: Math.floor(Date.now()/1000)-Math.floor(Math.random()*3600),
          sig:  Array.from({length:44},()=>"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random()*58)]).join(""),
          pairAddress,
        };
      });
      for(let i=mockTrades.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mockTrades[i],mockTrades[j]]=[mockTrades[j],mockTrades[i]];}
      mockTrades.sort((a,b)=>b.time-a.time);
      setTrades(mockTrades);
    } catch(e){ console.error(e); }
    finally { setLoadingTrades(false); }
  }, []);

  const selectToken = useCallback((token) => {
    setSelected(token);
    loadTrades(token.pair?.pairAddress);
    if (window.innerWidth < 1024) { setMobileView("detail"); setDetailTab("chart"); }
  }, [loadTrades]);

  const goBack = useCallback(() => { setSelected(null); setMobileView("list"); }, []);

  const pair   = selected?.pair;
  const buys   = pair?.txns?.h24?.buys  || 0;
  const sells  = pair?.txns?.h24?.sells || 0;
  const buyPct = Math.round((buys/(buys+sells||1))*100);

  // ── NarrowRow ─────────────────────────────────────────────────
  const NarrowRow = ({ token }) => {
    const p = token.pair; if (!p) return null;
    const isSel = selected?.tokenAddress===token.tokenAddress;
    const sym = p.baseToken?.symbol||"?";
    const img = token.icon||p.info?.imageUrl;
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

  // ── TradesPanel ───────────────────────────────────────────────
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
          <span style={{ fontSize:9, color:C.red,   fontFamily:mono }}>{100-buyPct}% sells</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"18px 1fr 42px", padding:"5px 10px", fontSize:9, letterSpacing:1, color:C.textDim, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, background:C.bgPanel, fontFamily:mono, flexShrink:0 }}>
        <div/><div>USD</div><div style={{ textAlign:"right" }}>AGO</div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {loadingTrades && <div style={{ padding:20, textAlign:"center", fontSize:11, color:C.textDim, fontFamily:mono }}>loading trades...</div>}
        {trades.map((tr,i) => (
          <a key={i} href={`https://dexscreener.com/solana/${tr.pairAddress}`} target="_blank" rel="noreferrer"
            style={{ display:"grid", gridTemplateColumns:"18px 1fr 42px", padding:"6px 10px", borderBottom:`1px solid rgba(255,255,255,0.03)`, alignItems:"center", textDecoration:"none", cursor:"pointer", background:"transparent" }}
            onMouseOver={e=>{ e.currentTarget.style.background=tr.type==="buy"?"rgba(34,197,94,0.04)":"rgba(239,68,68,0.04)"; }}
            onMouseOut={e=> { e.currentTarget.style.background="transparent"; }}
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

  // ── DetailHeaderContent ───────────────────────────────────────
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
              style={{ padding:"7px 16px", borderRadius:6, border:`1px solid ${C.cyan}77`, background:C.cyanDim, color:C.cyan, fontFamily:mono, fontSize:12, fontWeight:700, letterSpacing:1, cursor:"pointer", transition:"all 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.background = C.cyan; e.currentTarget.style.color = "#000"; }}
              onMouseOut={e => { e.currentTarget.style.background = C.cyanDim; e.currentTarget.style.color = C.cyan; }}>
              BUY ◎
            </button>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2, 1fr)":"repeat(5, 1fr)", gap:8, marginBottom:12 }}>
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
            <div key={l} style={{ background:"rgba(255,255,255,0.01)", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
              <div style={{ fontSize:9, color:C.textDim, fontFamily:mono, letterSpacing:1.5, marginBottom:4, textTransform:"uppercase" }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:700, color:c, fontFamily:mono }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {pair?.info?.websites?.[0]?.url && (
            <a href={pair.info.websites[0].url} target="_blank" rel="noreferrer"
              style={{ fontSize:10,fontWeight:700,color:C.textMid,fontFamily:mono,textDecoration:"none",padding:"4px 10px",border:`1px solid ${C.border}`,borderRadius:6,background:"rgba(255,255,255,0.02)",transition:"all 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.background = C.cyanDim; e.currentTarget.style.color = C.cyan; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = C.textMid; }}>
              🌐 Web
            </a>
          )}
          {pair?.info?.socials?.find(s=>s.type==="twitter") && (
            <a href={pair.info.socials.find(s=>s.type==="twitter").url} target="_blank" rel="noreferrer"
              style={{ fontSize:10,fontWeight:700,color:C.textMid,fontFamily:mono,textDecoration:"none",padding:"4px 10px",border:`1px solid ${C.border}`,borderRadius:6,background:"rgba(255,255,255,0.02)",transition:"all 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.background = C.cyanDim; e.currentTarget.style.color = C.cyan; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = C.textMid; }}>
              𝕏 Twitter
            </a>
          )}
          {pair?.pairAddress && (
            <a href={`https://dexscreener.com/solana/${pair.pairAddress}`} target="_blank" rel="noreferrer"
              style={{ fontSize:10,fontWeight:700,color:C.textMid,fontFamily:mono,textDecoration:"none",padding:"4px 10px",border:`1px solid ${C.border}`,borderRadius:6,background:"rgba(255,255,255,0.02)",transition:"all 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.background = C.cyanDim; e.currentTarget.style.color = C.cyan; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = C.textMid; }}>
              DEX ↗
            </a>
          )}
          <a href={`https://solscan.io/token/${selected?.tokenAddress}`} target="_blank" rel="noreferrer"
            style={{ fontSize:10,fontWeight:700,color:C.textMid,fontFamily:mono,textDecoration:"none",padding:"4px 10px",border:`1px solid ${C.border}`,borderRadius:6,background:"rgba(255,255,255,0.02)",transition:"all 0.15s" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.background = C.cyanDim; e.currentTarget.style.color = C.cyan; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.color = C.textMid; }}>
            SCAN ↗
          </a>
        </div>
      </div>
    );
  };

  // ── Desktop column definitions ────────────────────────────────
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

  // ── TokenRow (desktop) ────────────────────────────────────────
  const TokenRow = ({ token, idx }) => {
    const p = token.pair; if (!p) return null;
    const isSel  = selected?.tokenAddress===token.tokenAddress;
    const sym    = p.baseToken?.symbol||"?";
    const img    = token.icon||p.info?.imageUrl;
    const boost  = token.boostAmount||boostMap[token.tokenAddress];
    const txns   = (p.txns?.h24?.buys||0)+(p.txns?.h24?.sells||0);
    return (
      <div onClick={()=>selectToken(token)}
        style={{ display:"flex", alignItems:"center", padding:"0 14px", height:56, cursor:"pointer", background:isSel?C.bgRowSel:"transparent", borderBottom:`1px solid ${C.border}`, borderLeft:`2px solid ${isSel?C.cyan:"transparent"}`, transition:"background 0.1s", minWidth:900 }}
        onMouseOver={e=>{ if(!isSel) e.currentTarget.style.background=C.bgRowHov; }}
        onMouseOut={e=> { if(!isSel) e.currentTarget.style.background="transparent"; }}
      >
        <div style={{ width:30,fontSize:12,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{idx+1}</div>
        <div style={{ flex:1,display:"flex",alignItems:"center",gap:10,minWidth:180,paddingRight:8,overflow:"hidden" }}>
          <TokenAvatar src={img} sym={sym} size={32} />
          <div style={{ minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:14,fontWeight:700,color:isSel?C.cyan:C.text,fontFamily:sans }}>{sym}</span>
              {boost>0 && <BoostBadge amount={boost} />}
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

  // ── TopBar ────────────────────────────────────────────────────
  const TopBar = () => (
    <div style={{ height:isMobile?38:42, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 12px", gap:8, flexShrink:0, background:C.bgPanel, position:"relative", zIndex:20 }}>
      {/* Back / Forward */}
      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
        <button onClick={()=>selected ? goBack() : navigate("/")} title="Go back"
          style={{ width:26,height:26,borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.textMid,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>‹</button>
        <button onClick={()=>navigate(1)} title="Go forward"
          style={{ width:26,height:26,borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.textMid,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>›</button>
      </div>

      {/* Unified Page Tabs */}
      <div style={{ display:"flex", gap:4, marginRight: 8, flexShrink:0 }}>
        <button onClick={() => navigate("/ansem")}
          style={{
            background: activeTab === "ansem" ? C.cyanDim : "transparent",
            color: activeTab === "ansem" ? C.cyan : C.textMid,
            border: `1px solid ${activeTab === "ansem" ? C.cyan + "55" : "transparent"}`,
            borderRadius: 5, padding: isMobile ? "4px 8px" : "4px 10px", fontSize: isMobile ? 9 : 11, fontFamily: mono, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
          }}>
          💸 {!isMobile && "$ANSEM"}
        </button>
        <button onClick={() => navigate("/discover")}
          style={{
            background: activeTab === "discover" ? C.cyanDim : "transparent",
            color: activeTab === "discover" ? C.cyan : C.textMid,
            border: `1px solid ${activeTab === "discover" ? C.cyan + "55" : "transparent"}`,
            borderRadius: 5, padding: isMobile ? "4px 8px" : "4px 10px", fontSize: isMobile ? 9 : 11, fontFamily: mono, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
          }}>
          🧭 {!isMobile && "DEX Terminal"}
        </button>
        <button onClick={() => navigate("/manifesto")}
          style={{
            background: activeTab === "manifesto" ? C.cyanDim : "transparent",
            color: activeTab === "manifesto" ? C.cyan : C.textMid,
            border: `1px solid ${activeTab === "manifesto" ? C.cyan + "55" : "transparent"}`,
            borderRadius: 5, padding: isMobile ? "4px 8px" : "4px 10px", fontSize: isMobile ? 9 : 11, fontFamily: mono, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
          }}>
          📜 {!isMobile && "Manifesto"}
        </button>
        <button onClick={() => navigate("/blog")}
          style={{
            background: activeTab === "blog" ? C.cyanDim : "transparent",
            color: activeTab === "blog" ? C.cyan : C.textMid,
            border: `1px solid ${activeTab === "blog" ? C.cyan + "55" : "transparent"}`,
            borderRadius: 5, padding: isMobile ? "4px 8px" : "4px 10px", fontSize: isMobile ? 9 : 11, fontFamily: mono, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
          }}>
          📝 {!isMobile && "Journal"}
        </button>
      </div>

      {activeTab === "discover" && (
        <>
          {selected && !isDesktop
            ? <button onClick={goBack} style={{ background:"none",border:`1px solid ${C.border}`,borderRadius:5,color:C.textMid,fontFamily:mono,fontSize:10,cursor:"pointer",padding:"3px 9px",letterSpacing:1,flexShrink:0 }}>← DISCOVER</button>
            : (!isMobile && <div style={{ width:1,height:16,background:C.border,flexShrink:0 }} />)
          }

          {/* Filter buttons */}
          <div style={{ display:"flex",gap:3,flexShrink:0 }}>
            {["trending","gainers","volume"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ padding:isMobile?"4px 8px":"4px 11px",borderRadius:5,fontSize:isMobile?10:11,fontFamily:mono,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",border:`1px solid ${filter===f?C.cyan+"55":C.border}`,background:filter===f?C.cyanDim:"transparent",color:filter===f?C.cyan:C.textDim,transition:"all 0.12s",whiteSpace:"nowrap" }}>
                {f}
              </button>
            ))}
          </div>

          {/* Search — desktop only, pushed to right */}
          {!isMobile && (
            <div style={{ marginLeft:"auto",position:"relative" }}>
              <span style={{ position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.textDim,fontSize:13 }}>⌕</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search token or CA..."
                style={{ width:winW<1200?130:180,padding:"6px 10px 6px 26px",borderRadius:7,border:`1px solid ${C.border}`,background:C.bgRow,color:C.text,fontFamily:mono,fontSize:12,outline:"none" }}
                onFocus={e=>e.target.style.borderColor=C.cyan+"44"}
                onBlur={e=> e.target.style.borderColor=C.border}
              />
            </div>
          )}
          {!isMobile && winW >= 1180 && (
            <div style={{ fontSize:11,color:C.textDim,fontFamily:mono,flexShrink:0,marginRight:8 }}>
              {tokens.length} pairs · <span style={{ color:C.cyan+"77" }}>SOLANA</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── MobileTabBar ──────────────────────────────────────────────
  const MobileTabBar = () => (
    <div style={{ height:BOTTOM_TAB_H, flexShrink:0, borderTop:`1px solid ${C.border}`, display:"flex", background:C.bgPanel, position:"relative", zIndex:20 }}>
      <button onClick={()=>setMobileView("list")}
        style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",borderRight:`1px solid ${C.border}`,color:mobileView==="list"?C.cyan:C.textDim }}>
        <span style={{ fontSize:16 }}>☰</span>
        <span style={{ fontSize:9,fontFamily:mono,letterSpacing:1 }}>LIST</span>
      </button>
      <button onClick={()=>{ if(selected){setMobileView("detail");setDetailTab("chart");} }}
        style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:selected?"pointer":"not-allowed",color:mobileView==="detail"&&detailTab==="chart"?C.cyan:selected?C.textMid:C.textDim,opacity:selected?1:0.4 }}>
        <span style={{ fontSize:16 }}>📈</span>
        <span style={{ fontSize:9,fontFamily:mono,letterSpacing:1 }}>CHART</span>
      </button>
    </div>
  );

  // ── Tablet table header ───────────────────────────────────────
  const TabletTableHeader = () => (
    <div style={{ display:"flex", alignItems:"center", padding:"0 12px", height:34, background:C.bgPanel, borderBottom:`1px solid ${C.borderBr}`, flexShrink:0 }}>
      <div style={{ width:28, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:150, fontSize:10, fontWeight:600, color:C.textDim, fontFamily:mono, letterSpacing:1, textTransform:"uppercase" }}>TOKEN</div>
      {[
        {col:"price", label:"Price",  w:"18%"},
        {col:"h1",    label:"1H",     w:"11%"},
        {col:"h24",   label:"24H",    w:"12%"},
        {col:"volume",label:"Volume", w:"15%"},
        {col:"mcap",  label:"MCap",   w:"13%"},
      ].map(({col,label,w}) => (
        <div key={col} onClick={()=>handleSort(col)}
          style={{ width:w, textAlign:"right", fontSize:10, fontWeight:600, fontFamily:mono, letterSpacing:1, textTransform:"uppercase", color:sortCol===col?C.cyan:C.textDim, cursor:"pointer", userSelect:"none", flexShrink:0 }}>
          {label}{sortCol===col?(sortDir==="desc"?" ↓":" ↑"):""}
        </div>
      ))}
    </div>
  );

  // ── TabletRow ─────────────────────────────────────────────────
  const TabletRow = ({ token, idx }) => {
    const p = token.pair; if (!p) return null;
    const isSel = selected?.tokenAddress===token.tokenAddress;
    const sym   = p.baseToken?.symbol||"?";
    const img   = token.icon||p.info?.imageUrl;
    return (
      <div onClick={()=>selectToken(token)}
        style={{ display:"flex", alignItems:"center", padding:"0 12px", height:52, cursor:"pointer", background:isSel?C.bgRowSel:"transparent", borderBottom:`1px solid ${C.border}`, borderLeft:`2px solid ${isSel?C.cyan:"transparent"}`, transition:"background 0.1s" }}
        onMouseOver={e=>{ if(!isSel) e.currentTarget.style.background=C.bgRowHov; }}
        onMouseOut={e=> { if(!isSel) e.currentTarget.style.background="transparent"; }}
      >
        <div style={{ width:28,fontSize:12,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{idx+1}</div>
        <div style={{ flex:1,display:"flex",alignItems:"center",gap:10,minWidth:150,paddingRight:8,overflow:"hidden" }}>
          <TokenAvatar src={img} sym={sym} size={34} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14,fontWeight:700,color:isSel?C.cyan:C.text,fontFamily:sans,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{sym}</div>
            <div style={{ fontSize:11,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.baseToken?.name}</div>
          </div>
        </div>
        <div style={{ width:"18%",textAlign:"right",fontSize:13,fontWeight:700,color:C.text,fontFamily:mono,flexShrink:0 }}>{fmtPrice(p.priceUsd)}</div>
        <div style={{ width:"11%",textAlign:"right",flexShrink:0 }}><PctBadge val={p.priceChange?.h1} /></div>
        <div style={{ width:"12%",textAlign:"right",flexShrink:0 }}><PctBadge val={p.priceChange?.h24} /></div>
        <div style={{ width:"15%",textAlign:"right",fontSize:13,color:C.textMid,fontFamily:mono,flexShrink:0 }}>{fmtNum(p.volume?.h24)}</div>
        <div style={{ width:"13%",textAlign:"right",fontSize:13,color:C.textDim,fontFamily:mono,flexShrink:0 }}>{fmtNum(p.marketCap)}</div>
      </div>
    );
  };

  // ── ChartPane ─────────────────────────────────────────────────
  const ChartPane = () => (
    <div style={{ flex:1, position:"relative", overflow:"hidden", minHeight:0 }}>
      <iframe ref={iframeRef}
        src={pair?.pairAddress
          ? `https://dexscreener.com/solana/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0&chartLeftToolbar=0`
          : "about:blank"}
        style={{ position:"absolute", top:0, left:0, width:"100%", height:"calc(100% + 44px)", border:"none" }}
        title="chart"
      />
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:44, background:C.bg, zIndex:10, pointerEvents:"none" }} />
    </div>
  );

  // ── ManifestoView ──────────────────────────────────────────────
  const ManifestoView = () => {
    const styles = {
      wrap: { maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "'Space Mono', monospace", color: "#8aa0b8" },
      eyebrow: { fontSize: 10, letterSpacing: 4, color: C.cyan, textTransform: "uppercase", opacity: 0.6, marginBottom: 16 },
      title: { fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: "#e2edf8", letterSpacing: -1, margin: "0 0 6px" },
      sub: { fontSize: 12, color: "#3a5a6a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 48 },
      divider: { width: "100%", height: 1, background: "rgba(255,255,255,0.05)", margin: "40px 0" },
      label: { fontSize: 10, letterSpacing: 3, color: C.cyan, opacity: 0.5, textTransform: "uppercase", marginBottom: 16 },
      lead: { fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#c8ddf0", lineHeight: 1.4, margin: "0 0 20px" },
      p: { fontSize: 12, lineHeight: 2, color: "#5a7a8a", margin: "0 0 12px" },
      hi: { fontSize: 12, lineHeight: 2, color: "#8ab8cc", margin: "0 0 12px" },
      vline: { width: 1, height: 32, background: "linear-gradient(180deg, transparent, rgba(0,247,255,0.25), transparent)", margin: "24px 0" },
      sigilName: { fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#e2edf8", letterSpacing: -0.5, margin: "0 0 4px" },
      closing: { fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#8ab8cc", lineHeight: 1.5, margin: "20px 0 12px" },
      welcome: { fontSize: 11, color: C.cyan, opacity: 0.5, letterSpacing: 2, marginBottom: 28 },
    };

    const listItem = { fontSize: 12, color: "#5a7a8a", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 10, lineHeight: 1.7, listStyle: "none" };

    return (
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={styles.wrap}>
          <div style={styles.eyebrow}>Manifesto · 2026</div>
          <div style={styles.title}>SOL<span style={{ color: C.cyan, opacity: 0.8 }}>CHAT</span></div>
          <div style={styles.sub}>A Social Layer Built For Crypto</div>
          <div style={styles.divider} />

          <div style={styles.label}>The Problem</div>
          <div style={styles.lead}>Our conversations live on platforms never designed for this world.</div>
          <p style={styles.p}>Crypto moves fast. Markets react in seconds. Communities form overnight. Yet when it's time to talk, coordinate, and react — we leave the surface.</p>
          <p style={styles.hi}>Solchat exists to close that gap.</p>
          <div style={styles.vline} />

          <div style={styles.label}>Why It Matters</div>
          <div style={styles.lead}>The internet was not built for sovereign identity.</div>
          <ul style={{ padding: 0, margin: "16px 0 20px" }}>
            {["Not built for transparent liquidity", "Not built for real-time global coordination", "Not built for permissionless, trustless communication"].map((item, i) => (
              <li key={i} style={listItem}><span style={{ color: C.cyan, opacity: 0.4, flexShrink: 0 }}>—</span>{item}</li>
            ))}
          </ul>
          <p style={styles.p}>Crypto rebuilt the financial layer. Now it's time to rebuild the social one.</p>
          <p style={styles.hi}>Culture is not an afterthought. It is infrastructure.</p>
          <div style={styles.vline} />

          <div style={styles.label}>What We're Building</div>
          <div style={styles.lead}>Something native to crypto.</div>
          <ul style={{ padding: 0, margin: "16px 0 20px" }}>
            {[
              "A shared surface for builders, traders, creators, and communities",
              "Real-money on-chain tipping directly in the feed using the $ANSEM utility token",
              "Decentralized identity with case-insensitive unique usernames",
              "Frictionless inline token swaps powered by the Jupiter Aggregator"
            ].map((item, i) => (
              <li key={i} style={listItem}><span style={{ color: C.cyan, opacity: 0.4, flexShrink: 0 }}>—</span>{item}</li>
            ))}
          </ul>
          <p style={styles.p}>Not replacing existing platforms. Creating something aligned with the world we are building.</p>
          <div style={styles.divider} />

          <div style={styles.label}>Origin Signal</div>
          <div style={styles.sigilName}>NULL <span style={{ color: C.cyan }}>SIGIL</span></div>
          <p style={{ ...styles.p, marginTop: 12 }}>Before networks scale, they begin as signals. Null Sigil marks the first signal of Solchat's cultural layer. Not hype. Not noise. An early imprint on a new surface.</p>
          <div style={styles.vline} />

          <div style={styles.label}>Current Phase</div>
          <div style={styles.sigilName}>UTILITY & TIPPING LIVE</div>
          <p style={{ ...styles.p, marginTop: 12 }}>Solchat has officially transitioned to its mainnet utility phase. The native tipping token <strong>$ANSEM (The Black Bull)</strong> is live. Connect your Solana wallet, claim your unique handle, tip other builders directly inside the chat feed, track real-time token metrics, and swap tokens instantly via the inline Jupiter aggregator terminal.</p>
          <div style={styles.vline} />

          <div style={styles.closing}>Crypto does not need another social app.<br />It needs a social layer.</div>
          <div style={styles.welcome}>// Welcome to the surface.</div>
          <button
            onClick={() => navigate("/discover")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "transparent", border: `1px solid ${C.cyan}44`, color: C.cyan, fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}
          >
            Enter the feed →
          </button>
        </div>
      </div>
    );
  };

  // ── BlogView ──────────────────────────────────────────────────
  const BlogView = () => {
    // If slug is defined, render the selected blog post
    if (slug && POSTS[slug]) {
      const post = POSTS[slug];
      return (
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(34,211,238,0.05) 0%, transparent 70%)",
          }} />

          <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "48px 24px 120px", fontFamily: sans, color: "#dde6f0" }}>
            {/* Back button */}
            <button
              onClick={() => navigate("/blog")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "none", border: "none", cursor: "pointer",
                color: "#3a4d62", fontFamily: mono,
                fontSize: 11, letterSpacing: 1, padding: 0, marginBottom: 36,
                transition: "color 0.15s",
              }}
              onMouseOver={e => (e.currentTarget.style.color = C.cyan)}
              onMouseOut={e => (e.currentTarget.style.color = "#3a4d62")}
            >
              ← JOURNAL
            </button>

            {/* Meta */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{
                fontSize: 9, fontFamily: mono, fontWeight: 700,
                letterSpacing: 2, padding: "3px 8px", borderRadius: 4,
                background: TAG_COLORS[post.tag] || "rgba(255,255,255,0.06)",
                color: TAG_TEXT[post.tag] || "#8899aa",
                border: `1px solid ${TAG_TEXT[post.tag] || "#8899aa"}22`,
              }}>
                {post.tag}
              </span>
              <span style={{ fontSize: 11, color: "#3a4d62", fontFamily: mono }}>
                {post.date} · {post.readTime}
              </span>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: "clamp(24px, 4.5vw, 36px)",
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#fff",
              margin: "0 0 20px",
              letterSpacing: -1,
            }}>
              {post.title}
            </h1>

            {/* Intro */}
            <p style={{
              fontSize: 16, color: "#aab8c8", lineHeight: 1.7,
              margin: "0 0 36px", fontWeight: 400,
            }}>
              {post.intro}
            </p>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 8px" }} />

            {/* Body Sections */}
            <div style={{ paddingTop: 8 }}>
              {post.sections.map((s, i) => {
                switch (s.type) {
                  case "h2":
                    return (
                      <h2 key={i} style={{ fontSize: 20, fontWeight: 700, color: "#dde6f0", margin: "36px 0 12px", lineHeight: 1.3, letterSpacing: -0.3 }}>
                        {s.text}
                      </h2>
                    );
                  case "p":
                    return (
                      <p key={i} style={{ fontSize: 14, color: "#8899aa", lineHeight: 1.8, margin: "0 0 16px" }}>
                        {s.text}
                      </p>
                    );
                  case "quote":
                    return (
                      <blockquote key={i} style={{ margin: "28px 0", padding: "16px 20px", borderLeft: `3px solid ${C.cyan}`, background: "rgba(34,211,238,0.04)", borderRadius: "0 8px 8px 0" }}>
                        <p style={{ fontSize: 16, color: "#dde6f0", fontStyle: "italic", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                          "{s.text}"
                        </p>
                      </blockquote>
                    );
                  case "callout":
                    return (
                      <div key={i} style={{ margin: "28px 0", padding: "16px 20px", background: "rgba(34,211,238,0.05)", border: `1px solid ${C.cyan}22`, borderRadius: 10 }}>
                        <div style={{ fontSize: 9, fontFamily: mono, letterSpacing: 2, color: C.cyan, marginBottom: 8, fontWeight: 700 }}>
                          {s.label}
                        </div>
                        <p style={{ fontSize: 13, color: "#dde6f0", lineHeight: 1.6, margin: 0 }}>
                          {s.text}
                        </p>
                      </div>
                    );
                  case "divider":
                    return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "30px 0" }} />;
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        </div>
      );
    }

    // Render list of posts
    return (
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(ellipse 80% 45% at 50% -5%, rgba(34,211,238,0.04) 0%, transparent 60%)",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "48px 24px 120px", fontFamily: sans }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 16, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: 3, color: C.cyan, textTransform: "uppercase", marginBottom: 6 }}>
                JOURNAL
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5, margin: 0 }}>
                Solchat Journal
              </h1>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {Object.values(POSTS).map((post) => (
              <div
                key={post.slug}
                onClick={() => navigate(`/blog/${post.slug}`)}
                style={{
                  padding: 24,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.03)",
                  background: "rgba(255,255,255,0.01)",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                  e.currentTarget.style.background = "rgba(34,211,238,0.01)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.01)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 8, fontFamily: mono, fontWeight: 700, letterSpacing: 2,
                    padding: "3px 8px", borderRadius: 4,
                    background: TAG_COLORS[post.tag] || "rgba(255,255,255,0.06)",
                    color: TAG_TEXT[post.tag] || "#8899aa",
                    border: `1px solid ${TAG_TEXT[post.tag]}1a`
                  }}>
                    {post.tag}
                  </span>
                  <span style={{ fontSize: 11, color: "#3a4d62", fontFamily: mono }}>
                    {post.date} · {post.readTime}
                  </span>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 10px", lineHeight: 1.3 }}>
                  {post.title}
                </h2>

                <p style={{ fontSize: 13, color: "#8899aa", lineHeight: 1.6, margin: 0 }}>
                  {post.excerpt || post.intro}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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

  const rootStyle = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    height: `calc(100vh - ${NAVBAR_H}px)`,
    maxHeight: `calc(100vh - ${NAVBAR_H}px)`,
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
    position: "relative",
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

      {activeTab === "manifesto" && <ManifestoView />}
      {activeTab === "blog" && <BlogView />}

      {activeTab === "discover" && (
        <>
          {/* ── MOBILE ── */}
          {isMobile && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
              <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>

                {mobileView==="list" && (
                  <div style={{ flex:1, overflowY:"auto" }}>
                    {loading && <div style={{ padding:32,textAlign:"center",color:C.textDim,fontFamily:mono,fontSize:12 }}>scanning...</div>}
                    {sortedTokens.map((t,i)=><NarrowRow key={t.tokenAddress+i} token={t} />)}
                  </div>
                )}

                {mobileView==="detail" && selected && (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
                    <div style={{ flexShrink:0, overflowY:"auto", maxHeight:220 }}><DetailHeaderContent /></div>
                    <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                      <ChartPane />
                    </div>
                  </div>
                )}
              </div>
              <MobileTabBar />
            </div>
          )}

          {/* ── TABLET ── */}
          {isTablet && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
              {selected ? (
                <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
                  <div style={{ width:240, flexShrink:0, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                    <div style={{ flex:1, overflowY:"auto" }}>
                      {sortedTokens.map((t,i)=><NarrowRow key={t.tokenAddress+i} token={t} />)}
                    </div>
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, minHeight:0 }}>
                    <div style={{ flexShrink:0, overflowY:"auto", maxHeight:200 }}><DetailHeaderContent /></div>
                    <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                      <ChartPane />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                  <TabletTableHeader />
                  <div style={{ flex:1, overflowY:"auto" }}>
                    {loading && <div style={{ padding:40,textAlign:"center",color:C.textDim,fontFamily:mono,fontSize:12 }}>scanning solana...</div>}
                    {sortedTokens.map((t,i)=><TabletRow key={t.tokenAddress+i} token={t} idx={i} />)}
                  </div>
                </div>
              )}
              {selected && <MobileTabBar />}
            </div>
          )}

          {/* ── DESKTOP ── */}
          {isDesktop && (
            <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
              {selected ? (
                <>
                  <div style={{ width:300, flexShrink:0, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                    <div style={{ flex:1, overflowY:"auto" }}>
                      {sortedTokens.map((t,i)=><NarrowRow key={t.tokenAddress+i} token={t} />)}
                    </div>
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, minHeight:0 }}>
                    <div style={{ flexShrink:0 }}><DetailHeaderContent /></div>
                    <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
                      <ChartPane />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", padding:"0 14px", height:32, background:C.bgPanel, borderBottom:`1px solid ${C.borderBr}`, flexShrink:0, minWidth:900 }}>
                      <div style={{ width:30, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:180, fontSize:10, fontWeight:600, color:C.textDim, fontFamily:mono, letterSpacing:1, textTransform:"uppercase" }}>TOKEN</div>
                      {COLS.map(({col,label,w,minW})=>(
                        <div key={col} onClick={()=>handleSort(col)}
                          style={{ width:w, minWidth:minW, textAlign:"right", fontSize:11, fontWeight:600, fontFamily:mono, letterSpacing:1, textTransform:"uppercase", color:sortCol===col?C.cyan:C.textDim, cursor:"pointer", userSelect:"none", flexShrink:0 }}>
                          {label}{sortCol===col?(sortDir==="desc"?" ↓":" ↑"):""}
                        </div>
                      ))}
                    </div>
                    <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
                      {loading && <div style={{ padding:40,textAlign:"center",color:C.textDim,fontFamily:mono,fontSize:12 }}>scanning solana...</div>}
                      {sortedTokens.map((t,i)=><TokenRow key={t.tokenAddress+i} token={t} idx={i} />)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {activeMint && <SwapDrawer mint={activeMint} onClose={()=>setActiveMint(null)} />}
        </div>
      </div>
    </div>
  );
}
