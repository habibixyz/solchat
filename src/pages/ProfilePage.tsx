import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';

interface UserRecord {
  wallet_address: string;
  username: string;
  twitter_handle?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

const T = {
  bg: '#08090b',
  panel: 'rgba(16,17,20,.92)',
  panel2: 'rgba(21,22,26,.92)',
  line: 'rgba(255,255,255,.075)',
  text: '#e7edf4',
  dim: '#8491a3',
  faint: '#4b5565',
  green: '#1D9E75',
};

const shortWallet = (addr?: string) => addr ? `${addr.slice(0, 5)}...${addr.slice(-5)}` : '';
const normalize = (value?: string) => (value || '').replace(/\.{3}|…|â€¦/g, '').toLowerCase();

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

async function withTimeout<T>(promise: Promise<T>, ms = 7000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function findUser(raw: string): Promise<UserRecord | null> {
  const decoded = decodeURIComponent(raw).trim();

  const { data: byUsername } = await supabase
    .from('usernames')
    .select('*')
    .ilike('username', `%${decoded}%`)
    .maybeSingle();
  if (byUsername) return byUsername as UserRecord;

  const { data: fromMessages } = await supabase
  .from('messages')
  .select('username, wallet_address')
  .ilike('username', `%${decoded}%`)
    .limit(1)
    .maybeSingle();
    
    if (fromMessages) {
    return {
      username: fromMessages.username,
      wallet_address: fromMessages.wallet_address,
    } as UserRecord;
  }

  const { data: byWallet } = await supabase
    .from('usernames')
    .select('*')
    .ilike('wallet_address', `%${decoded}%`)
    .maybeSingle();
  if (byWallet) return byWallet as UserRecord;

  if (!decoded.includes('...') && !decoded.includes('…') && !decoded.includes('â€¦')) return null;

  const compact = normalize(decoded);
  const { data: candidates } = await supabase
    .from('usernames')
    .select('*')
    .limit(500);

  return (candidates as UserRecord[] | null)?.find(u => {
    const name = normalize(u.username);
    const wallet = normalize(u.wallet_address);
    return (name.startsWith(compact.slice(0, 4)) && name.endsWith(compact.slice(-4))) ||
      (wallet.startsWith(compact.slice(0, 4)) && wallet.endsWith(compact.slice(-4)));
  }) ?? null;
}

async function fetchUserMessages(user: UserRecord) {
  const attempts = [
    () => supabase.from('messages').select('*').eq('wallet_address', user.wallet_address).order('created_at', { ascending: false }),
    () => supabase.from('messages').select('*').eq('sender_wallet', user.wallet_address).order('created_at', { ascending: false }),
    () => supabase.from('messages').select('*').eq('user_id', user.wallet_address).order('created_at', { ascending: false }),
    () => supabase.from('messages').select('*').eq('username', user.username).order('created_at', { ascending: false }),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (!error) return Array.isArray(data) ? data : [];
    const msg = error.message || '';
    if (!msg.includes('column') && !msg.includes('schema cache') && !msg.includes('Could not find')) break;
  }

  return [];
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();

  const [user, setUser] = useState<UserRecord | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const myWallet = publicKey?.toBase58?.();
  const isOwner = !!myWallet && !!user && myWallet === user.wallet_address;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setUser(null);
      setMessages([]);

      try {
        if (!username) return;
        const resolved = await withTimeout(findUser(username), 7000);
        if (!alive) return;

        setUser(resolved);
        if (!resolved) return;

        const rows = await withTimeout(fetchUserMessages(resolved), 7000);
        if (alive) setMessages(rows);
      } catch (e) {
        console.warn('Profile load failed:', e);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [username]);

  async function copyWallet() {
    if (!user?.wallet_address) return;
    await navigator.clipboard.writeText(user.wallet_address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.faint, fontSize: 11, letterSpacing: 3 }}>
        LOADING...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: T.dim }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green }}>?</div>
        <div style={{ fontSize: 14 }}>user not found</div>
        <button onClick={() => navigate('/')} style={{ border: `1px solid ${T.line}`, background: T.panel, color: T.dim, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>back to chat</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', padding: isMobile ? '14px 12px 70px' : '22px 20px 70px', color: T.text }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <button onClick={() => navigate('/')} style={{ border: 0, background: 'transparent', color: T.dim, cursor: 'pointer', padding: 0, marginBottom: 14, fontSize: 12 }}>
          back
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 14 }}>
          <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.green}, transparent)` }} />
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: 12, background: 'rgba(29,158,117,.10)', border: '1px solid rgba(29,158,117,.25)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, fontWeight: 850, fontSize: 18 }}>
                  {user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.username.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{user.username}</div>
                  <div style={{ color: T.faint, fontSize: 12, marginTop: 3 }}>{shortWallet(user.wallet_address)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 15 }}>
                <div style={{ background: 'rgba(255,255,255,.035)', border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 850 }}>{messages.length}</div>
                  <div style={{ color: T.faint, fontSize: 10, letterSpacing: 1.5 }}>SIGNALS</div>
                </div>
                <button onClick={copyWallet} style={{ background: 'rgba(255,255,255,.035)', border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, color: T.dim, cursor: 'pointer' }}>
                  {copied ? 'copied' : 'copy wallet'}
                </button>
              </div>

              {!isOwner && myWallet && (
                <button onClick={() => navigate(`/dm?dm=${user.wallet_address}`)} style={{ marginTop: 12, width: '100%', height: 38, borderRadius: 8, border: '1px solid rgba(29,158,117,.28)', background: 'rgba(29,158,117,.10)', color: T.green, cursor: 'pointer', fontWeight: 750 }}>
                  Direct Message
                </button>
              )}

              {user.twitter_handle && <div style={{ marginTop: 12, color: T.dim, fontSize: 12 }}>X @{user.twitter_handle}</div>}
            </div>
          </section>

          <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '13px 15px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: T.green, letterSpacing: 2, fontWeight: 800 }}>SIGNALS</div>
              <div style={{ color: T.faint, fontSize: 12 }}>{messages.length} total</div>
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: isMobile ? 'auto' : 'calc(100vh - 180px)', overflowY: 'auto' }}>
              {messages.length === 0 && <div style={{ padding: 40, color: T.faint, textAlign: 'center', fontSize: 13 }}>no signals yet</div>}
              {messages.map(msg => (
                <div key={msg.id} style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ color: '#cbd6e3', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                  <div style={{ color: T.faint, fontSize: 11, marginTop: 7 }}>{timeAgo(msg.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
