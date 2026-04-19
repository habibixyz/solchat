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

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .cl, .cl * { box-sizing: border-box; }
  .cl { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

  .cl-scroll::-webkit-scrollbar { width: 3px; }
  .cl-scroll::-webkit-scrollbar-track { background: transparent; }
  .cl-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

  .cl-row {
    display: flex; gap: 12px; padding: 14px 16px; margin: 3px 10px;
    background: #16161a; border-radius: 12px;
    border: 0.5px solid rgba(255,255,255,0.06); transition: background 0.12s;
  }
  .cl-row:hover { background: #1c1c22 !important; }

  .sc-reply-btn {
    display: inline-flex !important; align-items: center !important; gap: 5px !important;
    padding: 4px 12px !important; background: transparent !important;
    border: 0.5px solid rgba(255,255,255,0.1) !important; border-radius: 20px !important;
    font-size: 12px !important; font-weight: 500 !important; color: #475569 !important;
    cursor: pointer !important; font-family: 'Inter', sans-serif !important;
    transition: all 0.15s !important; line-height: 1 !important;
  }
  .sc-reply-btn:hover {
    color: #1D9E75 !important;
    border-color: rgba(29,158,117,0.4) !important;
    background: rgba(29,158,117,0.08) !important;
  }

  .cl-react {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 11px; border-radius: 20px; font-size: 12px; font-weight: 500;
    font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s;
    border: 0.5px solid rgba(255,255,255,0.07); background: transparent; color: #475569; line-height: 1;
  }
  .cl-react:not(:disabled):hover { filter: brightness(1.3); }
  .cl-react:disabled { cursor: default; }

  .cl-nav {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    margin: 2px 8px; border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif;
    transition: all 0.12s; cursor: pointer; user-select: none; border-left: 2px solid transparent;
  }
  .cl-nav:hover { background: rgba(255,255,255,0.05) !important; color: #eef2f7 !important; }
  .cl-nav.active { color: #eef2f7 !important; background: rgba(255,255,255,0.06) !important; border-left-color: #1D9E75 !important; }

  .cl-dm-row { transition: background 0.12s; cursor: pointer; }
  .cl-dm-row:hover { background: rgba(255,255,255,0.04) !important; }

  .cl-un { transition: color 0.12s; cursor: pointer; }
  .cl-un:hover { color: #1D9E75 !important; }

  .cl-inp { outline: none; }
  .cl-inp::placeholder { color: #334155; opacity: 1; }
  .cl-input-wrap:focus-within { border-color: rgba(255,255,255,0.18) !important; }

  .token-chip {
    display: inline-block; background: rgba(29,158,117,0.1);
    border: 0.5px solid rgba(29,158,117,0.35); border-radius: 20px;
    padding: 2px 9px; font-size: 12px; font-weight: 600; color: #1D9E75;
    cursor: pointer; margin: 0 2px; font-family: 'Space Mono', monospace; transition: background 0.12s;
  }
  .token-chip:hover { background: rgba(29,158,117,0.2); }

  @keyframes scPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .cl-live { animation: scPulse 2.5s ease infinite; }

  @keyframes scFadeUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
  .cl-fadein { animation: scFadeUp 0.18s ease; }

  #sc-bottom-nav { display: none; }
  @media (max-width: 768px) {
    #sc-bottom-nav {
      display: flex !important; position: fixed !important;
      bottom: 0 !important; left: 0 !important; right: 0 !important;
      height: 60px !important; padding-bottom: env(safe-area-inset-bottom, 0px) !important;
      background: #0f0f12 !important; border-top: 0.5px solid rgba(255,255,255,0.1) !important;
      z-index: 99999 !important; align-items: stretch !important;
    }
    #sc-bottom-nav a {
      flex: 1 !important; display: flex !important; flex-direction: column !important;
      align-items: center !important; justify-content: center !important; gap: 4px !important;
      color: #334155 !important; text-decoration: none !important; font-size: 10px !important;
      font-weight: 500 !important; font-family: 'Inter', sans-serif !important;
      transition: color 0.15s !important; padding: 6px 0 !important;
      border: none !important; background: transparent !important; text-shadow: none !important;
    }
    #sc-bottom-nav a.active { color: #1D9E75 !important; }
    #sc-bottom-nav a:hover  { color: #64748b !important; }
    #sc-bottom-nav svg {
      width: 20px !important; height: 20px !important; stroke: currentColor !important;
      fill: none !important; stroke-width: 1.5 !important; stroke-linecap: round !important; stroke-linejoin: round !important;
    }
    #sc-bottom-nav span { font-size: 10px !important; line-height: 1 !important; }
  }
`;

// ── Telegram-style reply quote ─────────────────────────────────────────────
const ReplyQuote = ({ username, text }: { username: string; text: string }) => (
  <div style={{
    borderLeft: '2px solid rgba(29,158,117,0.5)',
    padding: '4px 10px',
    marginBottom: 6,
    background: 'rgba(29,158,117,0.06)',
    borderRadius: '0 6px 6px 0',
    maxWidth: '100%',
    overflow: 'hidden',
  }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
      ↩ @{username}
    </div>
    <div style={{ fontSize: 12, color: '#475569', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {text.slice(0, 100)}{text.length > 100 ? '…' : ''}
    </div>
  </div>
);

const PanelWrap = ({ show, children }: { show: boolean; children: React.ReactNode }) => (
  <div style={{ display: show ? 'flex' : 'none', flexDirection: 'column' as const, flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' }}>
    {children}
  </div>
);

export default function ChatLayout() {
  const navigate       = useNavigate();
  const location       = useLocation();
  const wallet         = useWallet();
  const myWallet       = wallet.publicKey?.toBase58() ?? '';
  const { connection } = useConnection();

  const getPanelFromPath = (): Panel => {
    if (location.pathname.includes('dm'))            return 'dms';
    if (location.pathname.includes('notifications')) return 'notifications';
    if (location.pathname.includes('trending'))      return 'trending';
    return 'chat';
  };

  const [messages,      setMessages]     = useState<Message[]>([]);
  const [newMessage,    setNewMessage]   = useState('');
  const [loading,       setLoading]      = useState(false);
  const [profileName,   setProfileName]  = useState('guest');
  const [oldestDate,    setOldestDate]   = useState<string | null>(null);
  const [nameClaiming,  setNameClaiming] = useState(false);
  const [activeMint,    setActiveMint]   = useState<string | null>(null);
  const [isMobile,      setIsMobile]     = useState(window.innerWidth < 768);
  const [replyTo,       setReplyTo]      = useState<Message | null>(null);
  const [panel,         setPanel]        = useState<Panel>(getPanelFromPath());
  const isDMRoute = location.pathname.includes('dm');
  const [dmThreads,     setDmThreads]    = useState<DMThread[]>([]);
  const [dmNames,       setDmNames]      = useState<Record<string, string>>({});
  const [reactions,     setReactions]    = useState<Record<string, any>>({});
  const [reactingId,    setReactingId]   = useState<string | null>(null);
  const [trending,      setTrending]     = useState<any[]>([]);
  const [trendingLoad,  setTrendingLoad] = useState(false);
  const [notifCount,    setNotifCount]   = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoad,     setNotifLoad]    = useState(false);

  const scrollRef       = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const inputRef        = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.getElementById('cl-css')) return;
    const s = document.createElement('style');
    s.id = 'cl-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages.length]);

  useEffect(() => { setPanel(getPanelFromPath()); }, [location.pathname]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (!myWallet) { setProfileName('guest'); return; }
    supabase.from('usernames').select('username').eq('wallet_address', myWallet).maybeSingle()
      .then(({ data }) => {
        const name = data?.username || localStorage.getItem('solchat_name') || 'guest';
        setProfileName(name);
        if (data?.username) localStorage.setItem('solchat_name', data.username);
      });
  }, [myWallet]);

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

  useEffect(() => {
    if (!myWallet) return;
    fetchUnreadCount(myWallet).then(setNotifCount);
    const ch = supabase.channel('notif-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${myWallet}` },
        () => setNotifCount(n => n + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myWallet]);

  const fetchLatest = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(LIMIT);
    if (data) {
      const rev = data.reverse();
      setMessages(rev);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setTimeout(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, 100);
      }
      setOldestDate(rev[0]?.created_at || null);
      fetchReactions(rev.map(m => m.id), myWallet).then(setReactions);
    }
  }, [myWallet]);

  const loadOlder = async () => {
    if (!oldestDate) return;
    const { data } = await supabase.from('messages').select('*').lt('created_at', oldestDate).order('created_at', { ascending: false }).limit(LIMIT);
    if (data?.length) {
      const rev = data.reverse();
      setMessages(p => [...rev, ...p]);
      setOldestDate(rev[0].created_at);
      fetchReactions(rev.map(m => m.id), myWallet).then(r => setReactions(p => ({ ...p, ...r })));
    }
  };

  useEffect(() => {
    fetchLatest();
    const ch = supabase.channel('msgs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Message;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          return next.length > 80 ? next.slice(-80) : next;
        });
        fetchReactions([msg.id], myWallet).then(r => setReactions(prev => ({ ...prev, ...r })));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchLatest]);

  useEffect(() => {
    const ch = supabase.channel('react-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new as any;
        setReactions(p => {
          const cur = p[r.message_id] ?? { signal: 0, myReactions: new Set() };
          return { ...p, [r.message_id]: { signal: r.reaction_type === 'signal' ? cur.signal + 1 : cur.signal, myReactions: r.reactor === myWallet ? new Set([...cur.myReactions, r.reaction_type]) : cur.myReactions } };
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myWallet]);

  useEffect(() => {
    if (panel !== 'trending') return;
    setTrendingLoad(true);
    fetchTrending(15).then(t => { setTrending(t); setTrendingLoad(false); });
  }, [panel]);

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
    if (!wallet?.publicKey) { alert('Connect wallet first'); return; }
    if (reactingId) return;
    setReactingId(msgId);
    try {
      await sendReaction(msgId, wallet.publicKey.toBase58(), 'signal', (wallet.sendTransaction as any).bind(wallet));
    } catch (e: any) { console.error(e); alert('Reaction failed: ' + e.message); }
    finally { setReactingId(null); }
  };

  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const renderText = (text: string) =>
    text.split(/(\$[A-Z]{2,10}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/g).map((p, i) => {
      if (MINT_REGEX.test(p)) return <span key={i} className="token-chip" onClick={() => setActiveMint(p)}>{p.slice(0,4)}...{p.slice(-4)}</span>;
      if (TICKER_REGEX.test(p)) return <span key={i} className="token-chip">{p}</span>;
      return p.split(/(@[a-zA-Z0-9_]{3,20})/g).map((seg, j) =>
        seg.startsWith('@') ? <span key={`${i}-${j}`} style={{ color: '#1D9E75', fontWeight: 600 }}>{seg}</span> : seg
      );
    });

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'now'; if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const otherW = (t: DMThread) => t.participant_a === myWallet ? t.participant_b : t.participant_a;

  const NAV: { id: Panel; icon: string; label: string; badge?: number }[] = [
    { id: 'chat',          icon: '⟁', label: 'Global Feed' },
    { id: 'trending',      icon: '◈', label: 'Trending' },
    { id: 'dms',           icon: '💬', label: 'Messages', badge: dmThreads.length || undefined },
    { id: 'notifications', icon: '🔔', label: 'Notifications', badge: notifCount || undefined },
  ];

  const NavList = ({ cb }: { cb?: () => void }) => (
    <>
      {NAV.map(it => (
        <div key={it.id} className={`cl-nav${panel === it.id ? ' active' : ''}`}
          style={{ color: panel === it.id ? '#eef2f7' : '#64748b', fontWeight: panel === it.id ? 600 : 400 }}
          onClick={() => { setPanel(it.id); cb?.(); }}>
          <span style={{ width: 20, textAlign: 'center' as const, fontSize: 14 }}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {!!it.badge && <span style={badgeSt}>{it.badge}</span>}
        </div>
      ))}
      <div className="cl-nav" style={{ color: '#64748b' }} onClick={() => { navigate('/discover'); cb?.(); }}>
        <span style={{ width: 20, textAlign: 'center' as const, fontSize: 14 }}>◎</span><span>Discover</span>
      </div>
      {myWallet && profileName !== 'guest' && (
        <div className="cl-nav" style={{ color: '#64748b' }} onClick={() => { navigate(`/profile/${profileName}`); cb?.(); }}>
          <span style={{ width: 20, textAlign: 'center' as const, fontSize: 14 }}>◉</span><span>My Profile</span>
        </div>
      )}
    </>
  );

  const Header = ({ icon, title, sub, right }: { icon: string; title: string; sub: string; right?: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#0f0f12', borderBottom: '0.5px solid rgba(255,255,255,0.07)', flexShrink: 0, minHeight: 58 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isDMRoute && (<button onClick={() => navigate(-1)} style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.1)', color: '#64748b', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>←</button>)}
        <span style={{ fontSize: 18, color: '#1D9E75', lineHeight: 1 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#eef2f7', fontFamily: 'Inter, sans-serif' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 1, fontFamily: 'Inter, sans-serif' }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
    </div>
  );

  const Empty = ({ icon, msg, hint }: { icon: string; msg: string; hint?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, padding: '60px 20px' }}>
      <div style={{ fontSize: 32, opacity: 0.1 }}>{icon}</div>
      <div style={{ fontSize: 14, color: '#475569', fontFamily: 'Inter, sans-serif' }}>{msg}</div>
      {hint && <div style={{ fontSize: 12, color: '#334155', fontFamily: 'Inter, sans-serif', textAlign: 'center' as const }}>{hint}</div>}
    </div>
  );

  // ── Signal + Reply action buttons ─────────────────────────────────────────
  const MsgActions = ({ msg, showReact }: { msg: Message | any; showReact?: boolean }) => {
    const rc   = reactions[msg.id];
    const sigN = rc?.signal ?? 0;
    const mine = rc?.myReactions?.has('signal') ?? false;
    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
        {showReact && myWallet && (
          <button className="cl-react" disabled={mine || !!reactingId} onClick={() => handleReact(msg.id)} title="Signal · 0.0001 SOL"
            style={{ color: mine ? '#1D9E75' : '#475569', background: mine ? 'rgba(29,158,117,0.08)' : 'transparent', borderColor: mine ? 'rgba(29,158,117,0.25)' : 'rgba(255,255,255,0.07)', opacity: reactingId === msg.id ? 0.5 : 1 }}>
            <span>⚡</span>{sigN > 0 && <span>{sigN}</span>}
          </button>
        )}
        <button className="sc-reply-btn" onClick={() => handleReply(msg)}>↩ reply</button>
      </div>
    );
  };

  // ── Full message row (with avatar + username) ──────────────────────────────
  const MsgRow = ({ msg, rank, showReact }: { msg: Message | any; rank?: number; showReact?: boolean }) => {
    const isAI = msg.username === 'AI';
    const isMe = msg.username === profileName;
    return (
      <div className="cl-row">
        {rank !== undefined && (
          <div style={{ width: 24, flexShrink: 0, paddingTop: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: rank < 3 ? '#1D9E75' : '#334155' }}>#{rank + 1}</span>
          </div>
        )}
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: isAI ? 'rgba(99,102,241,0.12)' : isMe ? 'rgba(29,158,117,0.12)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${isAI ? 'rgba(99,102,241,0.25)' : isMe ? 'rgba(29,158,117,0.3)' : 'rgba(255,255,255,0.07)'}`, color: isAI ? '#a78bfa' : isMe ? '#1D9E75' : '#64748b', fontFamily: 'Inter, sans-serif' }}>
          {isAI ? '⚡' : msg.username.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Username + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' as const }}>
            {isAI
              ? <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', fontFamily: 'Inter, sans-serif' }}>SolChat AI</span>
              : <span className="cl-un" style={{ fontSize: 13, fontWeight: 600, color: isMe ? '#1D9E75' : '#94a3b8', fontFamily: 'Inter, sans-serif' }} onClick={() => navigate(`/profile/${msg.username}`)}>{msg.username}</span>
            }
            <span style={{ fontSize: 11, color: '#334155', fontFamily: 'Inter, sans-serif' }}>{timeAgo(msg.created_at)}</span>
            {rank !== undefined && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#1D9E75', background: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 20, padding: '2px 8px', fontFamily: 'Inter, sans-serif' }}>⚡ {msg.reactionCount}</span>
            )}
          </div>
          {/* Reply quote — Telegram style */}
          {msg.reply_preview && <ReplyQuote username={msg.reply_preview.username} text={msg.reply_preview.text} />}
          {/* Message body */}
          <div style={{ fontSize: 14, lineHeight: 1.6, color: isAI ? '#e2e8f0' : '#cbd5e1', wordBreak: 'break-word' as const, whiteSpace: 'pre-wrap' as const, fontFamily: 'Inter, -apple-system, sans-serif' }}>
            {renderText(msg.text)}
          </div>
          <MsgActions msg={msg} showReact={showReact} />
        </div>
      </div>
    );
  };

  // ── Clustered row (same sender back-to-back) — ALWAYS shows name + reply quote ──
  const ClusteredRow = ({ msg, showReact }: { msg: Message; showReact?: boolean }) => (
    <div className="cl-row" style={{ margin: '2px 10px', padding: '6px 14px 6px 62px', borderRadius: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Always show sender name even in clustered rows */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>
          {msg.username}
        </div>
        {/* Reply quote — same Telegram style */}
        {msg.reply_preview && <ReplyQuote username={msg.reply_preview.username} text={msg.reply_preview.text} />}
        {/* Message body */}
        <div style={{ fontSize: 14, lineHeight: 1.6, color: '#94a3b8', wordBreak: 'break-word' as const, whiteSpace: 'pre-wrap' as const, fontFamily: 'Inter, sans-serif' }}>
          {renderText(msg.text)}
        </div>
        <MsgActions msg={msg} showReact={showReact} />
      </div>
    </div>
  );

  // Mobile bottom bar heights
  const NAV_H   = 60;
  const INPUT_H = 58;
  const REPLY_H = 52;
  const SAFE    = 'env(safe-area-inset-bottom, 0px)';
  const bottomTotalH  = replyTo ? `calc(${NAV_H}px + ${INPUT_H}px + ${REPLY_H}px + ${SAFE})` : `calc(${NAV_H}px + ${INPUT_H}px + ${SAFE})`;
  const inputBarBottom = `calc(${NAV_H}px + ${SAFE})`;

  // ── Reply strip — used in both mobile and desktop ──────────────────────────
  const ReplyStrip = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '0.5px solid rgba(29,158,117,0.3)', background: 'rgba(29,158,117,0.06)' }}>
      <span style={{ color: '#1D9E75', fontSize: 16, flexShrink: 0 }}>↩</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
          Replying to @{replyTo!.username}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'Inter, sans-serif', overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' }}>
          {replyTo!.text.slice(0, 80)}{replyTo!.text.length > 80 ? '…' : ''}
        </div>
      </div>
      <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  );

  // ── Input field — shared markup ────────────────────────────────────────────
  const InputField = () => (
    <div className="cl-input-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#111116', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px' }}>
      <input
        ref={inputRef}
        className="cl-inp"
        value={newMessage}
        onChange={e => setNewMessage(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSend(); }}
        placeholder={myWallet ? (replyTo ? `Reply to @${replyTo.username}…` : 'Type a signal...') : 'Connect wallet to post'}
        style={{ flex: 1, background: 'transparent', border: 'none', color: '#eef2f7', fontSize: 14, outline: 'none', fontFamily: 'Inter, -apple-system, sans-serif' }}
      />
      <button onClick={handleSend} disabled={!newMessage.trim() || loading}
        style={{ background: newMessage.trim() && !loading ? '#1D9E75' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, color: newMessage.trim() && !loading ? '#fff' : '#334155', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newMessage.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, fontSize: 15, transition: 'all 0.15s' }}>
        →
      </button>
    </div>
  );

  return (
    <div className="cl" style={{ display: 'flex', height: `calc(100vh - 52px)`, maxHeight: `calc(100vh - 52px)`, width: '100%', background: '#0a0a0b', overflow: 'hidden', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* ══ SIDEBAR (desktop only) ══════════════════════════════════════════ */}
      {!isMobile && (
        <aside style={{ width: 240, minWidth: 240, maxWidth: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' as const, background: '#0f0f12', borderRight: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: 'rgba(29,158,117,0.1)', border: '0.5px solid rgba(29,158,117,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#1D9E75' }}>⟁</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef2f7', letterSpacing: 1.5, fontFamily: 'Inter, sans-serif' }}>SOLCHAT</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>social trading layer</div>
            </div>
          </div>
          <nav style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 9, color: '#334155', letterSpacing: 2, padding: '8px 16px 4px', fontWeight: 600, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' as const }}>Navigate</div>
            <NavList />
          </nav>
          {dmThreads.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto' as const, minHeight: 0 }}>
              <div style={{ fontSize: 9, color: '#334155', letterSpacing: 2, padding: '8px 16px 4px', fontWeight: 600, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' as const }}>Messages</div>
              {dmThreads.slice(0, 8).map(t => (
                <div key={t.id} className="cl-dm-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }} onClick={() => navigate(`/dm?dm=${otherW(t)}`)}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#475569', fontFamily: 'Inter, sans-serif' }}>{(dmNames[t.id] ?? '??').slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: 'Inter, sans-serif' }}>{dmNames[t.id] ?? shortW(otherW(t))}</div>
                    <div style={{ fontSize: 10, color: '#334155', fontFamily: 'Inter, sans-serif' }}>encrypted</div>
                  </div>
                  <span style={{ color: '#334155', fontSize: 14 }}>›</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '0.5px solid rgba(255,255,255,0.07)', marginTop: 'auto' as const }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'rgba(29,158,117,0.1)', border: '0.5px solid rgba(29,158,117,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1D9E75', fontFamily: 'Inter, sans-serif' }}>{profileName === 'guest' ? '?' : profileName.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#eef2f7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: 'Inter, sans-serif' }}>{profileName}</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 1, fontFamily: 'Inter, sans-serif' }}>{myWallet ? shortW(myWallet) : 'not connected'}</div>
            </div>
            <button style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 7, color: '#475569', cursor: 'pointer', fontSize: 13, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }} onClick={changeName} disabled={nameClaiming} title="Change username">✎</button>
          </div>
        </aside>
      )}

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0, overflow: 'hidden', paddingBottom: isMobile ? bottomTotalH : '0' }}>

        {/* ── GLOBAL FEED ─────────────────────────────────────────────────── */}
        <PanelWrap show={panel === 'chat'}>
          <Header icon="⟁" title="Global Signal" sub="public · pay-to-post · 0.001 SOL"
            right={<>
              <span className="cl-live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', display: 'inline-block', flexShrink: 0 }} />
              {myWallet && profileName !== 'guest' && (
                <span className="cl-un" style={{ fontSize: 12, color: '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }} onClick={() => navigate(`/profile/${profileName}`)}>@{profileName} ↗</span>
              )}
            </>}
          />

          {/* Message list */}
          <div ref={scrollRef} className="cl-scroll" style={{ flex: 1, overflowY: 'auto' as const, padding: '6px 0', minHeight: 0 }}>
            {oldestDate && (
              <div style={{ textAlign: 'center', padding: '10px', fontSize: 11, color: '#334155', cursor: 'pointer' }} onClick={loadOlder}>↑ load older</div>
            )}
            {messages.map((msg, i) => {
              const clustered = messages[i - 1]?.username === msg.username;
              return clustered
                ? <ClusteredRow key={msg.id} msg={msg} showReact />
                : <MsgRow key={msg.id} msg={msg} showReact />;
            })}
            <div style={{ height: 8 }} />
          </div>

          {/* ── MOBILE: fixed bottom container (reply strip + input) ── */}
          {isMobile ? (
            <div style={{ position: 'fixed', bottom: inputBarBottom, left: 0, right: 0, zIndex: 100, background: '#0a0a0b' }}>
              {replyTo && <ReplyStrip />}
              <div style={{ padding: '10px' }}>
                <InputField />
              </div>
            </div>
          ) : (
            // ── DESKTOP: inline at bottom ──
            <div style={{ flexShrink: 0 }}>
              {replyTo && <ReplyStrip />}
              <div style={{ padding: '10px 12px', background: '#0a0a0b' }}>
                <InputField />
              </div>
            </div>
          )}
        </PanelWrap>

        {/* ── TRENDING ────────────────────────────────────────────────────── */}
        <PanelWrap show={panel === 'trending'}>
          <Header icon="◈" title="Trending Signals" sub="most ⚡ reacted · last 24h"
            right={<button style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.08)', color: '#475569', cursor: 'pointer', fontSize: 12, borderRadius: 7, padding: '5px 12px', fontFamily: 'Inter, sans-serif' }}
              onClick={() => { setTrendingLoad(true); fetchTrending(15).then(t => { setTrending(t); setTrendingLoad(false); }); }}>↻ refresh</button>}
          />
          <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto' as const, padding: '6px 0', minHeight: 0 }}>
            {trendingLoad ? <Empty icon="◈" msg="Loading..." />
              : trending.length === 0 ? <Empty icon="◈" msg="No trending yet" hint="⚡ react to messages to start trending" />
              : trending.map((msg, i) => <MsgRow key={msg.id} msg={msg} rank={i} showReact />)}
          </div>
        </PanelWrap>

        {/* ── DMs ─────────────────────────────────────────────────────────── */}
        <PanelWrap show={panel === 'dms'}>
          <Header icon="💬" title="Direct Messages" sub="private · encrypted threads" />
          <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto' as const, padding: '12px 14px', display: 'flex', flexDirection: 'column' as const, gap: 8, minHeight: 0 }}>
            {!myWallet ? <Empty icon="💬" msg="Connect wallet" hint="to access your direct messages" />
              : dmThreads.length === 0 ? <Empty icon="⟁" msg="No threads yet" hint="Go to any profile and hit Direct Message" />
              : dmThreads.map(t => {
                  const other = otherW(t); const name = dmNames[t.id] ?? shortW(other);
                  return (
                    <div key={t.id} className="cl-dm-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: '#16161a', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12 }} onClick={() => navigate(`/dm?dm=${other}`)}>
                      <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1D9E75', fontFamily: 'Inter, sans-serif' }}>{name.slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#eef2f7', marginBottom: 2, fontFamily: 'Inter, sans-serif' }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#334155', fontFamily: 'Inter, sans-serif' }}>private · encrypted · {shortW(other)}</div>
                      </div>
                      <span style={{ color: '#334155', fontSize: 16 }}>›</span>
                    </div>
                  );
                })}
          </div>
        </PanelWrap>

        {/* ── NOTIFICATIONS ───────────────────────────────────────────────── */}
        <PanelWrap show={panel === 'notifications'}>
          <Header icon="🔔" title="Notifications" sub="@mentions · signals" />
          <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto' as const, padding: '12px 14px', display: 'flex', flexDirection: 'column' as const, gap: 8, minHeight: 0 }}>
            {!myWallet ? <Empty icon="🔔" msg="Connect wallet" hint="to see your notifications" />
              : notifLoad ? <Empty icon="🔔" msg="Loading..." />
              : notifications.length === 0 ? <Empty icon="🔔" msg="No notifications yet" hint="You'll see @mentions here" />
              : notifications.map(n => (
                  <div key={n.id} className="cl-fadein cl-dm-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px', background: n.read ? '#16161a' : 'rgba(29,158,117,0.05)', border: `0.5px solid ${n.read ? 'rgba(255,255,255,0.06)' : 'rgba(29,158,117,0.2)'}`, borderRadius: 12 }} onClick={() => navigate('/')}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: n.read ? 'transparent' : '#1D9E75' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, fontFamily: 'Inter, sans-serif' }}>
                        <span style={{ color: '#1D9E75', fontWeight: 600 }}>@{n.sender_name}</span>
                        <span style={{ color: '#475569' }}>mentioned you</span>
                        <span style={{ color: '#334155', marginLeft: 'auto', fontSize: 11 }}>{timeAgo(n.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55, wordBreak: 'break-word' as const, fontFamily: 'Inter, sans-serif' }}>{n.message_preview}</div>
                    </div>
                  </div>
                ))}
          </div>
        </PanelWrap>

      </div>

      {activeMint && <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />}
    </div>
  );
}

const badgeSt: React.CSSProperties = {
  background: 'rgba(29,158,117,0.1)', color: '#1D9E75',
  border: '0.5px solid rgba(29,158,117,0.25)', borderRadius: 20,
  fontSize: 10, fontWeight: 600, padding: '1px 7px', marginLeft: 'auto',
  fontFamily: 'Inter, sans-serif',
};
