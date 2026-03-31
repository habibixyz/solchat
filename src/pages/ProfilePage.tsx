import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';
import { getEthosProfile, LEVEL_COLOR } from '../services/ethosService';
import type { EthosProfile } from '../services/ethosService';
import { invalidateAvatar } from '../utils/avatarCache';

interface UserRecord {
  wallet_address: string;
  username: string;
  created_at: string;
  twitter_handle: string | null;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();

  const [user, setUser] = useState<UserRecord | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgCount, setMsgCount] = useState(0);
  const [ethos, setEthos] = useState<EthosProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTwitter, setEditingTwitter] = useState(false);
  const [twitterInput, setTwitterInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [avatar, setAvatar] = useState<string | null>(null);

  const isOwner = !!(publicKey && user && publicKey.toBase58() === user.wallet_address);
  const score = (ethos as any)?.score?.score ?? (ethos as any)?.score ?? null;
  const level = (ethos as any)?.score?.level ?? (ethos as any)?.level ?? null;
  const levelColor = level ? (LEVEL_COLOR[level] ?? '#7c5cff') : '#7c5cff';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!username) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('usernames').select('*').eq('username', username).maybeSingle();
      if (!data) { setLoading(false); return; }
      setUser(data);
      setAvatar(data.avatar_url ?? null);
      setTwitterInput(data.twitter_handle ?? '');
      const { data: msgs } = await supabase.from('messages').select('*').eq('username', username).order('created_at', { ascending: false });
      setMessages(Array.isArray(msgs) ? msgs : []);
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('username', username);
      setMsgCount(count ?? 0);
      if (data.twitter_handle) {
        try {
          const res = await getEthosProfile(data.twitter_handle);
          const profile = Array.isArray(res) ? res[0] : res;
          setEthos(profile ?? null);
        } catch { setEthos(null); }
      }
      setLoading(false);
    }
    load();
  }, [username]);

  async function saveTwitter() {
    if (!user) return;
    setSaving(true);
    const handle = twitterInput.replace(/^@/, '').trim();
    await supabase.from('usernames').update({ twitter_handle: handle || null }).eq('wallet_address', user.wallet_address);
    setUser({ ...user, twitter_handle: handle || null });
    setEditingTwitter(false);
    setSaving(false);
    if (handle) {
      try {
        const res = await getEthosProfile(handle);
        setEthos(Array.isArray(res) ? res[0] : res);
      } catch { setEthos(null); }
    }
  }

  function shortWallet(addr?: string) {
    if (!addr) return '';
    return `${addr.slice(0, 5)}...${addr.slice(-5)}`;
  }

  function timeAgo(d: string) {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  async function handleAvatarUpload(file: File) {
  if (!user || !isOwner) return;

  const path = `${user.wallet_address}.jpg`;

  await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);

  const publicUrl = data.publicUrl + `?t=${Date.now()}`;

  await supabase
    .from('usernames')
    .update({ avatar_url: publicUrl })
    .eq('wallet_address', user.wallet_address);

  setAvatar(publicUrl);
  invalidateAvatar(user.wallet_address, user.username);
}

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'ui-monospace,monospace', fontSize: 11, letterSpacing: 4 }}>LOADING...</div>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40, opacity: 0.1 }}>⟁</div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace,monospace' }}>user not found</div>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'ui-monospace,monospace' }}>← back</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? '16px 12px 60px' : '24px 20px 60px', position: 'relative' }}>
      
      <input
      type="file"
      accept="image/*"
      id="avatarUpload"
      style={{ display: 'none' }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleAvatarUpload(file);
      }}
    />

      <div style={{ position: 'fixed', top: 0, left: '20%', width: 600, height: 400, background: 'radial-gradient(circle, rgba(0,247,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: 0, right: '10%', width: 500, height: 400, background: 'radial-gradient(circle, rgba(124,92,255,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontFamily: 'ui-monospace,monospace', fontSize: 11, letterSpacing: 1, marginBottom: 16, padding: 0 }}>
          ← back
        </button>

        <div style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
        }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{
            width: isMobile ? '100%' : 260,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>

            {/* Profile card */}
            <div style={{ background: 'rgba(10,18,40,0.85)', border: '1px solid rgba(120,150,255,0.15)', borderRadius: 18, backdropFilter: 'blur(18px)', boxShadow: '0 0 40px rgba(80,120,255,0.1)', overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${levelColor}88, transparent)` }} />

              <div style={{ padding: '20px 20px 16px' }}>
                <div style={{ display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 14 : 0, flexDirection: isMobile ? 'row' : 'column' }}>
                  {/* Avatar */}
                  <div
  onClick={() => {
    if (isOwner) document.getElementById('avatarUpload')?.click();
  }}
  style={{
    width: isMobile ? 52 : 64,
    height: isMobile ? 52 : 64,
    borderRadius: 14,
    flexShrink: 0,
    cursor: isOwner ? 'pointer' : 'default',
    overflow: 'hidden',
    border: `1px solid ${levelColor}44`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,247,255,0.08)',
    boxShadow: `0 0 20px ${levelColor}22`
  }}
>
  {avatar ? (
    <img
      src={avatar}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }}
    />
  ) : (
    <span
      style={{
        fontSize: isMobile ? 18 : 22,
        fontWeight: 700,
        color: '#00f7ff',
        fontFamily: 'ui-monospace,monospace'
      }}
    >
      {user.username.slice(0, 2).toUpperCase()}
    </span>
  )}
</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#fff', fontFamily: 'ui-monospace,monospace', marginBottom: 4, textShadow: '0 0 16px rgba(0,247,255,0.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{user.username}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <span style={{ color: '#9945FF', fontSize: 11 }}>◎</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'ui-monospace,monospace' }}>{shortWallet(user.wallet_address)}</span>
                      <button onClick={() => { navigator.clipboard.writeText(user.wallet_address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        style={{ background: 'none', border: '1px solid rgba(120,150,255,0.2)', borderRadius: 5, color: 'rgba(159,179,255,0.4)', fontSize: 9, padding: '1px 6px', cursor: 'pointer', fontFamily: 'ui-monospace,monospace' }}>
                        {copied ? '✓' : 'copy'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── DM BUTTON — only shows when viewing someone else's profile ── */}
                {!isOwner && publicKey && (
                  <button
                    onClick={() => navigate(`/dm?dm=${user.wallet_address}`)}
                    style={{
                      width: '100%',
                      marginTop: 14,
                      background: 'rgba(0,247,255,0.04)',
                      border: '1px solid rgba(0,247,255,0.18)',
                      borderRadius: 10,
                      color: 'rgba(0,247,255,0.7)',
                      fontSize: 11,
                      fontFamily: 'ui-monospace,monospace',
                      letterSpacing: 2,
                      padding: '9px 0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      const b = e.currentTarget;
                      b.style.background = 'rgba(0,247,255,0.09)';
                      b.style.borderColor = 'rgba(0,247,255,0.4)';
                      b.style.color = '#00f7ff';
                    }}
                    onMouseLeave={e => {
                      const b = e.currentTarget;
                      b.style.background = 'rgba(0,247,255,0.04)';
                      b.style.borderColor = 'rgba(0,247,255,0.18)';
                      b.style.color = 'rgba(0,247,255,0.7)';
                    }}
                  >
                    🔒 DIRECT MESSAGE
                  </button>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'ui-monospace,monospace' }}>{msgCount}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: 1 }}>SIGNALS</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: levelColor, fontFamily: 'ui-monospace,monospace', textShadow: `0 0 12px ${levelColor}66` }}>{score ?? '-'}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: 1 }}>CRED</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ethos card */}
            <div style={{ background: 'rgba(10,18,40,0.85)', border: '1px solid rgba(120,150,255,0.15)', borderRadius: 18, backdropFilter: 'blur(18px)', padding: '18px 20px' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.3)', fontFamily: 'ui-monospace,monospace', letterSpacing: 3, marginBottom: 14 }}>⬡ ETHOS REPUTATION</div>

              {score !== null && level ? (
                <div style={{ textAlign: 'center', padding: '10px 0 14px' }}>
                  <div style={{ fontSize: 42, fontWeight: 700, color: levelColor, fontFamily: 'ui-monospace,monospace', textShadow: `0 0 30px ${levelColor}66`, lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 13, color: levelColor, fontFamily: 'ui-monospace,monospace', textTransform: 'capitalize', marginTop: 6, letterSpacing: 2 }}>{level}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace,monospace', marginTop: 4 }}>credibility score</div>
                  <a href={`https://app.ethos.network/profile/x/${user.twitter_handle}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: 'rgba(0,247,255,0.35)', fontFamily: 'ui-monospace,monospace', textDecoration: 'none', marginTop: 10, display: 'block' }}>
                    view on ethos →
                  </a>
                </div>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, fontFamily: 'ui-monospace,monospace' }}>
                  {user.twitter_handle ? 'not on ethos yet' : 'no twitter linked'}
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 4 }}>
                {user.twitter_handle && !editingTwitter && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace,monospace' }}>𝕏 @{user.twitter_handle}</span>
                    {isOwner && <button onClick={() => setEditingTwitter(true)} style={{ background: 'none', border: '1px solid rgba(120,150,255,0.2)', borderRadius: 6, color: '#9fb3ff', fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'ui-monospace,monospace' }}>change</button>}
                  </div>
                )}
                {!user.twitter_handle && !editingTwitter && isOwner && (
                  <button onClick={() => setEditingTwitter(true)} style={{ background: 'none', border: '1px solid rgba(120,150,255,0.2)', borderRadius: 8, color: '#9fb3ff', fontSize: 11, padding: '6px 12px', cursor: 'pointer', fontFamily: 'ui-monospace,monospace', width: '100%' }}>
                    + link twitter
                  </button>
                )}
                {editingTwitter && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={twitterInput} onChange={e => setTwitterInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveTwitter()}
                      placeholder="twitter username" autoFocus
                      style={{ background: 'rgba(20,30,60,0.6)', border: '1px solid rgba(120,150,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 12, fontFamily: 'ui-monospace,monospace', padding: '7px 10px', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={saveTwitter} disabled={saving} style={{ flex: 1, background: 'rgba(124,92,255,0.2)', border: '1px solid rgba(124,92,255,0.35)', borderRadius: 8, color: '#a78bfa', fontSize: 11, padding: '6px', cursor: 'pointer', fontFamily: 'ui-monospace,monospace' }}>{saving ? '...' : 'save'}</button>
                      <button onClick={() => setEditingTwitter(false)} style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '6px', cursor: 'pointer', fontFamily: 'ui-monospace,monospace' }}>cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN — SIGNALS FEED ── */}
          <div style={{ flex: 1, width: isMobile ? '100%' : 'auto', background: 'rgba(10,18,40,0.85)', border: '1px solid rgba(120,150,255,0.15)', borderRadius: 18, backdropFilter: 'blur(18px)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.35)', fontFamily: 'ui-monospace,monospace', letterSpacing: 3 }}>▸ SIGNALS</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace,monospace' }}>{msgCount} total</div>
            </div>

            <div style={{
              height: isMobile ? 'auto' : 'calc(80vh - 60px)',
              maxHeight: isMobile ? '60vh' : 'none',
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              {messages.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.1)', fontFamily: 'ui-monospace,monospace', fontSize: 12, textAlign: 'center', marginTop: 40 }}>no signals yet</div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <span style={{ color: 'rgba(0,247,255,0.2)', fontFamily: 'ui-monospace,monospace', fontSize: 11, flexShrink: 0, marginTop: 1 }}>&gt;</span>
                    <span style={{ fontSize: isMobile ? 12 : 13, color: 'rgba(203,213,245,0.75)', fontFamily: 'ui-monospace,monospace', lineHeight: 1.5, wordBreak: 'break-word' as const, minWidth: 0 }}>{msg.text}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', fontFamily: 'ui-monospace,monospace', flexShrink: 0, marginTop: 2, whiteSpace: 'nowrap' as const }}>{timeAgo(msg.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

