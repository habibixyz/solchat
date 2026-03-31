import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';
import { sendPaidMessage } from '../services/sendMessage';
import SwapDrawer from './SwapDrawer';
import { MINT_REGEX, TICKER_REGEX } from '../utils/tokenDetector';
import { getMyThreads } from '../services/dmService';
import { fetchUnreadCount, fetchNotifications, markAllRead } from '../services/notificationService';
import { sendReaction, fetchReactions, fetchTrending } from '../services/reactionService';

type ReactionType = 'signal';

interface Message {
  id: string; username: string; text: string; created_at: string;
  reply_to_id?: string;
  reply_preview?: { username: string; text: string } | null;
}
interface DMThread { id: string; participant_a: string; participant_b: string; created_at: string; }

const usernameCache: Record<string, string> = {};
async function resolveUsername(wallet: string) {
  if (usernameCache[wallet]) return usernameCache[wallet];
  const { data } = await supabase.from('usernames').select('username').eq('wallet_address', wallet).maybeSingle();
  const name = data?.username || `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
  usernameCache[wallet] = name;
  return name;
}
const shortW = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const LIMIT = 40;
type Panel = 'chat' | 'trending' | 'dms' | 'notifications';

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

.cl, .cl * { box-sizing: border-box; }
.cl { font-family: 'Space Mono', 'Courier New', monospace; }

/* scrollbars */
.cl ::-webkit-scrollbar { width: 3px; }
.cl ::-webkit-scrollbar-thumb { background: rgba(0,247,255,0.13); border-radius: 2px; }

/* hover states */
.cl-row:hover { background: rgba(0,247,255,0.026) !important; }
.cl-row:hover .cl-reply-btn { opacity:1 !important; }
.cl-nav:hover { background: rgba(0,247,255,0.07) !important; color: #00f7ff !important; }
.cl-dm-row:hover { background: rgba(0,247,255,0.05) !important; }
.cl-send:not(:disabled):hover {
  background: rgba(0,247,255,0.22) !important;
  box-shadow: 0 0 22px rgba(0,247,255,0.32) !important;
}
.cl-un:hover { color: #00f7ff !important; }
.cl-react:not(:disabled):hover { transform:scale(1.12); filter:brightness(1.5); }

/* input */
.cl-inp { outline: none; }
.cl-inp::placeholder { color: rgba(200,218,236,0.2); }
.cl-wrap:focus-within { border-color: rgba(0,247,255,0.32) !important; box-shadow: 0 0 0 1px rgba(0,247,255,0.08); }

/* token chips */
.token-chip {
  display: inline-block;
  background: rgba(0,247,255,0.1);
  border: 1px solid rgba(0,247,255,0.28);
  border-radius: 5px;
  padding: 2px 9px;
  font-size: 13px;
  color: #00f7ff;
  cursor: pointer;
  margin: 0 2px;
  font-family: 'Space Mono', monospace;
  transition: background .12s;
}
.token-chip:hover { background: rgba(0,247,255,0.22); }

/* reply btn hidden until hover */
.cl-reply-btn { opacity: 0; transition: opacity .15s; }

/* animations */
@keyframes fadeUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
.cl-fadein { animation: fadeUp .18s ease; }
@keyframes glow { 0%,100% { box-shadow:0 0 6px #00f7ff; opacity:1; } 50% { box-shadow:0 0 2px #00f7ff; opacity:.45; } }
.cl-live { animation: glow 2.5s infinite; }

/* nav transitions */
.cl-nav { transition: all .15s; cursor: pointer; user-select: none; }
.cl-dm-row { transition: background .12s; cursor: pointer; }
.cl-react { transition: all .15s; cursor: pointer; border: none; background: none; }
`;

const PanelWrap = ({ show, children }: { show: boolean; children: React.ReactNode }) => (
  <div style={{ 
    display: show ? 'flex' : 'none',
    flexDirection: 'column' as const,
    flex: 1, 
    height: '100%',
    width: '100%',
    minWidth: 0,
    minHeight: 0
  }}>
    {children}
  </div>
);

export default function ChatLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const wallet = useWallet();
  const myWallet = wallet.publicKey?.toBase58() ?? '';

  const { connection } = useConnection();
    

  const getPanelFromPath = (): Panel => {
  if (location.pathname.includes('dm')) return 'dms';
  if (location.pathname.includes('notifications')) return 'notifications';
  if (location.pathname.includes('trending')) return 'trending';
  return 'chat';
};
  
  const isInitialLoad = useRef(true); 
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [newMessage,     setNewMessage]      = useState('');
  const [loading,        setLoading]         = useState(false);
  const [profileName,    setProfileName]     = useState('guest');
  const [oldestDate,     setOldestDate]      = useState<string | null>(null);
  const [nameClaiming,   setNameClaiming]    = useState(false);
  const [activeMint,     setActiveMint]      = useState<string | null>(null);
  const [isMobile,       setIsMobile]        = useState(window.innerWidth < 768);
  const [mobileNav,      setMobileNav]       = useState(false);
  const [replyTo,        setReplyTo]         = useState<Message | null>(null);
  const [panel, setPanel] = useState<Panel>(getPanelFromPath());
  const isDMRoute = location.pathname.includes('dm');
  const [dmThreads,      setDmThreads]       = useState<DMThread[]>([]);
  const [dmNames,        setDmNames]         = useState<Record<string, string>>({});
  const [reactions,      setReactions]       = useState<Record<string, any>>({});
  const [reactingId,     setReactingId]      = useState<string | null>(null);
  const [trending,       setTrending]        = useState<any[]>([]);
  const [trendingLoad,   setTrendingLoad]    = useState(false);
  const [notifCount,     setNotifCount]      = useState(0);
  const [notifications,  setNotifications]   = useState<any[]>([]);
  const [notifLoad,      setNotifLoad]       = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);  
  const inputRef  = useRef<HTMLInputElement>(null);

  // inject CSS once
  useEffect(() => {
    if (document.getElementById('cl-css')) return;
    const s = document.createElement('style');
    s.id = 'cl-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }, []);


  useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}, [messages.length]);

useEffect(() => {
  setPanel(getPanelFromPath());
}, [location.pathname]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // load username
  useEffect(() => {
    if (!myWallet) { setProfileName('guest'); return; }
    supabase.from('usernames').select('username').eq('wallet_address', myWallet).maybeSingle()
      .then(({ data }) => {
        const name = data?.username || localStorage.getItem('solchat_name') || 'guest';
        setProfileName(name);
        if (data?.username) localStorage.setItem('solchat_name', data.username);
      });
  }, [myWallet]);

  // load DM threads
  useEffect(() => {
    if (!myWallet) return;
    getMyThreads(myWallet).then(async threads => {
      setDmThreads(threads as DMThread[]);
      const names: Record<string, string> = {};
      await Promise.all((threads as DMThread[]).map(async t => {
        const other = t.participant_a === myWallet ? t.participant_b : t.participant_a;
        names[t.id] = await resolveUsername(other);
      }));
      setDmNames(names);
    });
  }, [myWallet]);

  // notification count
  useEffect(() => {
    if (!myWallet) return;
    fetchUnreadCount(myWallet).then(setNotifCount);
    const ch = supabase.channel('notif-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${myWallet}` },
        () => setNotifCount(n => n + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myWallet]);

  // fetch messages
  const fetchLatest = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*')
      .order('created_at', { ascending: false }).limit(LIMIT);
    if (data) {
      const rev = data.reverse();
      
      const enhanced = rev;

      setMessages(enhanced);

if (!initialLoadDone.current) {
  initialLoadDone.current = true;

  // wait for full render (NOT just next frame)
  setTimeout(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, 0);
}
      setOldestDate(rev[0]?.created_at || null);
      fetchReactions(rev.map(m => m.id), myWallet).then(setReactions);
    }
  }, [myWallet]);

  const loadOlder = async () => {
    if (!oldestDate) return;
    const { data } = await supabase.from('messages').select('*')
      .lt('created_at', oldestDate).order('created_at', { ascending: false }).limit(LIMIT);
    if (data?.length) {
      const rev = data.reverse();
      setMessages(p => [...rev, ...p]);
      setOldestDate(rev[0].created_at);
      fetchReactions(rev.map(m => m.id), myWallet).then(r => setReactions(p => ({ ...p, ...r })));
    }
  };

  // realtime messages
  useEffect(() => {
  fetchLatest();

  const ch = supabase.channel('msgs-rt')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      payload => {
        const msg = payload.new as Message;

        setMessages(prev => {
  if (prev.find(m => m.id === msg.id)) return prev;

  const next = [...prev, msg];

  // limit size to prevent lag
  if (next.length > 80) return next.slice(-80);

  return next;
});

        fetchReactions([msg.id], myWallet)
          .then(r => setReactions(prev => ({ ...prev, ...r })));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ch);
  };
}, [fetchLatest]);

  // realtime reactions
  useEffect(() => {
    const ch = supabase.channel('react-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new as any;
        setReactions(p => {
          const cur = p[r.message_id] ?? { signal: 0, myReactions: new Set() };
          return {
            ...p,
            [r.message_id]: {
              signal: r.reaction_type === 'signal' ? cur.signal + 1 : cur.signal,
              myReactions: r.reactor === myWallet
                ? new Set([...cur.myReactions, r.reaction_type])
                : cur.myReactions,
            },
          };
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myWallet]);

  // trending
  useEffect(() => {
    if (panel !== 'trending') return;
    setTrendingLoad(true);
    fetchTrending(15).then(t => { setTrending(t); setTrendingLoad(false); });
  }, [panel]);

  // notifications
  useEffect(() => {
    if (panel !== 'notifications' || !myWallet) return;
    setNotifLoad(true);
    fetchNotifications(myWallet).then(n => { setNotifications(n); setNotifLoad(false); });
    markAllRead(myWallet).then(() => setNotifCount(0));
  }, [panel, myWallet]);

  const changeName = async () => {
    if (!myWallet) { alert('Connect wallet first'); return; }
    const name = prompt('Enter display name (3-20 chars):');
    if (!name || name.length < 3 || name.length > 20) { alert('3-20 characters'); return; }
    setNameClaiming(true);
    try {
      const { data: ex } = await supabase.from('usernames').select('wallet_address').eq('username', name).single();
      if (ex && ex.wallet_address !== myWallet) { alert(`"${name}" is taken`); return; }
      await supabase.from('usernames').upsert({ wallet_address: myWallet, username: name }, { onConflict: 'wallet_address' });
      setProfileName(name); localStorage.setItem('solchat_name', name);
    } finally { setNameClaiming(false); }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !myWallet) return;
    const txt = newMessage; const rt = replyTo;
    try {
      setLoading(true); setNewMessage(''); setReplyTo(null);
      await sendPaidMessage(wallet, connection, txt, profileName, rt?.id ?? null);
    } catch (e: any) { setNewMessage(txt); setReplyTo(rt); alert(`Failed: ${e.message}`); }
    finally { setLoading(false); }
  };

  const handleReact = async (msgId: string) => {
  // ✅ ADD THIS AT TOP
  if (!wallet?.publicKey) {
    alert('Connect wallet first');
    return;
  }

  if (reactingId) return;

  setReactingId(msgId);

  try {
    await sendReaction(
      msgId,
      wallet.publicKey.toBase58(),
      'signal',
      (wallet.sendTransaction as any).bind(wallet)
    );
  } catch (e: any) {
    console.error(e);
    alert('Reaction failed: ' + e.message);
  } finally {
    setReactingId(null);
  }
};

  const renderText = (text: string) =>
    text.split(/(\$[A-Z]{2,10}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/g).map((p, i) => {
      if (MINT_REGEX.test(p)) return <span key={i} className="token-chip" onClick={() => setActiveMint(p)}>{p.slice(0,4)}...{p.slice(-4)}</span>;
      if (TICKER_REGEX.test(p)) return <span key={i} className="token-chip">{p}</span>;
      return p.split(/(@[a-zA-Z0-9_]{3,20})/g).map((seg, j) =>
        seg.startsWith('@')
          ? <span key={`${i}-${j}`} style={{ color: '#00f7ff', fontWeight: 700 }}>{seg}</span>
          : seg
      );
    });

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'now'; if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const otherW = (t: DMThread) => t.participant_a === myWallet ? t.participant_b : t.participant_a; 

  // nav config
  const NAV: { id: Panel; icon: string; label: string; badge?: number }[] = [
    { id: 'chat',          icon: '⟁',  label: 'Global Feed' },
    { id: 'trending',      icon: '◈',  label: 'Trending' },
    { id: 'dms',           icon: '🔒', label: 'Messages',      badge: dmThreads.length || undefined },
    { id: 'notifications', icon: '◉',  label: 'Notifications', badge: notifCount || undefined },
  ];


  // ── reusable nav list ────────────────────────────────────────────────────────
  const NavList = ({ cb }: { cb?: () => void }) => (
    <>
      {NAV.map(it => (
        <div key={it.id} className="cl-nav" style={nav(panel === it.id)}
          onClick={() => { setPanel(it.id); cb?.(); }}>
          <span style={navIco}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {!!it.badge && <span style={badge}>{it.badge}</span>}
        </div>
      ))}
      <div className="cl-nav" style={nav(false)} onClick={() => { navigate('/discover'); cb?.(); }}>
        <span style={navIco}>◎</span><span>Discover</span>
      </div>
      {myWallet && profileName !== 'guest' && (
        <div className="cl-nav" style={nav(false)} onClick={() => { navigate(`/profile/${profileName}`); cb?.(); }}>
          <span style={navIco}>◉</span><span>My Profile</span>
        </div>
      )}
    </>
  );

  // ── shared panel header — IDENTICAL height/structure across all panels ────────
  const Header = ({ icon, title, sub, right }: { icon: string; title: string; sub: string; right?: React.ReactNode }) => (
    <div style={hdr}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

  {isDMRoute && (
    <button
      onClick={() => navigate(-1)}
      style={{
        background: 'none',
        border: '1px solid rgba(0,247,255,0.2)',
        color: '#00f7ff',
        borderRadius: 8,
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: 12
      }}
    >
      ←
    </button>
  )}

  <span style={{ fontSize: 22, color: '#00f7ff', lineHeight: 1, flexShrink: 0 }}>
    {icon}
  </span>

  <div>
    <div style={hdrTitle}>{title}</div>
    <div style={hdrSub}>{sub}</div>
  </div>

</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{right}</div>
    </div>
  );

  // ── empty state ──────────────────────────────────────────────────────────────
  const Empty = ({ icon, msg, hint }: { icon: string; msg: string; hint?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 10 }}>
      <div style={{ fontSize: 40, opacity: .12 }}>{icon}</div>
      <div style={{ fontSize: 15, color: 'rgba(200,218,236,0.3)', letterSpacing: 1 }}>{msg}</div>
      {hint && <div style={{ fontSize: 12, color: 'rgba(200,218,236,0.18)', letterSpacing: .5 }}>{hint}</div>}
    </div>
  );

  // ── message row (shared between chat + trending) ─────────────────────────────
  const MsgRow = ({ msg, rank, showReact }: { msg: Message | any; rank?: number; showReact?: boolean }) => {
    const isAI  = msg.username === 'AI';
    const isMe  = msg.username === profileName;
    const rc    = reactions[msg.id];
    const sigN  = rc?.signal ?? 0;
    const mine  = rc?.myReactions?.has('signal') ?? false;
    return (
      <div className="cl-row" style={{ display: 'flex', gap: 14, padding: '10px 22px', background: isAI ? 'rgba(99,102,241,0.03)' : 'transparent', borderLeft: isAI ? '2px solid rgba(99,102,241,0.2)' : '2px solid transparent', transition: 'background .1s' }}>
        {/* rank # for trending */}
        {rank !== undefined && (
          <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: rank < 3 ? '#00f7ff' : 'rgba(200,218,236,0.25)' }}>#{rank + 1}</span>
          </div>
        )}

        {/* avatar */}
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, alignSelf: 'flex-start', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isAI ? 'rgba(99,102,241,0.14)' : isMe ? 'rgba(0,247,255,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isAI ? 'rgba(99,102,241,0.28)' : isMe ? 'rgba(0,247,255,0.22)' : 'rgba(255,255,255,0.06)'}`, color: isAI ? '#a78bfa' : isMe ? '#00f7ff' : 'rgba(255,255,255,0.45)' }}>
          {isAI ? '⚡' : msg.username.slice(0, 2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* meta */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5, flexWrap: 'wrap' as const }}>
            {isAI
              ? <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', letterSpacing: .5 }}>SolChat AI</span>
              : <span className="cl-un" style={{ fontSize: 14, fontWeight: 700, color: isMe ? '#00f7ff' : '#80b8d8', letterSpacing: .5, cursor: 'pointer', transition: 'color .15s' }} onClick={() => navigate(`/profile/${msg.username}`)}>{msg.username}</span>
            }
            <span style={{ fontSize: 12, color: 'rgba(200,218,236,0.28)' }}>{timeAgo(msg.created_at)}</span>
            {rank !== undefined && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#00f7ff', background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.2)', borderRadius: 6, padding: '1px 9px' }}>⚡ {msg.reactionCount}</span>}
          </div>

          {/* reply quote */}
          {msg.reply_preview && (
            <div style={{ borderLeft: '2px solid rgba(0,247,255,0.18)', padding: '4px 10px', marginBottom: 7, fontSize: 13, color: 'rgba(200,218,236,0.38)', background: 'rgba(0,247,255,0.02)', borderRadius: '0 6px 6px 0' }}>
              <span style={{ color: '#00f7ff', fontWeight: 700 }}>@{msg.reply_preview.username}</span>{' '}
              {msg.reply_preview.text.slice(0, 80)}{msg.reply_preview.text.length > 80 ? '…' : ''}
            </div>
          )}

          {/* text */}
          <div style={{ fontSize: 15, lineHeight: 1.65, color: isAI ? '#dde8f8' : '#b8ceea', wordBreak: 'break-word' as const, whiteSpace: 'pre-wrap' as const }}>
            {renderText(msg.text)}
          </div>

          {/* actions */}
          {showReact && myWallet && (
            <div style={{ display: 'flex', gap: 6, marginTop: 7, alignItems: 'center' }}>
              <button className="cl-react" disabled={mine || !!reactingId} onClick={() => handleReact(msg.id)} title="Signal · 0.0001 SOL"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 11px', background: mine ? 'rgba(0,247,255,0.09)' : 'rgba(255,255,255,0.02)', border: `1px solid ${mine ? 'rgba(0,247,255,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 7, fontSize: 13, color: mine ? '#00f7ff' : 'rgba(200,218,236,0.3)', opacity: reactingId === msg.id ? .5 : 1, cursor: mine || !!reactingId ? 'default' : 'pointer', fontFamily: "'Space Mono',monospace" }}>
                <span>⚡</span>
                {sigN > 0 && <span>{sigN}</span>}
              </button>
              <button className="cl-react cl-reply-btn" onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} title="Reply"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, fontSize: 12, color: 'rgba(200,218,236,0.28)', cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>
                ↩ reply
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="cl" style={{ display: 'flex', height: isMobile ? '100vh' : 'calc(100vh - 58px)', width: '100%', minWidth: '100%', background: `radial-gradient(ellipse at 12% 0%, rgba(0,247,255,0.05), transparent 45%), radial-gradient(ellipse at 88% 100%, rgba(124,92,255,0.04), transparent 45%), #06101a`, overflowX: 'hidden', overflowY: 'auto', fontFamily: "'Space Mono','Courier New',monospace" }}>

      {/* ══ SIDEBAR (desktop) ══ */}
      {!isMobile && (
        <aside style={{ width: 250, minWidth: 250,  maxWidth: 250, flexShrink: 0, display: 'flex', flexDirection: 'column' as const, background: 'rgba(4,9,18,0.97)', borderRight: '1px solid rgba(0,247,255,0.07)', backdropFilter: 'blur(24px)' }}>

          {/* brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '20px 18px 17px', borderBottom: '1px solid rgba(0,247,255,0.07)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#00f7ff', boxShadow: '0 0 14px rgba(0,247,255,0.12)' }}>⟁</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#00f7ff', letterSpacing: 2, textShadow: '0 0 10px rgba(0,247,255,0.4)' }}>SOLCHAT</div>
              <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.35)', letterSpacing: 2, marginTop: 2 }}>social trading layer</div>
            </div>
          </div>

          {/* nav */}
          <nav style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,247,255,0.07)' }}>
            <div style={secLabel}>NAVIGATE</div>
            <NavList />
          </nav>

          {/* dm quick list */}
          {dmThreads.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto' as const, minHeight: 0 }}>
              <div style={secLabel}>MESSAGES</div>
              {dmThreads.slice(0, 8).map(t => (
                <div key={t.id} className="cl-dm-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}
                  onClick={() => navigate(`/dm?dm=${otherW(t)}`)}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'rgba(0,247,255,0.06)', border: '1px solid rgba(0,247,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(0,247,255,0.4)' }}>
                    {(dmNames[t.id] ?? '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#c8d8ec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{dmNames[t.id] ?? shortW(otherW(t))}</div>
                    <div style={{ fontSize: 10, color: 'rgba(200,218,236,0.3)', letterSpacing: 1 }}>encrypted</div>
                  </div>
                  <span style={{ color: 'rgba(0,247,255,0.3)', fontSize: 12 }}>→</span>
                </div>
              ))}
            </div>
          )}

          {/* user footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderTop: '1px solid rgba(0,247,255,0.07)', background: 'rgba(0,247,255,0.015)', marginTop: 'auto' as const }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: 'rgba(0,247,255,0.1)', border: '1px solid rgba(0,247,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00f7ff' }}>
              {profileName === 'guest' ? '?' : profileName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e4eeff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{profileName}</div>
              <div style={{ fontSize: 10, color: 'rgba(200,218,236,0.3)', letterSpacing: 1, marginTop: 1 }}>{myWallet ? shortW(myWallet) : 'not connected'}</div>
            </div>
            <button style={{ background: 'rgba(0,247,255,0.04)', border: '1px solid rgba(0,247,255,0.09)', borderRadius: 7, color: 'rgba(0,247,255,0.35)', cursor: 'pointer', fontSize: 14, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
              onClick={changeName} disabled={nameClaiming} title="Change username">✎</button>
          </div>
        </aside>
      )}

      {/* ══ MAIN ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: isMobile ? 'auto' : 'hidden', minWidth: 0, width: '100%', maxWidth: '100%', height: '100%'}}>

        {/* mobile bar */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(0,247,255,0.07)', background: 'rgba(4,9,18,0.95)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
            <button style={{ background: 'none', border: 'none', color: '#00f7ff', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }} onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? '✕' : '☰'}</button>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#00f7ff', letterSpacing: 2, flex: 1 }}>SOLCHAT</span>
            {notifCount > 0 && <span style={badge}>{notifCount}</span>}
          </div>
        )}

        {/* mobile dropdown */}
        {isMobile && mobileNav && (
          <div style={{ background: 'rgba(4,9,18,0.97)', borderBottom: '1px solid rgba(0,247,255,0.07)', padding: '8px 0', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
            <NavList cb={() => setMobileNav(false)} />
          </div>
        )}

        {/* ══ GLOBAL FEED ══ */}
            <PanelWrap show={panel === 'chat'}>

  <Header icon="⟁" title="GLOBAL SIGNAL" sub="public · pay-to-post · 0.001 SOL"
    right={<>
      <span className="cl-live" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f7ff', display: 'inline-block' }} />
      {myWallet && profileName !== 'guest' && (
        <span className="cl-un"
          style={{ fontSize: 13, color: 'rgba(0,247,255,0.4)', cursor: 'pointer', letterSpacing: 1, transition: 'color .15s' }}
          onClick={() => navigate(`/profile/${profileName}`)}>
          @{profileName} ↗
        </span>
      )}
    </>}
  />

  <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0', minHeight: 0, maxHeight: '100%'}}>
    {oldestDate && (
      <div style={{ textAlign: 'center', padding: '10px', fontSize: 12, color: 'rgba(0,247,255,0.35)', cursor: 'pointer', letterSpacing: 2, borderBottom: '1px solid rgba(0,247,255,0.07)', marginBottom: 4 }}
        onClick={loadOlder}>
        ↑ load older
      </div>
    )}

  {messages.map((msg, i) => {
  const clustered = messages[i - 1]?.username === msg.username;

  return clustered ? (
    <div
      key={msg.id}
      className="cl-row"
      style={{ display: 'flex', padding: '3px 22px 3px 76px' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {renderText(msg.text)}
      </div>
    </div>
  ) : (
    <MsgRow key={msg.id} msg={msg} showReact />
  );
})}

</div>

  {replyTo && (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid rgba(0,247,255,0.07)',
    background: 'rgba(0,247,255,0.03)'
  }}>
    <span style={{ color: 'rgba(0,247,255,0.4)', fontSize: 13 }}>↩</span>

    <span style={{ color: '#00f7ff', fontSize: 13, fontWeight: 700 }}>
      @{replyTo.username}
    </span>

    <span style={{
      color: 'rgba(200,218,236,0.35)',
      fontSize: 13,
      flex: 1
    }}>
      {replyTo.text.slice(0, 70)}
    </span>

    <button
      onClick={() => setReplyTo(null)}
      style={{
        background: 'none',
        border: 'none',
        color: 'rgba(200,218,236,0.4)',
        cursor: 'pointer'
      }}
    >
      ✕
    </button>
  </div>
)}

  <div style={{
  padding: '13px 16px',
  borderTop: '1px solid rgba(0,247,255,0.07)',
  flexShrink: 0,
  background: 'rgba(4,9,18,0.8)'
}}>
  <div style={{
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    border: '1px solid rgba(0,247,255,0.12)',
    borderRadius: 10,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)'
  }}>
    <input
      ref={inputRef}
      value={newMessage}
      onChange={e => setNewMessage(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !loading) handleSend();
      }}
      placeholder={myWallet ? "type signal..." : "connect wallet"}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        color: '#c8daec',
        fontSize: 14,
        outline: 'none'
      }}
    />

    <button
      onClick={handleSend}
      disabled={!newMessage.trim() || loading}
      style={{
        background: 'rgba(0,247,255,0.1)',
        border: '1px solid rgba(0,247,255,0.2)',
        borderRadius: 8,
        color: '#00f7ff',
        padding: '6px 12px',
        cursor: 'pointer'
      }}
    >
      →
    </button>
  </div>

</div>

</PanelWrap>

        {/* ══ TRENDING ══ */}
        <PanelWrap show={panel === 'trending'}>

  <Header icon="◈" title="TRENDING SIGNALS" sub="most ⚡ reacted · last 24h"
    right={
      <button
  style={{
    background: 'none',
    border: '1px solid rgba(0,247,255,0.1)',
    color: 'rgba(0,247,255,0.4)',
    cursor: 'pointer',
    fontSize: 12,
    borderRadius: 7,
    padding: '6px 13px',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: 1
  }}
  onClick={() => {
    setTrendingLoad(true);
    fetchTrending(15).then(t => {
      setTrending(t);
      setTrendingLoad(false);
    });
  }}
>
  ↻ refresh
</button>
      
    }
  />

  <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', minHeight: 0 }}>
    {trendingLoad
      ? <Empty icon="◈" msg="LOADING..." />
      : trending.length === 0
        ? <Empty icon="◈" msg="NO TRENDING YET" hint="⚡ react to messages to start trending" />
        : trending.map((msg, i) => (
            <MsgRow key={msg.id} msg={msg} rank={i} />
          ))
    }
  </div>

</PanelWrap>

        {/* ══ DMs ══ */}
        <PanelWrap show={panel === 'dms'}>
          <Header icon="🔒" title="DIRECT MESSAGES" sub="private · encrypted threads" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!myWallet ? <Empty icon="🔒" msg="CONNECT WALLET" hint="to access your direct messages" /> :
             dmThreads.length === 0 ? <Empty icon="⟁" msg="NO THREADS YET" hint="go to any profile and hit Direct Message" /> :
             dmThreads.map(t => {
               const other = otherW(t); const name = dmNames[t.id] ?? shortW(other);
               return (
                 <div key={t.id} className="cl-dm-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', background: 'rgba(0,247,255,0.02)', border: '1px solid rgba(0,247,255,0.07)', borderRadius: 14 }}
                   onClick={() => navigate(`/dm?dm=${other}`)}>
                   <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: 'rgba(0,247,255,0.07)', border: '1px solid rgba(0,247,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#00f7ff' }}>{name.slice(0, 2).toUpperCase()}</div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontSize: 15, fontWeight: 700, color: '#e4eeff', marginBottom: 3 }}>{name}</div>
                     <div style={{ fontSize: 11, color: 'rgba(200,218,236,0.3)', letterSpacing: 1 }}>private · encrypted · {shortW(other)}</div>
                   </div>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'rgba(0,247,255,0.3)', flexShrink: 0 }}><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                 </div>
               );
             })}
          </div> </PanelWrap>
        

        {/* ══ NOTIFICATIONS ══ */}
        <PanelWrap show={panel === 'notifications'}>
          <Header icon="◉" title="NOTIFICATIONS" sub="@mentions · signals" />
          <div style={{ flex: 1, overflowY: 'auto' as const, padding: '16px 18px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {!myWallet ? <Empty icon="◉" msg="CONNECT WALLET" hint="to see your notifications" /> :
             notifLoad ? <Empty icon="◉" msg="LOADING..." /> :
             notifications.length === 0 ? <Empty icon="◉" msg="NO NOTIFICATIONS YET" hint="you'll see @mentions here" /> :
             notifications.map(n => (
               <div key={n.id} className="cl-fadein cl-dm-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '15px 18px', background: n.read ? 'rgba(255,255,255,0.01)' : 'rgba(0,247,255,0.04)', border: `1px solid ${n.read ? 'rgba(0,247,255,0.05)' : 'rgba(0,247,255,0.12)'}`, borderRadius: 14 }}
                 onClick={() => navigate('/')}>
                 <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: n.read ? 'transparent' : '#00f7ff', boxShadow: n.read ? 'none' : '0 0 7px #00f7ff' }} />
                 <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
                     <span style={{ color: '#00f7ff', fontWeight: 700 }}>@{n.sender_name}</span>
                     <span style={{ color: 'rgba(200,218,236,0.35)' }}>mentioned you</span>
                     <span style={{ color: 'rgba(200,218,236,0.25)', marginLeft: 'auto', fontSize: 12 }}>{timeAgo(n.created_at)}</span>
                   </div>
                   <div style={{ fontSize: 14, color: 'rgba(200,218,236,0.62)', lineHeight: 1.55, wordBreak: 'break-word' as const }}>{n.message_preview}</div>
                 </div>
               </div>
             ))}
          </div> </PanelWrap>
      
      </div>

      {activeMint && <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />}
    </div>
  );
}

// ── Shared tiny style atoms ───────────────────────────────────────────────────
const hdr: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 22px',
  borderBottom: '1px solid rgba(0,247,255,0.07)',
  background: 'rgba(4,9,18,0.72)',
  backdropFilter: 'blur(12px)',
  flexShrink: 0,
  minHeight: 64,   // locked — prevents ANY height difference between panels
};
const hdrTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#e4eeff', letterSpacing: 2 };
const hdrSub:   React.CSSProperties = { fontSize: 11, color: 'rgba(0,247,255,0.38)', letterSpacing: 2, marginTop: 2 };

const nav = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 13,
  padding: '12px 18px', margin: '2px 8px', borderRadius: 10,
  fontSize: 14, fontWeight: active ? 700 : 400,
  color: active ? '#00f7ff' : '#c0d0e4',
  background: active ? 'rgba(0,247,255,0.08)' : 'transparent',
  borderLeft: active ? '2px solid #00f7ff' : '2px solid transparent',
  letterSpacing: 0.5,
});

const navIco: React.CSSProperties = { width: 20, textAlign: 'center' as const, flexShrink: 0, fontSize: 15 };

const badge: React.CSSProperties = {
  background: 'rgba(0,247,255,0.13)', color: '#00f7ff',
  border: '1px solid rgba(0,247,255,0.28)', borderRadius: 10,
  fontSize: 11, fontWeight: 700, padding: '1px 8px', marginLeft: 'auto',
};

const secLabel: React.CSSProperties = {
  fontSize: 9, color: 'rgba(0,247,255,0.2)', letterSpacing: 3,
  padding: '10px 20px 5px', fontWeight: 700,
};

