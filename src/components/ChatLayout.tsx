import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';
import { DAILY_FREE_MESSAGE_LIMIT, fetchDailyMessageCount, sendPaidMessage } from '../services/sendMessage';
import { getMyThreads } from '../services/dmService';
import { fetchNotifications, fetchUnreadCount, markAllRead } from '../services/notificationService';
import { fetchReactions, fetchTrending, sendReaction } from '../services/reactionService';
import SwapDrawer from './SwapDrawer';
import { MINT_REGEX, TICKER_REGEX } from '../utils/tokenDetector';

type Panel = 'chat' | 'trending' | 'dms' | 'notifications';

interface Message {
  id: string;
  username: string;
  wallet_address?: string;
  user_id?: string;
  sender_wallet?: string;
  text: string;
  created_at: string;
  reply_to_id?: string | null;
  reply_preview?: { username: string; text: string } | null;
  reactionCount?: number;
}

interface DMThread {
  id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
}

const LIMIT = 40;
const usernameCache: Record<string, string> = {};
const walletRe = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const shortW = (w?: string) => (w ? `${w.slice(0, 4)}...${w.slice(-4)}` : 'unknown');
const msgWallet = (m: Partial<Message> | any) => m?.wallet_address || m?.sender_wallet || m?.user_id || m?.wallet || '';
const normalizeToken = (value?: string) => (value || '').replace(/\.{3}|…|â€¦/g, '').toLowerCase();
const isFallbackName = (name?: string) => {
  const n = (name || '').trim();
  return !n || n === 'guest' || n.includes('...') || n.includes('…') || walletRe.test(n);
};

async function resolveUsername(wallet: string) {
  if (!wallet) return 'unknown';
  const key = wallet.toLowerCase();
  if (usernameCache[wallet]) return usernameCache[wallet];
  if (usernameCache[key]) return usernameCache[key];

  const { data } = await supabase
    .from('usernames')
    .select('wallet_address, username')
    .ilike('wallet_address', wallet)
    .maybeSingle();

  const name = data?.username || shortW(wallet);
  usernameCache[wallet] = name;
  usernameCache[key] = name;
  if (data?.wallet_address) usernameCache[data.wallet_address] = name;
  return name;
}

async function resolveShortNameToken(name: string) {
  const key = `name:${name.toLowerCase()}`;
  if (usernameCache[key]) return usernameCache[key];

  const { data: exact } = await supabase
    .from('usernames')
    .select('username')
    .ilike('username', name)
    .maybeSingle();

  if (exact?.username) {
    usernameCache[key] = exact.username;
    return exact.username;
  }

  if (!name.includes('...') && !name.includes('…') && !name.includes('â€¦')) return name;

  const compact = normalizeToken(name);
  const { data: candidates } = await supabase
    .from('usernames')
    .select('wallet_address, username')
    .limit(500);

  const match = candidates?.find((u: any) => {
    const username = normalizeToken(u.username);
    const wallet = normalizeToken(u.wallet_address);
    return (username.startsWith(compact.slice(0, 4)) && username.endsWith(compact.slice(-4))) ||
      (wallet.startsWith(compact.slice(0, 4)) && wallet.endsWith(compact.slice(-4)));
  });

  const resolved = match?.username || name;
  usernameCache[key] = resolved;
  return resolved;
}

async function resolveMany(rows: Message[]) {
  const names: Record<string, string> = {};
  await Promise.all(rows.map(async row => {
    if (!isFallbackName(row.username)) {
      names[row.id] = row.username;
      return;
    }
    const wallet = msgWallet(row);
    names[row.id] = wallet ? await resolveUsername(wallet) : await resolveShortNameToken(row.username);
  }));
  return names;
}

const T = {
  bg: '#08090b',
  panel: '#101114',
  panel2: '#15161a',
  line: 'rgba(255,255,255,0.075)',
  text: '#e7edf4',
  dim: '#8491a3',
  faint: '#4b5565',
  green: '#1D9E75',
};

const CSS = `
  .cl, .cl * { box-sizing: border-box; }
  .cl { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .cl-scroll::-webkit-scrollbar { width: 4px; }
  .cl-scroll::-webkit-scrollbar-track { background: transparent; }
  .cl-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.10); border-radius: 10px; }
  .cl-row { display:flex; gap:10px; padding:11px 12px; margin:2px 8px; background:#121318; border:1px solid rgba(255,255,255,.065); border-radius:8px; }
  .cl-row:hover { background:#171920; }
  .cl-nav { display:flex; align-items:center; gap:10px; margin:1px 8px; padding:9px 10px; border-radius:7px; color:#778397; font-size:13px; cursor:pointer; user-select:none; border-left:2px solid transparent; }
  .cl-nav:hover { background:rgba(255,255,255,.045); color:#e7edf4; }
  .cl-nav.active { background:rgba(29,158,117,.09); color:#e7edf4; border-left-color:#1D9E75; }
  .cl-dm-row { cursor:pointer; transition:background .12s; }
  .cl-dm-row:hover { background:rgba(255,255,255,.045) !important; }
  .cl-un { cursor:pointer; transition:color .12s; }
  .cl-un:hover { color:#1D9E75 !important; }
  .cl-btn { border:1px solid rgba(255,255,255,.09); background:transparent; color:#7f8da1; border-radius:999px; height:26px; padding:0 10px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
  .cl-btn:hover:not(:disabled) { color:#e7edf4; border-color:rgba(255,255,255,.16); }
  .cl-btn:disabled { opacity:.55; cursor:default; }
  .token-chip { display:inline-block; margin:0 2px; padding:1px 7px; border-radius:999px; border:1px solid rgba(29,158,117,.35); background:rgba(29,158,117,.10); color:#36c497; font-size:12px; font-weight:650; cursor:pointer; }
  .cl-inp::placeholder { color:#566174; }
  @keyframes scPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  .cl-live { animation: scPulse 2.2s ease infinite; }
`;

function PanelWrap({ show, children }: { show: boolean; children: ReactNode }) {
  return <div style={{ display: show ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>{children}</div>;
}

function Badge({ children }: { children: ReactNode }) {
  return <span style={{ marginLeft: 'auto', minWidth: 18, padding: '1px 6px', borderRadius: 999, background: 'rgba(29,158,117,.12)', color: T.green, border: '1px solid rgba(29,158,117,.25)', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{children}</span>;
}

export default function ChatLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const wallet = useWallet();
  const { connection } = useConnection();
  const myWallet = wallet.publicKey?.toBase58() ?? '';

  const panelFromPath = useCallback((): Panel => {
    if (location.pathname.includes('trending')) return 'trending';
    if (location.pathname.includes('notifications')) return 'notifications';
    if (location.pathname.includes('dm')) return 'dms';
    return 'chat';
  }, [location.pathname]);

  const [panel, setPanel] = useState<Panel>(panelFromPath);
  const [messages, setMessages] = useState<Message[]>([]);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [newMessage, setNewMessage] = useState('');
  const [profileName, setProfileName] = useState('guest');
  const [loading, setLoading] = useState(false);
  const [oldestDate, setOldestDate] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactions, setReactions] = useState<Record<string, any>>({});
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [trending, setTrending] = useState<Message[]>([]);
  const [trendingLoad, setTrendingLoad] = useState(false);
  const [dmThreads, setDmThreads] = useState<DMThread[]>([]);
  const [dmNames, setDmNames] = useState<Record<string, string>>({});
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoad, setNotifLoad] = useState(false);
  const [freeUsed, setFreeUsed] = useState(0);
  const [nameClaiming, setNameClaiming] = useState(false);
  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);

  const freeLeft = Math.max(0, DAILY_FREE_MESSAGE_LIMIT - freeUsed);

  useEffect(() => {
    if (!document.getElementById('cl-css')) {
      const s = document.createElement('style');
      s.id = 'cl-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    setPanel(panelFromPath());
  }, [panelFromPath]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && panel === 'chat') requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages.length, panel]);

  const mergeNames = useCallback(async (rows: Message[]) => {
    const names = await resolveMany(rows);
    setDisplayNames(prev => ({ ...prev, ...names }));
  }, []);

  useEffect(() => {
    if (!myWallet) {
      setProfileName('guest');
      setFreeUsed(0);
      return;
    }

    supabase
      .from('usernames')
      .select('wallet_address, username')
      .ilike('wallet_address', myWallet)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.username || localStorage.getItem('solchat_name') || 'guest';
        setProfileName(name);
        if (data?.username) {
          localStorage.setItem('solchat_name', data.username);
          usernameCache[myWallet] = data.username;
          usernameCache[myWallet.toLowerCase()] = data.username;
        }
      });

    fetchDailyMessageCount(myWallet).then(setFreeUsed).catch(console.warn);
  }, [myWallet]);

  useEffect(() => {
    if (!myWallet) return;
    getMyThreads(myWallet).then(async raw => {
      const threads = (raw ?? []) as DMThread[];
      setDmThreads(threads);
      const names: Record<string, string> = {};
      await Promise.all(threads.map(async t => {
        const other = t.participant_a === myWallet ? t.participant_b : t.participant_a;
        names[t.id] = await resolveUsername(other);
      }));
      setDmNames(names);
    }).catch(console.warn);
  }, [myWallet]);

  useEffect(() => {
    if (!myWallet) return;
    fetchUnreadCount(myWallet).then(setNotifCount).catch(console.warn);
    const ch = supabase.channel('notif-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${myWallet}` }, () => setNotifCount(n => n + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myWallet]);

  const fetchLatest = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (error) {
      console.warn(error);
      return;
    }

    const rows = ((data ?? []) as Message[]).reverse();
    setMessages(rows);
    setOldestDate(rows[0]?.created_at ?? null);
    mergeNames(rows);
    fetchReactions(rows.map(m => m.id), myWallet).then(setReactions).catch(console.warn);

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 80);
    }
  }, [mergeNames, myWallet]);

  useEffect(() => {
    fetchLatest();
    const ch = supabase.channel('msgs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Message;
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg].slice(-90));
        mergeNames([msg]);
        fetchReactions([msg.id], myWallet).then(r => setReactions(prev => ({ ...prev, ...r }))).catch(console.warn);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [fetchLatest, mergeNames, myWallet]);

  useEffect(() => {
    const ch = supabase.channel('react-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new as any;
        setReactions(prev => {
          const cur = prev[r.message_id] ?? { signal: 0, myReactions: new Set() };
          const mine = cur.myReactions instanceof Set ? cur.myReactions : new Set();
          return {
            ...prev,
            [r.message_id]: {
              signal: r.reaction_type === 'signal' ? cur.signal + 1 : cur.signal,
              myReactions: r.reactor === myWallet ? new Set([...mine, r.reaction_type]) : mine,
            },
          };
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [myWallet]);

  useEffect(() => {
    if (panel !== 'trending') return;
    setTrendingLoad(true);
    fetchTrending(15)
      .then(async rows => {
        setTrending(rows);
        await mergeNames(rows as Message[]);
      })
      .catch(console.warn)
      .finally(() => setTrendingLoad(false));
  }, [mergeNames, panel]);

  useEffect(() => {
    if (panel !== 'notifications' || !myWallet) return;
    setNotifLoad(true);
    fetchNotifications(myWallet)
      .then(setNotifications)
      .catch(console.warn)
      .finally(() => setNotifLoad(false));
    markAllRead(myWallet).then(() => setNotifCount(0)).catch(console.warn);
  }, [panel, myWallet]);

  async function loadOlder() {
    if (!oldestDate) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .lt('created_at', oldestDate)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (!data?.length) return;
    const rows = (data as Message[]).reverse();
    setMessages(prev => [...rows, ...prev]);
    setOldestDate(rows[0]?.created_at ?? oldestDate);
    mergeNames(rows);
    fetchReactions(rows.map(m => m.id), myWallet).then(r => setReactions(prev => ({ ...prev, ...r }))).catch(console.warn);
  }

  async function changeName() {
    if (!myWallet) return alert('Connect wallet first');
    const name = prompt('Enter display name (3-20 letters, numbers, or underscores):')?.trim();
    if (!name || name.length < 3 || name.length > 20 || !/^[a-zA-Z0-9_]+$/.test(name)) {
      return alert('Use 3-20 letters, numbers, or underscores');
    }

    setNameClaiming(true);
    try {
      const { data: existing } = await supabase.from('usernames').select('wallet_address').ilike('username', name).maybeSingle();
      if (existing && existing.wallet_address !== myWallet) return alert(`"${name}" is taken`);
      const { error } = await supabase.from('usernames').upsert({ wallet_address: myWallet, username: name }, { onConflict: 'wallet_address' });
      if (error) throw error;
      setProfileName(name);
      localStorage.setItem('solchat_name', name);
      usernameCache[myWallet] = name;
      usernameCache[myWallet.toLowerCase()] = name;
    } catch (e: any) {
      alert(`Name update failed: ${e.message}`);
    } finally {
      setNameClaiming(false);
    }
  }

  async function handleSend() {
    if (!newMessage.trim()) return;
    if (!myWallet) return alert('Connect wallet first');
    if (!profileName || profileName === 'guest') return alert('Set username first');
    const text = newMessage;
    const rt = replyTo;
    setLoading(true);
    setNewMessage('');
    setReplyTo(null);

    try {
      await sendPaidMessage(wallet, connection, text, profileName, rt?.id ?? null);
      setFreeUsed(n => n + 1);
      setTimeout(() => inputRef.current?.focus(), 40);
    } catch (e: any) {
      setNewMessage(text);
      setReplyTo(rt);
      alert(`Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleReact(msgId: string) {
    if (!myWallet) return alert('Connect wallet first');
    if (reactingId) return;
    setReactingId(msgId);
    try {
      await sendReaction(msgId, myWallet, 'signal');
    } catch (e: any) {
      alert(`Signal failed: ${e.message}`);
    } finally {
      setReactingId(null);
    }
  }

  const nameFor = useCallback((msg: Message) => displayNames[msg.id] || (!isFallbackName(msg.username) ? msg.username : shortW(msgWallet(msg))), [displayNames]);

  const navItems = useMemo(() => [
    { id: 'chat' as Panel, icon: '△', label: 'Global Feed' },
    { id: 'trending' as Panel, icon: '◇', label: 'Trending' },
    { id: 'dms' as Panel, icon: '□', label: 'Messages', badge: dmThreads.length || undefined },
    { id: 'notifications' as Panel, icon: '●', label: 'Notifications', badge: notifCount || undefined },
  ], [dmThreads.length, notifCount]);

  const goPanel = (next: Panel) => {
    setPanel(next);
    const path = next === 'chat' ? '/' : next === 'dms' ? '/dm' : `/${next}`;
    if (location.pathname !== path) navigate(path);
  };

  const otherW = (t: DMThread) => t.participant_a === myWallet ? t.participant_b : t.participant_a;
  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const renderText = (text = '') => text.split(/(\$[A-Z]{2,10}|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b)/g).map((p, i) => {
    if (MINT_REGEX.test(p)) return <span key={i} className="token-chip" onClick={() => setActiveMint(p)}>{shortW(p)}</span>;
    if (TICKER_REGEX.test(p)) return <span key={i} className="token-chip">{p}</span>;
    return p.split(/(@[a-zA-Z0-9_]{3,20})/g).map((seg, j) => seg.startsWith('@')
      ? <span key={`${i}-${j}`} style={{ color: T.green, fontWeight: 650 }}>{seg}</span>
      : seg
    );
  });

  const Header = ({ icon, title, sub, right }: { icon: string; title: string; sub: string; right?: ReactNode }) => (
    <div style={{ minHeight: 54, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.panel, borderBottom: `1px solid ${T.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: T.green, fontSize: 16 }}>{icon}</span>
        <div>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div style={{ color: T.faint, fontSize: 11, marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
    </div>
  );

  const Empty = ({ icon, msg, hint }: { icon: string; msg: string; hint?: string }) => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: T.dim, padding: 40 }}>
      <div style={{ fontSize: 28, opacity: .18 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{msg}</div>
      {hint && <div style={{ fontSize: 12, color: T.faint, textAlign: 'center' }}>{hint}</div>}
    </div>
  );

  const ReplyQuote = ({ username, text }: { username: string; text: string }) => (
    <div style={{ margin: '5px 0 7px', padding: '6px 9px', borderLeft: `2px solid ${T.green}`, background: 'rgba(29,158,117,.07)', borderRadius: '0 6px 6px 0', overflow: 'hidden' }}>
      <div style={{ color: T.green, fontSize: 11, fontWeight: 700 }}>reply @{username}</div>
      <div style={{ color: '#8291a4', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</div>
    </div>
  );

  const MsgActions = ({ msg, showReact }: { msg: Message; showReact?: boolean }) => {
    const rc = reactions[msg.id];
    const sigN = msg.reactionCount ?? rc?.signal ?? 0;
    const mine = rc?.myReactions instanceof Set ? rc.myReactions.has('signal') : false;

    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {showReact && myWallet && (
          <button className="cl-btn" disabled={mine || reactingId === msg.id} onClick={() => handleReact(msg.id)} title="Signal">
            <span style={{ color: mine ? T.green : '#e1b84b' }}>bolt</span>{sigN > 0 && <span>{sigN}</span>}
          </button>
        )}
        <button className="cl-btn" onClick={() => { setReplyTo(msg); setTimeout(() => inputRef.current?.focus(), 30); }}>reply</button>
      </div>
    );
  };

  const MsgRow = ({ msg, rank, showReact }: { msg: Message; rank?: number; showReact?: boolean }) => {
    const displayName = nameFor(msg);
    const profileTarget = isFallbackName(displayName) ? (msgWallet(msg) || displayName) : displayName;
    const isAI = displayName === 'AI';
    const isMe = (!!myWallet && msgWallet(msg) === myWallet) || displayName === profileName;

    return (
      <div className="cl-row">
        {rank !== undefined && <div style={{ width: 22, paddingTop: 2, color: rank < 3 ? T.green : T.faint, fontSize: 11, fontWeight: 800 }}>#{rank + 1}</div>}
        <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMe ? 'rgba(29,158,117,.13)' : 'rgba(255,255,255,.045)', border: `1px solid ${isMe ? 'rgba(29,158,117,.28)' : T.line}`, color: isMe ? T.green : '#9aa6b8', fontSize: 11, fontWeight: 800 }}>
          {isAI ? 'AI' : displayName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="cl-un" onClick={() => navigate(`/profile/${encodeURIComponent(profileTarget)}`)} style={{ color: isMe ? T.green : '#cbd7e6', fontSize: 13, fontWeight: 750 }}>{isAI ? 'SolChat AI' : displayName}</span>
            <span style={{ color: T.faint, fontSize: 11 }}>{timeAgo(msg.created_at)}</span>
            {rank !== undefined && <Badge>{msg.reactionCount ?? 0}</Badge>}
          </div>
          {msg.reply_preview && <ReplyQuote username={msg.reply_preview.username} text={msg.reply_preview.text || ''} />}
          <div style={{ color: T.text, fontSize: 14, lineHeight: 1.55, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderText(msg.text)}</div>
          <MsgActions msg={msg} showReact={showReact} />
        </div>
      </div>
    );
  };

  const ClusteredRow = ({ msg, showReact }: { msg: Message; showReact?: boolean }) => {
    const displayName = nameFor(msg);
    return (
      <div className="cl-row" style={{ padding: '7px 12px 8px 56px', borderRadius: 7 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.dim, fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{displayName}</div>
          {msg.reply_preview && <ReplyQuote username={msg.reply_preview.username} text={msg.reply_preview.text || ''} />}
          <div style={{ color: '#c8d3df', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderText(msg.text)}</div>
          <MsgActions msg={msg} showReact={showReact} />
        </div>
      </div>
    );
  };

  const renderInputBar = () => (
    <div style={{ padding: isMobile ? '8px 10px' : '9px 12px', background: T.bg, borderTop: `1px solid ${T.line}` }}>
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: T.dim, fontSize: 12 }}>
          <span style={{ color: T.green }}>replying to @{nameFor(replyTo)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.text}</span>
          <button onClick={() => setReplyTo(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: T.dim, cursor: 'pointer' }}>x</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#111217', border: `1px solid ${T.line}`, borderRadius: 9, padding: '8px 9px' }}>
        <input
          ref={inputRef}
          className="cl-inp"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !loading) handleSend(); }}
          placeholder={!myWallet ? 'Connect wallet to post' : profileName === 'guest' ? 'Set a username first (click Edit)' : `Signal the market... ${freeLeft}/${DAILY_FREE_MESSAGE_LIMIT} free today`}
          style={{ flex: 1, minWidth: 0, height: 28, background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: 14 }}
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim() || loading || !myWallet || profileName === 'guest'}
          style={{ width: 32, height: 32, border: 'none', borderRadius: 7, background: (newMessage.trim() && !loading && myWallet && profileName !== 'guest') ? T.green : 'rgba(255,255,255,.055)', color: (newMessage.trim() && !loading && myWallet && profileName !== 'guest') ? '#fff' : T.faint, cursor: (newMessage.trim() && !loading && myWallet && profileName !== 'guest') ? 'pointer' : 'default', fontSize: 15 }}
        >
          →
        </button>
      </div>
    </div>
  );

  const nav = (
    <>
      {navItems.map(it => (
        <div key={it.id} className={`cl-nav${panel === it.id ? ' active' : ''}`} onClick={() => goPanel(it.id)}>
          <span style={{ width: 18, textAlign: 'center' }}>{it.icon}</span>
          <span>{it.label}</span>
          {!!it.badge && <Badge>{it.badge}</Badge>}
        </div>
      ))}
      <div className="cl-nav" onClick={() => navigate('/discover')}><span style={{ width: 18, textAlign: 'center' }}>○</span><span>Discover</span></div>
      {myWallet && profileName !== 'guest' && <div className="cl-nav" onClick={() => navigate(`/profile/${encodeURIComponent(profileName)}`)}><span style={{ width: 18, textAlign: 'center' }}>◉</span><span>My Profile</span></div>}
    </>
  );

  const rootStyle: CSSProperties = {
    display: 'flex',
    width: '100%',
    height: 'calc(100vh - 52px)',
    maxHeight: 'calc(100vh - 52px)',
    background: T.bg,
    color: T.text,
    overflow: 'hidden',
  };

  return (
    <div className="cl" style={rootStyle}>
      {!isMobile && (
        <aside style={{ width: 264, flexShrink: 0, background: '#0c0d10', borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 14px', borderBottom: `1px solid ${T.line}` }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(29,158,117,.28)', background: 'rgba(29,158,117,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green }}>△</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 850, letterSpacing: 1.2 }}>SOLCHAT</div>
              <div style={{ fontSize: 10, color: T.faint }}>social trading layer</div>
            </div>
          </div>
          <div style={{ padding: '8px 0', borderBottom: `1px solid ${T.line}` }}>
            <div style={{ color: T.faint, fontSize: 9, letterSpacing: 2, padding: '7px 16px 5px', textTransform: 'uppercase', fontWeight: 800 }}>Navigate</div>
            {nav}
          </div>
          {dmThreads.length > 0 && (
            <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 6 }}>
              <div style={{ color: T.faint, fontSize: 9, letterSpacing: 2, padding: '7px 16px 5px', textTransform: 'uppercase', fontWeight: 800 }}>Messages</div>
              {dmThreads.slice(0, 8).map(t => {
                const other = otherW(t);
                const name = dmNames[t.id] ?? shortW(other);
                return (
                  <div key={t.id} className="cl-dm-row" onClick={() => navigate(`/dm?dm=${other}`)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,.045)', border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa6b8', fontSize: 10, fontWeight: 800 }}>{name.slice(0, 2).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#d8e1ec', fontSize: 12, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ color: T.faint, fontSize: 10 }}>encrypted</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ borderTop: `1px solid ${T.line}`, padding: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: 'rgba(29,158,117,.10)', border: '1px solid rgba(29,158,117,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, fontWeight: 850, fontSize: 11 }}>{profileName === 'guest' ? '?' : profileName.slice(0, 2).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileName}</div>
              <div style={{ fontSize: 10, color: T.faint }}>{myWallet ? `${freeLeft}/${DAILY_FREE_MESSAGE_LIMIT} free left` : 'not connected'}</div>
            </div>
            <button onClick={changeName} disabled={nameClaiming} title="Change username" style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.line}`, background: 'rgba(255,255,255,.035)', color: T.dim, cursor: 'pointer' }}>edit</button>
          </div>
        </aside>
      )}

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: isMobile ? 58 : 0 }}>
        <PanelWrap show={panel === 'chat'}>
          <Header icon="△" title="Global Signal" sub={`public · free ${DAILY_FREE_MESSAGE_LIMIT}/day per wallet`} right={<><span className="cl-live" style={{ width: 7, height: 7, borderRadius: 99, background: T.green }} />{profileName !== 'guest' && <span className="cl-un" onClick={() => navigate(`/profile/${encodeURIComponent(profileName)}`)} style={{ color: T.dim, fontSize: 12 }}>@{profileName}</span>}</>} />
          <div ref={scrollRef} className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 0', minHeight: 0 }}>
            {oldestDate && <div onClick={loadOlder} style={{ color: T.faint, textAlign: 'center', fontSize: 11, padding: 8, cursor: 'pointer' }}>load older</div>}
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const clustered = !!prev && ((msgWallet(prev) && msgWallet(prev) === msgWallet(msg)) || nameFor(prev) === nameFor(msg));
              return clustered ? <ClusteredRow key={msg.id} msg={msg} showReact /> : <MsgRow key={msg.id} msg={msg} showReact />;
            })}
            <div style={{ height: 8 }} />
          </div>
          {renderInputBar()}
        </PanelWrap>

        <PanelWrap show={panel === 'trending'}>
          <Header icon="◇" title="Trending Signals" sub="most signaled · last 24h" right={<button className="cl-btn" onClick={() => { setTrendingLoad(true); fetchTrending(15).then(rows => { setTrending(rows); mergeNames(rows as Message[]); }).finally(() => setTrendingLoad(false)); }}>refresh</button>} />
          <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {trendingLoad ? <Empty icon="◇" msg="Loading..." /> : trending.length === 0 ? <Empty icon="◇" msg="No trending yet" hint="Signal posts to rank them here." /> : trending.map((msg, i) => <MsgRow key={msg.id} msg={msg} rank={i} showReact />)}
          </div>
        </PanelWrap>

        <PanelWrap show={panel === 'dms'}>
          <Header icon="□" title="Direct Messages" sub="private threads" />
          <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {!myWallet ? <Empty icon="□" msg="Connect wallet" hint="to access your messages" /> : dmThreads.length === 0 ? <Empty icon="□" msg="No threads yet" hint="Open a profile to start a DM." /> : dmThreads.map(t => {
              const other = otherW(t);
              const name = dmNames[t.id] ?? shortW(other);
              return (
                <div key={t.id} className="cl-dm-row" onClick={() => navigate(`/dm?dm=${other}`)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(29,158,117,.10)', border: '1px solid rgba(29,158,117,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, fontSize: 12, fontWeight: 850 }}>{name.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 750 }}>{name}</div>
                    <div style={{ fontSize: 11, color: T.faint }}>{shortW(other)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelWrap>

        <PanelWrap show={panel === 'notifications'}>
          <Header icon="●" title="Notifications" sub="mentions · replies" />
          <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {!myWallet ? <Empty icon="●" msg="Connect wallet" hint="to see notifications" /> : notifLoad ? <Empty icon="●" msg="Loading..." /> : notifications.length === 0 ? <Empty icon="●" msg="No notifications yet" /> : notifications.map(n => (
              <div key={n.id} className="cl-dm-row" onClick={() => goPanel('chat')} style={{ display: 'flex', gap: 10, padding: '11px 12px', background: n.read ? T.panel2 : 'rgba(29,158,117,.08)', border: `1px solid ${n.read ? T.line : 'rgba(29,158,117,.22)'}`, borderRadius: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: 99, background: n.read ? 'transparent' : T.green, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.dim, marginBottom: 4 }}><b style={{ color: T.green }}>@{n.sender_name}</b> {n.type === 'reply' ? 'replied to you' : 'mentioned you'} <span style={{ color: T.faint }}>· {timeAgo(n.created_at)}</span></div>
                  <div style={{ fontSize: 13, color: '#c8d3df', lineHeight: 1.45 }}>{n.message_preview}</div>
                </div>
              </div>
            ))}
          </div>
        </PanelWrap>
      </main>

      {isMobile && <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 58, zIndex: 20, background: '#0c0d10', borderTop: `1px solid ${T.line}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>{navItems.map(it => <button key={it.id} onClick={() => goPanel(it.id)} style={{ border: 0, background: 'transparent', color: panel === it.id ? T.green : T.dim, fontSize: 11 }}>{it.label}</button>)}</nav>}
      {activeMint && <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />}
    </div>
  );
}
