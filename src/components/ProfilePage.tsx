import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';
import { getEthosProfile, LEVEL_COLOR } from '../services/ethosService';

interface UserRecord {
  wallet_address: string;
  username: string;
  created_at: string;
  twitter_handle: string | null;
}

interface Message {
  id: string;
  text: string;
  created_at: string;
}

interface EthosData {
  score: number | null;
  level: string | null;
  vouchCount: number;
  reviewPositive: number;
  reviewNegative: number;
  profileUrl: string;
}

function ScoreRing({ score, level }: { score: number; level: string }) {
  const color = LEVEL_COLOR[level] ?? '#7c5cff';
  const pct = Math.max(0, Math.min(score / 2000, 1));
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="5"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 1.2s ease',
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color,
            fontFamily: 'ui-monospace,monospace',
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: 7,
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {level}
        </span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();

  const [user, setUser] = useState<UserRecord | null>(null);
  const [msgCount, setMsgCount] = useState<number>(0);
  const [recentMsgs, setRecentMsgs] = useState<Message[]>([]);
  const [ethos, setEthos] = useState<EthosData | null>(null);

  const [loading, setLoading] = useState(true);
  const [ethosLoading, setEthosLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [editingTwitter, setEditingTwitter] = useState(false);
  const [twitterInput, setTwitterInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const isOwner = useMemo(() => {
    if (!publicKey || !user?.wallet_address) return false;
    return publicKey.toBase58() === user.wallet_address;
  }, [publicKey, user]);

  const levelColor = ethos?.level
    ? LEVEL_COLOR[ethos.level] ?? '#7c5cff'
    : '#7c5cff';

  async function loadEthos(handle: string) {
  setEthosLoading(true);

  try {
    const res = await getEthosProfile(handle);

    // 👇 HANDLE ARRAY RESPONSE (THIS IS YOUR BUG)
    const profile = Array.isArray(res) ? res[0] : res;

    if (!profile) {
      setEthos(null);
      return;
    }

    const safe: EthosData = {
      score: profile?.score?.score ?? null,
      level: profile?.score?.level ?? null,
      vouchCount: profile?.vouchCount ?? 0,
      reviewPositive: profile?.reviewStats?.positive ?? 0,
      reviewNegative: profile?.reviewStats?.negative ?? 0,
      profileUrl:
        profile?.profileUrl ??
        `https://app.ethos.network/profile/x/${handle}`,
    };

    setEthos(safe);
  } catch (e) {
    console.error(e);
    setEthos(null);
  }

  setEthosLoading(false);
}

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!username?.trim()) {
        if (mounted) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setNotFound(false);
      setUser(null);
      setRecentMsgs([]);
      setMsgCount(0);
      setEthos(null);

      try {
        const { data, error } = await supabase
          .from('usernames')
          .select('wallet_address, username, created_at, twitter_handle')
          .eq('username', username)
          .maybeSingle();

        if (!mounted) return;

        if (error || !data) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const safeUser: UserRecord = {
          wallet_address: typeof data.wallet_address === 'string' ? data.wallet_address : '',
          username: typeof data.username === 'string' ? data.username : username,
          created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
          twitter_handle:
            typeof data.twitter_handle === 'string' ? data.twitter_handle : null,
        };

        setUser(safeUser);
        setTwitterInput(safeUser.twitter_handle ?? '');

        const [{ count, error: countError }, { data: msgs, error: msgsError }] =
          await Promise.all([
            supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('username', safeUser.username),
            supabase
              .from('messages')
              .select('id, text, created_at')
              .eq('username', safeUser.username)
              .order('created_at', { ascending: false })
              .limit(8),
          ]);

        if (!mounted) return;

        if (!countError) {
          setMsgCount(typeof count === 'number' ? count : 0);
        } else {
          console.error('Message count error:', countError);
          setMsgCount(0);
        }

        if (!msgsError && Array.isArray(msgs)) {
          const safeMsgs: Message[] = msgs
            .filter((msg) => msg && typeof msg.id === 'string')
            .map((msg) => ({
              id: msg.id,
              text: typeof msg.text === 'string' ? msg.text : '',
              created_at:
                typeof msg.created_at === 'string'
                  ? msg.created_at
                  : new Date().toISOString(),
            }))
            .reverse();

          setRecentMsgs(safeMsgs);
        } else {
          if (msgsError) console.error('Recent messages error:', msgsError);
          setRecentMsgs([]);
        }

        if (safeUser.twitter_handle) {
          loadEthos(safeUser.twitter_handle);
        }
      } catch (error) {
        console.error('Profile load error:', error);
        if (mounted) {
          setNotFound(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [username]);

  async function saveTwitterHandle() {
    if (!user?.wallet_address) return;

    setSaving(true);
    setSaveMsg('');

    try {
      const handle = twitterInput.replace(/^@/, '').trim();

      const { error } = await supabase
        .from('usernames')
        .update({ twitter_handle: handle || null })
        .eq('wallet_address', user.wallet_address);

      if (error) {
        console.error('Twitter handle save error:', error);
        setSaveMsg('failed. try again.');
        return;
      }

      setSaveMsg('saved!');
      const updatedUser = { ...user, twitter_handle: handle || null };
      setUser(updatedUser);
      setEditingTwitter(false);

      if (handle) {
        await loadEthos(handle);
      } else {
        setEthos(null);
      }
    } catch (error) {
      console.error('Save twitter error:', error);
      setSaveMsg('failed. try again.');
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveMsg(''), 3000);
    }
    console.log("DEBUG:", {
  recentMsgs,
  user,
  ethos,
});
  }

  async function handleCopyWallet() {
    if (!user?.wallet_address) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(user.wallet_address);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Clipboard copy failed:', error);
    }
  }

  function timeAgo(d: string) {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';

    const m = Math.floor((Date.now() - date.getTime()) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;

    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;

    return `${Math.floor(h / 24)}d`;
  }

  const joinedLabel = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : '';

  const shortWallet = user?.wallet_address
    ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-6)}`
    : '';

  if (!loading && notFound) {
    return (
      <div style={S.page}>
        <div style={S.glowA} />
        <div style={S.glowB} />
        <div style={S.center}>
          <div style={{ fontSize: 40, opacity: 0.15 }}>⟁</div>
          <div
            style={{
              color: 'rgba(255,255,255,0.25)',
              fontFamily: 'ui-monospace,monospace',
              fontSize: 13,
            }}
          >
            user <span style={{ color: '#00f7ff' }}>@{username}</span> not found
          </div>
          <button style={S.backBtn} onClick={() => navigate('/chat')}>
            ← back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.glowA} />
        <div style={S.glowB} />
        <div style={S.center}>
          <div
            style={{
              color: 'rgba(255,255,255,0.12)',
              fontFamily: 'ui-monospace,monospace',
              fontSize: 11,
              letterSpacing: 3,
            }}
          >
            LOADING SIGNAL...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={S.page}>
        <div style={S.glowA} />
        <div style={S.glowB} />
        <div style={S.center}>
          <div
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontFamily: 'ui-monospace,monospace',
              fontSize: 12,
            }}
          >
            profile unavailable
          </div>
          <button style={S.backBtn} onClick={() => navigate('/chat')}>
            ← back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.glowA} />
      <div style={S.glowB} />
      <div style={S.scanline} />

      <button style={S.backBtn} onClick={() => navigate('/chat')}>
        ← back
      </button>

      <div
        style={{
          width: '100%',
          maxWidth: 540,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={S.card}>
          <div
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${levelColor}77, transparent)`,
            }}
          />

          <div style={S.headerRow}>
            <div
              style={{
                ...S.avatar,
                borderColor: `${levelColor}44`,
                boxShadow: `0 0 20px ${levelColor}22`,
              }}
            >
              {(user.username || 'XX').slice(0, 2).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.username}>@{user.username}</div>

              <div style={S.walletRow}>
                <span style={{ color: '#9945FF' }}>◎</span>
                <span style={S.walletText}>{shortWallet}</span>
                <button style={S.copyBtn} onClick={handleCopyWallet}>
                  {copied ? '✓' : 'copy'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!!joinedLabel && <span style={S.chip}>joined {joinedLabel}</span>}
                <span style={S.chip}>{msgCount} signals</span>
                <span style={S.chip}>solchat profile</span>
              </div>
            </div>
          </div>

          <div style={S.divider} />

          <div style={S.section}>
            <div style={S.label}>⬡ ETHOS REPUTATION</div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {user.twitter_handle ? (
                <div style={S.twitterBadge}>𝕏 @{user.twitter_handle}</div>
              ) : (
                <span
                  style={{
                    color: 'rgba(255,255,255,0.18)',
                    fontSize: 12,
                    fontFamily: 'ui-monospace,monospace',
                  }}
                >
                  no twitter linked
                </span>
              )}

              {isOwner && !editingTwitter && (
                <button style={S.ghostBtn} onClick={() => setEditingTwitter(true)}>
                  {user.twitter_handle ? 'change' : '+ link twitter'}
                </button>
              )}
            </div>

            {isOwner && editingTwitter && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'ui-monospace,monospace',
                  }}
                >
                  @
                </span>

                <input
                  style={S.input}
                  placeholder="twitter username"
                  value={twitterInput}
                  onChange={(e) => setTwitterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTwitterHandle();
                  }}
                  autoFocus
                />

                <button
                  style={S.saveBtn}
                  onClick={saveTwitterHandle}
                  disabled={saving}
                >
                  {saving ? '...' : 'save'}
                </button>

                <button
                  style={S.ghostBtn}
                  onClick={() => {
                    setEditingTwitter(false);
                    setTwitterInput(user.twitter_handle ?? '');
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {!!saveMsg && (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(0,247,255,0.5)',
                  fontFamily: 'ui-monospace,monospace',
                }}
              >
                {saveMsg}
              </div>
            )}

            {ethosLoading && (
              <div
                style={{
                  color: 'rgba(255,255,255,0.15)',
                  fontFamily: 'ui-monospace,monospace',
                  fontSize: 11,
                  letterSpacing: 2,
                }}
              >
                FETCHING...
              </div>
            )}

            {!ethosLoading && ethos && ethos.score !== null && ethos.level && (
              <div style={S.ethosBox}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    flexWrap: 'wrap',
                  }}
                >
                  <ScoreRing score={ethos.score} level={ethos.level} />

                  <div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: levelColor,
                        fontFamily: 'ui-monospace,monospace',
                        textTransform: 'capitalize',
                        textShadow: `0 0 16px ${levelColor}55`,
                        letterSpacing: 1,
                      }}
                    >
                      {ethos.level}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.25)',
                        fontFamily: 'ui-monospace,monospace',
                        marginTop: 3,
                      }}
                    >
                      {ethos.score} credibility pts
                    </div>

                    <a
                      href={ethos.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 10,
                        color: 'rgba(0,247,255,0.35)',
                        fontFamily: 'ui-monospace,monospace',
                        textDecoration: 'none',
                        marginTop: 8,
                        display: 'block',
                      }}
                    >
                      view on ethos →
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ethos.vouchCount > 0 && (
                    <div style={S.statChip}>
                      <span style={{ color: '#44aaff' }}>◆</span>
                      {ethos.vouchCount} vouches
                    </div>
                  )}

                  {ethos.reviewPositive > 0 && (
                    <div style={S.statChip}>
                      <span style={{ color: '#00ff88' }}>●</span>
                      {ethos.reviewPositive} positive
                    </div>
                  )}

                  {ethos.reviewNegative > 0 && (
                    <div style={S.statChip}>
                      <span style={{ color: '#ff4444' }}>●</span>
                      {ethos.reviewNegative} negative
                    </div>
                  )}
                </div>
              </div>
            )}

            {!ethosLoading && user.twitter_handle && (!ethos || ethos.score === null) && (
              <div
                style={{
                  color: 'rgba(255,255,255,0.15)',
                  fontSize: 11,
                  fontFamily: 'ui-monospace,monospace',
                  letterSpacing: 1,
                }}
              >
                NOT ON ETHOS.NETWORK YET
              </div>
            )}
          </div>
        </div>

        (Array.isArray(x) ? x.length : 0)
          <div style={S.card}>
            <div style={S.section}>
              <div style={S.label}>▸ RECENT SIGNALS</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                (Array.isArray(recentMsgs) ? recentMsgs : []).map(...)
                  <div key={msg.id} style={S.msgRow}>
                    <span
                      style={{
                        color: 'rgba(0,247,255,0.25)',
                        fontFamily: 'ui-monospace,monospace',
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      &gt;
                    </span>

                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: 'rgba(203,213,245,0.65)',
                        fontFamily: 'ui-monospace,monospace',
                        wordBreak: 'break-word',
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.text || ''}
                    </span>

                    <span
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.12)',
                        fontFamily: 'ui-monospace,monospace',
                        flexShrink: 0,
                      }}
                    >
                      {msg.created_at ? timeAgo(msg.created_at) : ''}
                    </span>
                  </div>
                ))}
              </div>

              {msgCount > 8 && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.12)',
                    fontFamily: 'ui-monospace,monospace',
                    marginTop: 6,
                  }}
                >
                  +{msgCount - 8} more in chat
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 80,
    paddingLeft: 20,
    paddingRight: 20,
    position: 'relative',
    overflow: 'hidden',
  },

  glowA: {
    position: 'fixed',
    top: 0,
    left: '25%',
    width: 700,
    height: 500,
    background: 'radial-gradient(circle, rgba(0,247,255,0.03) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  glowB: {
    position: 'fixed',
    bottom: 0,
    right: '15%',
    width: 600,
    height: 500,
    background: 'radial-gradient(circle, rgba(124,92,255,0.035) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  scanline: {
    position: 'fixed',
    inset: 0,
    background:
      'repeating-linear-gradient(to bottom, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 2px, transparent 4px)',
    opacity: 0.2,
    pointerEvents: 'none',
    zIndex: 0,
  },

  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    marginTop: 100,
    position: 'relative',
    zIndex: 1,
  },

  backBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontFamily: 'ui-monospace,monospace',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    marginBottom: 14,
    padding: 0,
    letterSpacing: 1,
    position: 'relative',
    zIndex: 1,
  },

  card: {
    width: '100%',
    background: 'rgba(10,18,40,0.85)',
    border: '1px solid rgba(120,150,255,0.15)',
    borderRadius: 18,
    backdropFilter: 'blur(18px)',
    boxShadow:
      '0 0 60px rgba(80,120,255,0.1), inset 0 0 30px rgba(20,40,120,0.12)',
    overflow: 'hidden',
    position: 'relative',
  },

  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    padding: '22px 22px 18px',
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 14,
    flexShrink: 0,
    background: 'rgba(0,247,255,0.06)',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 19,
    fontWeight: 700,
    color: '#00f7ff',
    fontFamily: 'ui-monospace,monospace',
  },

  username: {
    fontSize: 21,
    fontWeight: 700,
    color: '#fff',
    fontFamily: 'ui-monospace,monospace',
    marginBottom: 5,
    textShadow: '0 0 16px rgba(0,247,255,0.18)',
  },

  walletRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
    flexWrap: 'wrap',
  },

  walletText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    fontFamily: 'ui-monospace,monospace',
  },

  copyBtn: {
    background: 'none',
    border: '1px solid rgba(120,150,255,0.2)',
    borderRadius: 5,
    color: 'rgba(159,179,255,0.4)',
    fontSize: 10,
    padding: '1px 7px',
    cursor: 'pointer',
    fontFamily: 'ui-monospace,monospace',
  },

  chip: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: 'ui-monospace,monospace',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: '2px 8px',
  },

  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.05)',
    margin: '0 22px',
  },

  section: {
    padding: '18px 22px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  label: {
    fontSize: 9,
    color: 'rgba(0,247,255,0.3)',
    fontFamily: 'ui-monospace,monospace',
    letterSpacing: 3,
    marginBottom: 2,
  },

  twitterBadge: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'ui-monospace,monospace',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '4px 12px',
  },

  ghostBtn: {
    background: 'none',
    border: '1px solid rgba(120,150,255,0.2)',
    borderRadius: 8,
    color: '#9fb3ff',
    fontSize: 11,
    padding: '4px 12px',
    cursor: 'pointer',
    fontFamily: 'ui-monospace,monospace',
  },

  input: {
    flex: 1,
    background: 'rgba(20,30,60,0.6)',
    border: '1px solid rgba(120,150,255,0.2)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'ui-monospace,monospace',
    padding: '7px 12px',
    outline: 'none',
  },

  saveBtn: {
    background: 'rgba(124,92,255,0.18)',
    border: '1px solid rgba(124,92,255,0.35)',
    borderRadius: 8,
    color: '#a78bfa',
    fontSize: 12,
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'ui-monospace,monospace',
  },

  ethosBox: {
    padding: '16px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(120,150,255,0.08)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },

  statChip: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'ui-monospace,monospace',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: '3px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  msgRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 8,
  },
};