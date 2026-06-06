import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../lib/supabase';
import { DAILY_FREE_MESSAGE_LIMIT, fetchDailyMessageCount, sendPaidMessage } from '../services/sendMessage';
import { getMyThreads, getThread, openDMThread, sendDM, getThreadMessages, canonicalPair } from '../services/dmService';
import { fetchNotifications, fetchUnreadCount, markAllRead } from '../services/notificationService';
import { fetchReactions, fetchTrending, sendReaction } from '../services/reactionService';
import SwapDrawer from './SwapDrawer';
import { MINT_REGEX, TICKER_REGEX } from '../utils/tokenDetector';
import { getAvatarByUsername } from '../utils/avatarCache';
import '../styles/premium-chat.css';

function getDeterministicLevel(username: string, wallet: string, myWallet: string) {
  if (username === 'AI') return 999;
  if (wallet && myWallet && wallet.toLowerCase() === myWallet.toLowerCase()) {
    return parseInt(localStorage.getItem('solchat_level') || '1');
  }
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1400) + 100;
}

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

interface DMMessage {
  id: string;
  thread_id: string;
  sender: string;
  text: string;
  reply_to_id?: string;
  created_at: string;
}

interface TokenData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  sparkline_in_7d?: { price: number[] };
}

// Sparkline SVG drawing utility
function Sparkline({ prices, positive }: { prices: number[]; positive: boolean }) {
  if (!prices || prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 60;
  const height = 24;
  
  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', marginLeft: 8, marginRight: 8 }}>
      <polyline
        fill="none"
        stroke={positive ? '#00ba7c' : '#f4212e'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

// Generate static fallback top 100 tokens with prices and mock sparklines
const TOP_100_FALLBACKS: TokenData[] = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: '', current_price: 68500, price_change_percentage_24h: 2.5 },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: '', current_price: 3850, price_change_percentage_24h: 1.8 },
  { id: 'solana', symbol: 'sol', name: 'Solana', image: '', current_price: 148.25, price_change_percentage_24h: 3.12 },
  { id: 'jupiter-exchange-solana', symbol: 'jup', name: 'Jupiter', image: '', current_price: 1.12, price_change_percentage_24h: -1.48 },
  { id: 'pyth-network', symbol: 'pyth', name: 'Pyth Network', image: '', current_price: 0.385, price_change_percentage_24h: 0.85 },
  { id: 'ripple', symbol: 'xrp', name: 'Ripple', image: '', current_price: 0.52, price_change_percentage_24h: -0.4 },
  { id: 'cardano', symbol: 'ada', name: 'Cardano', image: '', current_price: 0.45, price_change_percentage_24h: 1.2 },
  { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin', image: '', current_price: 0.14, price_change_percentage_24h: 8.5 },
  { id: 'shiba-inu', symbol: 'shib', name: 'Shiba Inu', image: '', current_price: 0.000022, price_change_percentage_24h: -3.2 },
  { id: 'avalanche-2', symbol: 'avax', name: 'Avalanche', image: '', current_price: 36.4, price_change_percentage_24h: 0.9 },
  { id: 'chainlink', symbol: 'link', name: 'Chainlink', image: '', current_price: 17.5, price_change_percentage_24h: 4.6 },
  { id: 'near', symbol: 'near', name: 'NEAR Protocol', image: '', current_price: 6.8, price_change_percentage_24h: 5.1 },
  { id: 'polkadot', symbol: 'dot', name: 'Polkadot', image: '', current_price: 6.2, price_change_percentage_24h: -0.8 },
  { id: 'render-token', symbol: 'rndr', name: 'Render', image: '', current_price: 8.4, price_change_percentage_24h: 9.3 },
  { id: 'pepe', symbol: 'pepe', name: 'Pepe', image: '', current_price: 0.000012, price_change_percentage_24h: 14.2 },
];

function getFallbackTop100(): TokenData[] {
  const result = [...TOP_100_FALLBACKS];
  const count = result.length;
  for (let i = count; i < 100; i++) {
    const symbol = `tok${i}`;
    const name = `Token #${i}`;
    result.push({
      id: name.toLowerCase().replace(' ', '-'),
      symbol,
      name,
      image: '',
      current_price: parseFloat((Math.random() * 250 + 0.1).toFixed(2)),
      price_change_percentage_24h: parseFloat((Math.random() * 20 - 10).toFixed(2)),
    });
  }
  return result.map(t => {
    const prices = [];
    let curr = t.current_price;
    for (let j = 0; j < 30; j++) {
      curr = curr * (1 + (Math.random() * 0.08 - 0.04));
      prices.push(curr);
    }
    return {
      ...t,
      sparkline_in_7d: { price: prices }
    };
  });
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
  
  // ── DM Integrated States ──
  const activeDmWallet = useMemo(() => {
    return new URLSearchParams(location.search).get('dm') || '';
  }, [location.search]);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [activeThread, setActiveThread] = useState<DMThread | null>(null);
  const [threadExists, setThreadExists] = useState(false);
  const [loadingOpenThread, setLoadingOpenThread] = useState(false);
  const [sendingDM, setSendingDM] = useState(false);
  const [dmReplyTo, setDmReplyTo] = useState<DMMessage | null>(null);
  const [dmText, setDmText] = useState('');
  const dmBottomRef = useRef<HTMLDivElement>(null);
  const dmChannelRef = useRef<any>(null);

  // ── Top 100 Token States ──
  const [top100, setTop100] = useState<TokenData[]>([]);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [selectedTokenForChart, setSelectedTokenForChart] = useState<TokenData | null>(null);

  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoad, setNotifLoad] = useState(false);
  const [freeUsed, setFreeUsed] = useState(0);
  const [nameClaiming, setNameClaiming] = useState(false);
  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [whoToFollow, setWhoToFollow] = useState<any[]>([]);

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

  // Track previous wallet so we can clean up when it switches
  const prevWalletRef = useRef('');

  useEffect(() => {
    const prevWallet = prevWalletRef.current;

    // ── Wallet disconnected or changed ──────────────────────────
    if (!myWallet) {
      // Evict old wallet's in-memory cache entry so it can't bleed
      if (prevWallet) {
        delete usernameCache[prevWallet];
        delete usernameCache[prevWallet.toLowerCase()];
      }
      prevWalletRef.current = '';
      setProfileName('guest');
      setFreeUsed(0);
      return;
    }

    // ── Wallet actually switched to a different account ──────────
    if (prevWallet && prevWallet !== myWallet) {
      // Immediately reset to 'guest' — do NOT read old localStorage
      setProfileName('guest');
      // Evict old wallet's cache so its name isn't returned for new wallet
      delete usernameCache[prevWallet];
      delete usernameCache[prevWallet.toLowerCase()];
    }

    prevWalletRef.current = myWallet;

    // Use wallet-scoped localStorage key so names never bleed across accounts
    const walletKey = `solchat_name_${myWallet}`;

    supabase
      .from('usernames')
      .select('wallet_address, username')
      .ilike('wallet_address', myWallet)
      .maybeSingle()
      .then(({ data }) => {
        // DB is authoritative; only fall back to the WALLET-SCOPED local key
        const name = data?.username || localStorage.getItem(walletKey) || 'guest';
        setProfileName(name);
        if (data?.username) {
          localStorage.setItem(walletKey, data.username);
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

  // ── Fetch Real Users for "Who to follow" ──
  useEffect(() => {
    const fetchFollows = async () => {
      try {
        const { data, error } = await supabase
          .from('usernames')
          .select('wallet_address, username')
          .limit(40);
        if (error) throw error;
        
        let list = (data ?? []) as any[];
        if (list.length < 3) {
          const { data: msgSenders } = await supabase
            .from('messages')
            .select('username, wallet_address')
            .limit(100);
          if (msgSenders) {
            const seen = new Set();
            msgSenders.forEach((m: any) => {
              const walletAddr = msgWallet(m);
              if (walletAddr && !seen.has(walletAddr)) {
                seen.add(walletAddr);
                if (list.findIndex(u => u.wallet_address === walletAddr) === -1) {
                  list.push({ wallet_address: walletAddr, username: m.username });
                }
              }
            });
          }
        }
        
        // Filter out ourselves and guests
        const others = list.filter((u: any) => u.wallet_address !== myWallet && u.username !== 'guest');
        
        // Shuffle randomly
        const shuffled = others.sort(() => 0.5 - Math.random());
        setWhoToFollow(shuffled.slice(0, 3));
      } catch (e) {
        console.warn('Failed to load Who to Follow:', e);
      }
    };
    fetchFollows();
  }, [myWallet]);

  // ── Fetch Top 100 Token Prices ──
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true');
        if (!res.ok) throw new Error(`CoinGecko HTTP error: ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTop100(data as TokenData[]);
          return;
        }
        throw new Error('CoinGecko returned invalid data format');
      } catch (err) {
        console.warn("CoinGecko API rate limit or error, using mock top 100 fallbacks:", err);
        setTop100(getFallbackTop100());
      }
    };
    fetchTokens();
    const interval = setInterval(fetchTokens, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // ── Integrated DM Thread Lifecycle & Subscriptions ──
  useEffect(() => {
    if (!myWallet) return;
    if (activeDmWallet && activeDmWallet !== myWallet) {
      getThread(myWallet, activeDmWallet).then(t => {
        setThreadExists(!!t);
        if (t) {
          setActiveThread(t as DMThread);
        } else {
          setActiveThread(null);
        }
      });
    } else {
      setActiveThread(null);
      setThreadExists(false);
      setDmMessages([]);
    }
  }, [myWallet, activeDmWallet]);

  useEffect(() => {
    if (!activeThread) {
      setDmMessages([]);
      return;
    }
    
    getThreadMessages(activeThread.id).then(msgs => {
      setDmMessages(msgs as DMMessage[]);
      setTimeout(() => dmBottomRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
    });

    if (dmChannelRef.current) {
      supabase.removeChannel(dmChannelRef.current);
      dmChannelRef.current = null;
    }

    const channel = supabase
      .channel(`dm-${activeThread.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `thread_id=eq.${activeThread.id}`,
      }, (payload) => {
        const incoming = payload.new as DMMessage;
        setDmMessages(prev => {
          if (prev.find(m => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        setTimeout(() => dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      })
      .subscribe();

    dmChannelRef.current = channel;
    return () => {
      if (dmChannelRef.current) {
        supabase.removeChannel(dmChannelRef.current);
        dmChannelRef.current = null;
      }
    };
  }, [activeThread?.id]);

  // ── Handlers for Integrated DMs ──
  const handleOpenDMThread = useCallback(async () => {
    if (!activeDmWallet || !myWallet || loadingOpenThread) return;
    setLoadingOpenThread(true);
    try {
      const target = new PublicKey(activeDmWallet);
      if (target.toBase58() === myWallet) {
        alert("You cannot DM yourself");
        return;
      }
      const threadId = await openDMThread(myWallet, target.toBase58(), wallet.sendTransaction as any);
      const [a, b] = canonicalPair(myWallet, target.toBase58());
      const newThread = { id: threadId, participant_a: a, participant_b: b, created_at: new Date().toISOString() };
      setDmThreads(prev => [newThread, ...prev]);
      setActiveThread(newThread);
      setThreadExists(true);
    } catch (e: any) {
      console.error(e);
      alert('Failed: ' + (e.message || 'Invalid wallet'));
    } finally {
      setLoadingOpenThread(false);
    }
  }, [activeDmWallet, myWallet, loadingOpenThread, wallet.sendTransaction]);

  const handleSendDM = useCallback(async () => {
    const trimmed = dmText.trim();
    if (!trimmed || !activeThread || !myWallet || sendingDM) return;
    setSendingDM(true);
    setDmText('');
    const currentReplyTo = dmReplyTo;
    setDmReplyTo(null);
    try {
      const insertPayload: any = {
        thread_id: activeThread.id,
        sender: myWallet,
        text: trimmed,
      };
      if (currentReplyTo) insertPayload.reply_to_id = currentReplyTo.id;

      const { data, error } = await supabase
        .from('dm_messages')
        .insert(insertPayload)
        .select('*').single();
      if (error) throw error;
      setDmMessages(prev => [...prev, data as DMMessage]);
      setTimeout(() => dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (e: any) {
      setDmText(trimmed);
      setDmReplyTo(currentReplyTo);
      alert('Send failed: ' + (e.message ?? e));
    } finally {
      setSendingDM(false);
    }
  }, [dmText, activeThread, myWallet, sendingDM, dmReplyTo]);

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
    if (!wallet.signMessage) {
      return alert('Your wallet does not support message signing.');
    }
    const name = prompt('Enter display name (3-20 letters, numbers, or underscores):')?.trim();
    if (!name || name.length < 3 || name.length > 20 || !/^[a-zA-Z0-9_]+$/.test(name)) {
      return alert('Use 3-20 letters, numbers, or underscores');
    }

    setNameClaiming(true);
    try {
      const { default: bs58 } = await import('bs58');
      const message = `Claim username "${name}" for wallet ${myWallet}`;
      const encodedMsg = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(encodedMsg);
      const signature = bs58.encode(signatureBytes);

      const res = await fetch('/api/claim-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: myWallet, username: name, signature })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim username');
      }

      setProfileName(name);
      // Use wallet-scoped key so saving one wallet's name never bleeds to another
      localStorage.setItem(`solchat_name_${myWallet}`, name);
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
          <button className="cl-btn" disabled={mine || reactingId === msg.id} onClick={() => handleReact(msg.id)} title="Like">
            <span style={{ color: mine ? T.green : '#e1b84b' }}>like</span>{sigN > 0 && <span>{sigN}</span>}
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
    const rankClass = rank === 0 ? 'cl-rank-gold' : rank === 1 ? 'cl-rank-silver' : rank === 2 ? 'cl-rank-bronze' : '';

    const level = useMemo(() => {
      return getDeterministicLevel(displayName, msgWallet(msg), myWallet);
    }, [displayName, msg, myWallet]);

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    useEffect(() => {
      getAvatarByUsername(displayName).then(setAvatarUrl).catch(() => {});
    }, [displayName]);

    return (
      <div className="cl-message-card">
        {rank !== undefined && (
          <div className={`cl-trending-rank ${rankClass}`}>
            #{rank + 1}
          </div>
        )}
        <div className="avatar-wrapper" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${encodeURIComponent(profileTarget)}`)}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="cl-user-avatar-img" />
          ) : (
            <div className={`cl-user-avatar-circle ${isAI ? 'ai' : isMe ? 'me' : 'other'}`}>
              {isAI ? 'AI' : displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="cl-level-badge">{level}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cl-meta-line">
            <span className={`cl-username-text ${isAI ? 'ai' : isMe ? 'me' : ''}`} onClick={() => navigate(`/profile/${encodeURIComponent(profileTarget)}`)}>
              {isAI ? (
                <>
                  🤖 SolChat AI
                  <span className="cl-badge-ai">Agent</span>
                </>
              ) : (
                `@${displayName}`
              )}
            </span>
            <span className="cl-timestamp">{timeAgo(msg.created_at)}</span>
            {rank !== undefined && (
              <span className="token-chip" style={{ border: '1px solid rgba(225, 184, 75, 0.3)', background: 'rgba(225, 184, 75, 0.08)', color: 'var(--chat-gold)' }}>
                🔥 {msg.reactionCount ?? 0} Signals
              </span>
            )}
          </div>
          {msg.reply_preview && <ReplyQuote username={msg.reply_preview.username} text={msg.reply_preview.text || ''} />}
          <div className="cl-message-body-text">{renderText(msg.text)}</div>
          <MsgActions msg={msg} showReact={showReact} />
        </div>
      </div>
    );
  };

  const ClusteredRow = ({ msg, showReact }: { msg: Message; showReact?: boolean }) => {
    return (
      <div className="cl-message-card clustered">
        <div style={{ flex: 1, minWidth: 0 }}>
          {msg.reply_preview && <ReplyQuote username={msg.reply_preview.username} text={msg.reply_preview.text || ''} />}
          <div className="cl-message-body-text" style={{ marginTop: 0 }}>{renderText(msg.text)}</div>
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
        <div key={it.id} className={`cl-nav-link-custom${panel === it.id ? ' active' : ''}`} onClick={() => goPanel(it.id)}>
          <span className="cl-nav-icon">{it.icon}</span>
          <span>{it.label}</span>
          {!!it.badge && <Badge>{it.badge}</Badge>}
        </div>
      ))}
      <div className={`cl-nav-link-custom${location.pathname === '/mine' ? ' active' : ''}`} onClick={() => navigate('/mine')}>
        <span className="cl-nav-icon">⛏️</span>
        <span>Mine App</span>
      </div>
      <div className={`cl-nav-link-custom${location.pathname === '/discover' ? ' active' : ''}`} onClick={() => navigate('/discover')}>
        <span className="cl-nav-icon">○</span>
        <span>Discover</span>
      </div>
      {myWallet && profileName !== 'guest' && (
        <div className={`cl-nav-link-custom${location.pathname.startsWith('/profile') ? ' active' : ''}`} onClick={() => navigate(`/profile/${encodeURIComponent(profileName)}`)}>
          <span className="cl-nav-icon">◉</span>
          <span>My Profile</span>
        </div>
      )}
    </>
  );

  const rootStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    height: 'calc(100vh - 52px)',
    maxHeight: 'calc(100vh - 52px)',
    background: T.bg,
    color: T.text,
    overflow: 'hidden',
    padding: isMobile ? '0' : '16px 0',
  };

  return (
    <div className="cl" style={rootStyle}>
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: isMobile ? '100%' : '1250px',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: isMobile ? '0' : '16px',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: isMobile ? 'none' : 'blur(20px)',
      }}>
      {!isMobile && (
        <aside className="cl-sidebar" style={{ width: 264, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="cl-sidebar-logo-container">
            <img src="/logo.png" alt="" className="cl-logo-badge" style={{ objectFit: 'contain', padding: '2px' }} />
            <div>
              <div className="cl-logo-text">SOLCHAT</div>
              <div className="cl-logo-subtext">social trading layer</div>
            </div>
          </div>
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--chat-border)' }}>
            <div className="cl-nav-section-header">Navigate</div>
            {nav}
          </div>
          {dmThreads.length > 0 && (
            <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: 6 }}>
              <div className="cl-nav-section-header">Messages</div>
              {dmThreads.slice(0, 8).map(t => {
                const other = otherW(t);
                const name = dmNames[t.id] ?? shortW(other);
                return (
                  <div key={t.id} className="cl-dm-row" onClick={() => navigate(`/dm?dm=${other}`)}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(255,255,255,.03)', border: '1px solid var(--chat-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--chat-text-medium)', fontSize: 10, fontWeight: 800 }}>{name.slice(0, 2).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: 'var(--chat-text-medium)', fontSize: 12, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ color: 'var(--chat-text-muted)', fontSize: 10 }}>encrypted</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="cl-sidebar-footer">
            <div className="cl-avatar-footer">{profileName === 'guest' ? '?' : profileName.slice(0, 2).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="cl-user-name-footer">{profileName}</div>
              <div className="cl-user-status-footer">{myWallet ? 'connected' : 'not connected'}</div>
            </div>
            {myWallet && (
              <button onClick={changeName} disabled={nameClaiming} title="Change username" className="cl-edit-btn">Edit</button>
            )}
          </div>
        </aside>
      )}

      <main style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: isMobile ? 58 : 0,
        background: T.panel,
        position: 'relative',
        borderRight: isMobile ? 'none' : `1px solid ${T.line}`,
      }}>
        <PanelWrap show={panel === 'chat'}>
          <Header icon="△" title="Global Signal" sub={`public · free ${DAILY_FREE_MESSAGE_LIMIT}/day per wallet`} right={<><span className="cl-live" style={{ width: 7, height: 7, borderRadius: 99, background: T.green }} />{profileName !== 'guest' && <span className="cl-un" onClick={() => navigate(`/profile/${encodeURIComponent(profileName)}`)} style={{ color: T.dim, fontSize: 12 }}>@{profileName}</span>}</>} />
          <div ref={scrollRef} className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 0', minHeight: 0 }}>
            {oldestDate && <div onClick={loadOlder} style={{ color: T.faint, textAlign: 'center', fontSize: 11, padding: 8, cursor: 'pointer' }}>load older</div>}
            {messages.map((msg) => {
              return <MsgRow key={msg.id} msg={msg} showReact />;
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
          {activeDmWallet ? (
            !threadExists ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Header
                  icon="🔒"
                  title="Direct Message"
                  sub="initialize thread"
                  right={<button className="cl-btn" onClick={() => navigate('/dm')} style={{ fontSize: 11 }}>← Back</button>}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                  <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--chat-text-high)', marginBottom: 8 }}>Open Private Thread</div>
                  <div style={{ fontSize: 13, color: T.dim, marginBottom: 16 }}>with {shortW(activeDmWallet)}</div>
                  <div style={{ fontSize: 12, color: T.faint, marginBottom: 20, lineHeight: 1.45, maxWidth: 380 }}>
                    First message requires paying <span style={{ color: T.green, fontWeight: 700 }}>0.0001 SOL</span> to create the on-chain metadata.<br />
                    The thread is free and end-to-end encrypted forever after.
                  </div>
                  <button
                    className="cl-btn"
                    onClick={handleOpenDMThread}
                    disabled={loadingOpenThread}
                    style={{ background: T.green, color: '#fff', height: 36, padding: '0 20px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  >
                    {loadingOpenThread ? 'OPENING THREAD...' : 'OPEN THREAD · 0.0001 SOL'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <Header
                  icon="🔒"
                  title={activeThread ? (dmNames[activeThread.id] ?? shortW(activeDmWallet)) : shortW(activeDmWallet)}
                  sub="private · end-to-end encrypted"
                  right={<button className="cl-btn" onClick={() => navigate('/dm')} style={{ fontSize: 11 }}>← Back</button>}
                />
                
                {/* Scroll Area */}
                <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: '10px 0 20px 0', borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(29, 158, 117, 0.08)', border: '1px solid rgba(29, 158, 117, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto 8px auto' }}>🔒</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chat-text-high)' }}>
                      {activeThread ? (dmNames[activeThread.id] ?? shortW(activeDmWallet)) : shortW(activeDmWallet)}
                    </div>
                    <div style={{ fontSize: 11, color: T.faint }}>This conversation is private and encrypted.</div>
                  </div>
                  
                  {dmMessages.map((msg, i) => {
                    const isMine = msg.sender === myWallet;
                    const displayName = isMine ? profileName : (activeThread ? (dmNames[activeThread.id] ?? shortW(msg.sender)) : shortW(msg.sender));
                    const showName = true;
                    const parentMsg = msg.reply_to_id ? dmMessages.find(m => m.id === msg.reply_to_id) : null;
                    
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', width: '100%', marginBottom: 8 }}>
                        {showName && (
                          <div style={{ fontSize: 11, color: isMine ? T.green : T.dim, marginBottom: 3, marginLeft: 6, marginRight: 6, fontWeight: 600 }}>
                            @{displayName}
                          </div>
                        )}
                        
                        {parentMsg && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${T.green}`, padding: '4px 8px', borderRadius: 4, marginBottom: 3, maxWidth: '80%', fontSize: 11, color: T.dim }}>
                            <span style={{ fontWeight: 700, color: T.green }}>
                              @{parentMsg.sender === myWallet ? 'you' : (activeThread ? (dmNames[activeThread.id] ?? shortW(parentMsg.sender)) : shortW(parentMsg.sender))}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {parentMsg.text}
                            </span>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                          {!isMine && (
                            <button onClick={() => setDmReplyTo(msg)} style={{ background: 'none', border: 'none', color: T.faint, cursor: 'pointer', fontSize: 10, padding: 2 }} title="Reply">↩</button>
                          )}
                          <div style={{
                            alignSelf: isMine ? 'flex-end' : 'flex-start',
                            background: isMine ? 'rgba(29, 158, 117, 0.14)' : '#16181c',
                            border: '1px solid ' + (isMine ? 'rgba(29, 158, 117, 0.28)' : 'var(--chat-border)'),
                            color: 'var(--chat-text-high)',
                            padding: '8px 13px',
                            borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            wordBreak: 'break-word',
                            fontSize: '13px',
                            lineHeight: 1.4
                          }}>
                            {msg.text}
                          </div>
                          {isMine && (
                            <button onClick={() => setDmReplyTo(msg)} style={{ background: 'none', border: 'none', color: T.faint, cursor: 'pointer', fontSize: 10, padding: 2 }} title="Reply">↩</button>
                          )}
                        </div>
                        <div style={{ fontSize: 9, color: T.faint, marginTop: 2, marginRight: isMine ? 6 : 0, marginLeft: isMine ? 0 : 6 }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={dmBottomRef} style={{ height: 10 }} />
                </div>

                {/* Input Panel */}
                <div style={{ padding: '8px 12px', borderTop: `1px solid ${T.line}`, background: '#08090b' }}>
                  {dmReplyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(29,158,117,0.07)', borderLeft: `2px solid ${T.green}`, padding: '6px 10px', borderRadius: 4, marginBottom: 8, fontSize: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ color: T.green, fontWeight: 700 }}>
                          Reply to @{dmReplyTo.sender === myWallet ? 'you' : (activeThread ? (dmNames[activeThread.id] ?? shortW(dmReplyTo.sender)) : shortW(dmReplyTo.sender))}
                        </span>
                        <div style={{ color: T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dmReplyTo.text}
                        </div>
                      </div>
                      <button onClick={() => setDmReplyTo(null)} style={{ border: 'none', background: 'transparent', color: T.dim, cursor: 'pointer', fontSize: 14 }}>×</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#16181d', border: `1px solid ${T.line}`, borderRadius: 9, padding: '6px 9px' }}>
                    <input
                      className="cl-inp"
                      value={dmText}
                      onChange={e => setDmText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !sendingDM) handleSendDM(); }}
                      placeholder="Start typing your message..."
                      style={{ flex: 1, minWidth: 0, height: 28, background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: 14 }}
                    />
                    <button
                      onClick={handleSendDM}
                      disabled={!dmText.trim() || sendingDM}
                      style={{ width: 32, height: 32, border: 'none', borderRadius: 7, background: (dmText.trim() && !sendingDM) ? T.green : 'rgba(255,255,255,.055)', color: (dmText.trim() && !sendingDM) ? '#fff' : T.faint, cursor: (dmText.trim() && !sendingDM) ? 'pointer' : 'default', fontSize: 15 }}
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <Header icon="□" title="Direct Messages" sub="private threads" />
              <div className="cl-scroll" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {!myWallet ? (
                  <Empty icon="□" msg="Connect wallet" hint="to access your messages" />
                ) : dmThreads.length === 0 ? (
                  <Empty icon="□" msg="No threads yet" hint="Open a profile to start a DM." />
                ) : (
                  dmThreads.map(t => {
                    const other = otherW(t);
                    const name = dmNames[t.id] ?? shortW(other);
                    return (
                      <div
                        key={t.id}
                        className="cl-dm-row"
                        onClick={() => navigate(`/dm?dm=${other}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8 }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(29,158,117,.10)', border: '1px solid rgba(29,158,117,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, fontSize: 12, fontWeight: 850 }}>
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--chat-text-high)' }}>{name}</div>
                          <div style={{ fontSize: 11, color: T.faint }}>{shortW(other)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
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

      {!isMobile && (
        <aside className="cl-right-sidebar">
          <div className="cl-search-container" style={{ position: 'relative' }}>
            <span className="cl-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search assets (top 100)"
              className="cl-search-input"
              value={tokenSearchQuery}
              onChange={e => setTokenSearchQuery(e.target.value)}
            />
            {tokenSearchQuery.trim() !== '' && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0, right: 0,
                background: '#101114',
                border: '1px solid var(--chat-border)',
                borderRadius: '8px',
                zIndex: 1000,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '4px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {top100.filter(t => t.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) || t.name.toLowerCase().includes(tokenSearchQuery.toLowerCase())).slice(0, 5).map(token => {
                  const positive = token.price_change_percentage_24h >= 0;
                  return (
                    <div
                      key={token.id}
                      onClick={() => { setSelectedTokenForChart(token); setTokenSearchQuery(''); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                        background: 'transparent'
                      }}
                      className="cl-dm-row"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.green }}>
                          {token.symbol.toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--chat-text-high)' }}>
                            {token.name}
                          </div>
                          <div style={{ fontSize: 10, color: T.faint }}>
                            {token.symbol.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline prices={token.sparkline_in_7d?.price ?? []} positive={positive} />
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--chat-text-high)' }}>
                            ${token.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: positive ? '#00ba7c' : '#f4212e' }}>
                            {positive ? '+' : ''}{token.price_change_percentage_24h.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="cl-widget-card">
            <div className="cl-widget-title">What's happening</div>
            <div className="cl-widget-list">
              {top100.slice(0, 5).map(token => {
                const positive = token.price_change_percentage_24h >= 0;
                return (
                  <div
                    key={token.id}
                    className="cl-widget-asset-row"
                    onClick={() => setSelectedTokenForChart(token)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="cl-asset-left">
                      <div className="cl-asset-icon-bg" style={{ fontSize: 12, fontWeight: 800, color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {token.symbol.toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <div className="cl-asset-symbol">{token.symbol.toUpperCase()}</div>
                        <div className="cl-asset-name">{token.name}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Sparkline prices={token.sparkline_in_7d?.price ?? []} positive={positive} />
                      <div className="cl-asset-right">
                        <div className="cl-asset-price">
                          ${token.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </div>
                        <div className={`cl-asset-change ${positive ? 'positive' : 'negative'}`}>
                          {positive ? '+' : ''}{token.price_change_percentage_24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cl-widget-show-more">Top 100 assets updated live</div>
          </div>

          <div className="cl-widget-card">
            <div className="cl-widget-title">Who to follow</div>
            <div className="cl-widget-list users">
              {whoToFollow.length === 0 ? (
                <div style={{ color: T.dim, fontSize: 12, padding: '12px 16px', textAlign: 'center' }}>
                  No active users found
                </div>
              ) : (
                whoToFollow.map(u => {
                  const initial = u.username.slice(0, 2).toUpperCase();
                  const level = getDeterministicLevel(u.username, u.wallet_address, myWallet);
                  
                  return (
                    <div key={u.wallet_address} className="cl-widget-user-row">
                      <div className="cl-user-row-left" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${encodeURIComponent(u.username)}`)}>
                        <div className="avatar-wrapper" style={{ width: 40, height: 40 }}>
                          <div className="cl-user-avatar-circle other small">
                            {initial}
                          </div>
                          <span className="cl-level-badge small">{level}</span>
                        </div>
                        <div className="cl-user-row-meta">
                          <span className="cl-user-row-name">@{u.username}</span>
                          <span className="cl-user-row-handle" style={{ fontSize: 10 }}>{shortW(u.wallet_address)}</span>
                        </div>
                      </div>
                      <button className="cl-follow-btn" onClick={() => navigate(`/dm?dm=${u.wallet_address}`)}>DM</button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="cl-widget-show-more">Updated dynamically</div>
          </div>
        </aside>
      )}
      </div>
      {isMobile && <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 58, zIndex: 20, background: '#0c0d10', borderTop: `1px solid ${T.line}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>{navItems.map(it => <button key={it.id} onClick={() => goPanel(it.id)} style={{ border: 0, background: 'transparent', color: panel === it.id ? T.green : T.dim, fontSize: 11 }}>{it.label}</button>)}</nav>}
      {activeMint && <SwapDrawer mint={activeMint} onClose={() => setActiveMint(null)} />}

      {/* ── Coin Chart Modal Overlay ── */}
      {selectedTokenForChart && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: '90%',
            maxWidth: '500px',
            background: '#0a0a0f',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            position: 'relative',
          }}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedTokenForChart(null)}
              style={{
                position: 'absolute',
                top: 16, right: 16,
                background: 'transparent',
                border: 'none',
                color: T.dim,
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>

            {/* Token Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {selectedTokenForChart.image ? (
                <img src={selectedTokenForChart.image} alt={selectedTokenForChart.name} style={{ width: 32, height: 32, borderRadius: '50%' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: T.green }}>
                  {selectedTokenForChart.symbol.toUpperCase().slice(0, 2)}
                </div>
              )}
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--chat-text-high)' }}>
                  {selectedTokenForChart.name}
                </div>
                <div style={{ fontSize: 12, color: T.faint }}>
                  {selectedTokenForChart.symbol.toUpperCase()} / USD
                </div>
              </div>
            </div>

            {/* Price section */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--chat-text-high)', letterSpacing: '-0.5px' }}>
                ${selectedTokenForChart.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </div>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: selectedTokenForChart.price_change_percentage_24h >= 0 ? '#00ba7c' : '#f4212e',
                marginTop: 4,
              }}>
                {selectedTokenForChart.price_change_percentage_24h >= 0 ? '▲' : '▼'}{' '}
                {Math.abs(selectedTokenForChart.price_change_percentage_24h).toFixed(2)}% (24h)
              </div>
            </div>

            {/* Large SVG Price Lining Chart */}
            {selectedTokenForChart.sparkline_in_7d?.price && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: T.faint, marginBottom: 8, fontFamily: 'monospace' }}>
                  7D PRICE LINING CHART
                </div>
                {(() => {
                  const prices = selectedTokenForChart.sparkline_in_7d.price;
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  const range = max - min || 1;
                  const w = 400;
                  const h = 150;
                  
                  // Map coordinates
                  const points = prices.map((price, idx) => {
                    const x = (idx / (prices.length - 1)) * w;
                    const y = h - ((price - min) / range) * h;
                    return `${x},${y}`;
                  }).join(' ');

                  const isPositive = selectedTokenForChart.price_change_percentage_24h >= 0;

                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ overflow: 'visible' }}>
                      {/* Horizontal reference grids */}
                      <line x1={0} y1={0} x2={w} y2={0} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                      <line x1={0} y1={h} x2={w} y2={h} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                      
                      {/* Area under line */}
                      <path
                        d={`M0,${h} ` + prices.map((p, idx) => {
                          const x = (idx / (prices.length - 1)) * w;
                          const y = h - ((p - min) / range) * h;
                          return `L${x},${y}`;
                        }).join(' ') + ` L${w},${h} Z`}
                        fill={isPositive ? 'url(#grad-green)' : 'url(#grad-red)'}
                        opacity="0.1"
                      />

                      {/* Gradients definition */}
                      <defs>
                        <linearGradient id="grad-green" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#00ba7c" />
                          <stop offset="100%" stopColor="#00ba7c" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="grad-red" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#f4212e" />
                          <stop offset="100%" stopColor="#f4212e" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Line path */}
                      <polyline
                        fill="none"
                        stroke={isPositive ? '#00ba7c' : '#f4212e'}
                        strokeWidth="2.5"
                        points={points}
                      />
                    </svg>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.faint, marginTop: 8, fontFamily: 'monospace' }}>
                  <span>7 days ago</span>
                  <span>Now</span>
                </div>
              </div>
            )}

            {/* Info stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: T.faint, marginBottom: 2 }}>7D HIGH</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chat-text-medium)' }}>
                  ${Math.max(...(selectedTokenForChart.sparkline_in_7d?.price ?? [selectedTokenForChart.current_price])).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.faint, marginBottom: 2 }}>7D LOW</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chat-text-medium)' }}>
                  ${Math.min(...(selectedTokenForChart.sparkline_in_7d?.price ?? [selectedTokenForChart.current_price])).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setSelectedTokenForChart(null)}
              style={{
                width: '100%',
                marginTop: 24,
                height: 40,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: 'var(--chat-text-high)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close Chart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
