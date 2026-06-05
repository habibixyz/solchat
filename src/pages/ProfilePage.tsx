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
  bg: '#020203',
  panel: '#09090b',
  panel2: '#0f0f12',
  line: 'rgba(255,255,255,.055)',
  text: '#ffffff',
  dim: '#cbd5e1',
  faint: '#64748b',
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
  if (!decoded) return null;

  // 1. Try exact wallet_address lookup
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(decoded)) {
    const { data: byWallet } = await supabase
      .from('usernames')
      .select('*')
      .eq('wallet_address', decoded)
      .maybeSingle();
    if (byWallet) return byWallet as UserRecord;

    // Try messages table lookup for username
    const { data: msg } = await supabase
      .from('messages')
      .select('username')
      .eq('wallet_address', decoded)
      .limit(1)
      .maybeSingle();
    if (msg && msg.username) {
      return { wallet_address: decoded, username: msg.username };
    }

    // Dynamic fallback profile
    return { wallet_address: decoded, username: 'guest' };
  }

  // 2. Try lookup by exact username match
  const { data: byExactUsername } = await supabase
    .from('usernames')
    .select('*')
    .ilike('username', decoded)
    .maybeSingle();
  if (byExactUsername) return byExactUsername as UserRecord;

  // 3. Try lookup by ilike username match
  const { data: byLikeUsername } = await supabase
    .from('usernames')
    .select('*')
    .ilike('username', `%${decoded}%`)
    .limit(1)
    .maybeSingle();
  if (byLikeUsername) return byLikeUsername as UserRecord;

  // 4. Try lookup in messages username field
  const { data: msgUser } = await supabase
    .from('messages')
    .select('wallet_address, username')
    .ilike('username', `%${decoded}%`)
    .limit(1)
    .maybeSingle();
  if (msgUser) {
    return { wallet_address: msgUser.wallet_address, username: msgUser.username };
  }

  return null;
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

  // ── Tabbed View States ──
  const [activeTab, setActiveTab] = useState<'signals' | 'likes' | 'notifications'>('signals');
  const [likedMessages, setLikedMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

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
      setActiveTab('signals');

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

  // ── Fetch Liked Messages ──
  useEffect(() => {
    if (!user?.wallet_address) return;

    async function loadLikes() {
      setLoadingLikes(true);
      try {
        const { data: reactions, error: rxError } = await supabase
          .from('message_reactions')
          .select('message_id')
          .eq('reactor', user.wallet_address)
          .eq('reaction_type', 'signal')
          .order('created_at', { ascending: false });

        if (rxError) throw rxError;
        if (!reactions || reactions.length === 0) {
          setLikedMessages([]);
          return;
        }

        const ids = reactions.map(r => r.message_id);
        const { data: msgs, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .in('id', ids);

        if (msgError) throw msgError;

        // Sort messages according to reaction order
        const sorted = (msgs ?? []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        setLikedMessages(sorted);
      } catch (e) {
        console.warn('Failed to load likes:', e);
      } finally {
        setLoadingLikes(false);
      }
    }

    loadLikes();
  }, [user?.wallet_address]);

  // ── Fetch Notifications ──
  useEffect(() => {
    if (!isOwner || !user?.wallet_address) return;

    async function loadNotifs() {
      setLoadingNotifs(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient', user.wallet_address)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setNotifications(data ?? []);
      } catch (e) {
        console.warn('Failed to load notifications:', e);
      } finally {
        setLoadingNotifs(false);
      }
    }

    loadNotifs();
  }, [user?.wallet_address, isOwner]);

  async function copyWallet() {
    if (!user?.wallet_address) return;
    await navigator.clipboard.writeText(user.wallet_address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.dim, fontSize: 12, letterSpacing: 3, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
        LOADING DATA CORE...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: T.dim, fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, fontSize: 18, fontWeight: 800, background: T.panel }}>?</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>USER DATA CORE NOT FOUND</div>
        <button onClick={() => navigate('/')} style={{ border: `1px solid ${T.line}`, background: T.panel, color: '#fff', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all .2s' }}>Back to Chat</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', padding: isMobile ? '16px 12px 70px' : '30px 24px 70px', background: T.bg, color: T.text, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ border: `1px solid ${T.line}`, background: T.panel, color: T.dim, cursor: 'pointer', padding: '6px 14px', borderRadius: 8, marginBottom: 18, fontSize: 12, fontWeight: 700, transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.dim; e.currentTarget.style.borderColor = T.line; }}
        >
          ← Back
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 20 }}>
          {/* LEFT SIDEBAR: PROFILE META */}
          <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden', height: 'fit-content', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${T.green}, transparent)` }} />
            <div style={{ padding: 22 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, background: 'rgba(29,158,117,.10)', border: '1px solid rgba(29,158,117,.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, fontWeight: 900, fontSize: 24, fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 15px rgba(29,158,117,0.1)' }}>
                  {user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>@{user.username}</div>
                  <div style={{ color: T.green, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' }}>Verified Node</div>
                </div>
              </div>

              {/* STATS & ADDRESS CODES */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.dim, fontWeight: 700 }}>Signals Broadcasted</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>{messages.length}</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: T.dim, fontWeight: 700 }}>Solana Address</span>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all' }}>{user.wallet_address}</span>
                  <button 
                    onClick={copyWallet} 
                    style={{ marginTop: 4, width: '100%', height: 32, borderRadius: 6, border: `1px solid ${T.line}`, background: copied ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.03)', color: copied ? T.green : T.dim, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.2s' }}
                  >
                    {copied ? '✓ Copied' : 'Copy Wallet Address'}
                  </button>
                </div>
              </div>

              {!isOwner && myWallet && (
                <button 
                  onClick={() => navigate(`/dm?dm=${user.wallet_address}`)} 
                  style={{ marginTop: 16, width: '100%', height: 42, borderRadius: 10, border: '1px solid rgba(29,158,117,.35)', background: 'rgba(29,158,117,.12)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(29,158,117,0.15)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.green; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(29,158,117,.12)'; }}
                >
                  💬 Send Direct Message
                </button>
              )}

              {user.twitter_handle && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'rgba(29,158,117,0.04)', border: '1px solid rgba(29,158,117,0.15)', borderRadius: 10, fontSize: 12, color: T.dim, fontWeight: 600 }}>
                  <span style={{ color: '#1da1f2', fontSize: 14 }}>𝕏</span> Twitter: @{user.twitter_handle}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT CONTENT AREA: TABS */}
          <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}>
            
            {/* Tab Headers */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, background: 'rgba(8, 8, 10, 0.95)' }}>
              <button
                onClick={() => setActiveTab('signals')}
                style={{
                  flex: 1, padding: '14px 0', border: 'none', background: 'transparent',
                  color: activeTab === 'signals' ? T.green : T.dim,
                  borderBottom: activeTab === 'signals' ? `2.5px solid ${T.green}` : 'none',
                  fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                  letterSpacing: 1
                }}
              >
                SIGNALS ({messages.length})
              </button>
              <button
                onClick={() => setActiveTab('likes')}
                style={{
                  flex: 1, padding: '14px 0', border: 'none', background: 'transparent',
                  color: activeTab === 'likes' ? T.green : T.dim,
                  borderBottom: activeTab === 'likes' ? `2.5px solid ${T.green}` : 'none',
                  fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                  letterSpacing: 1
                }}
              >
                LIKES ({likedMessages.length})
              </button>
              {isOwner && (
                <button
                  onClick={() => setActiveTab('notifications')}
                  style={{
                    flex: 1, padding: '14px 0', border: 'none', background: 'transparent',
                    color: activeTab === 'notifications' ? T.green : T.dim,
                    borderBottom: activeTab === 'notifications' ? `2.5px solid ${T.green}` : 'none',
                    fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    letterSpacing: 1
                  }}
                >
                  NOTIFICATIONS ({notifications.length})
                </button>
              )}
            </div>

            {/* Tab Body Contents */}
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: isMobile ? 'auto' : 'calc(100vh - 200px)', overflowY: 'auto' }}>
              
              {activeTab === 'signals' && (
                <>
                  {messages.length === 0 ? (
                    <div style={{ padding: 60, color: T.faint, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
                      No signals broadcasted yet
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 8 }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}>
                        <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500 }}>{msg.text}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <div style={{ color: T.faint, fontSize: 11, fontWeight: 600 }}>{timeAgo(msg.created_at)} ago</div>
                          {msg.reactionCount > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--chat-gold)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                              ⚡ {msg.reactionCount} Signals
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'likes' && (
                <>
                  {loadingLikes ? (
                    <div style={{ padding: 40, color: T.faint, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Loading liked signals...</div>
                  ) : likedMessages.length === 0 ? (
                    <div style={{ padding: 60, color: T.faint, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
                      No liked signals yet
                    </div>
                  ) : (
                    likedMessages.map(msg => (
                      <div key={msg.id} style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 8 }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: T.green, fontSize: 12, fontWeight: 700 }}>@{msg.username || 'guest'}</span>
                          <span style={{ color: T.faint, fontSize: 11 }}>{timeAgo(msg.created_at)} ago</span>
                        </div>
                        <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500 }}>{msg.text}</div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'notifications' && (
                <>
                  {loadingNotifs ? (
                    <div style={{ padding: 40, color: T.faint, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Loading notifications...</div>
                  ) : notifications.length === 0 ? (
                    <div style={{ padding: 60, color: T.faint, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: n.read ? T.panel2 : 'rgba(29,158,117,.06)', border: `1px solid ${n.read ? T.line : 'rgba(29,158,117,.2)'}`, borderRadius: 10 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 99, background: n.read ? 'transparent' : T.green, marginTop: 7 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>
                            <b style={{ color: T.green }}>@{n.sender_name || 'guest'}</b> {n.type === 'reply' ? 'replied to you' : 'mentioned you'}{' '}
                            <span style={{ color: T.faint }}>· {timeAgo(n.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#c8d3df', lineHeight: 1.45 }}>{n.message_preview}</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
