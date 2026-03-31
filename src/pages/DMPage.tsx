import { useEffect, useRef, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../lib/supabase';
import {
  getMyThreads,
  getThread,
  openDMThread,
  sendDM,
  getThreadMessages,
  canonicalPair,
} from '../services/dmService';

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

const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(d).toLocaleDateString([], { month: 'long', day: 'numeric' });
};

/* ─── injected CSS for animations + scrollbar ─────────────────────────── */
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

  .dm-root * { box-sizing: border-box; }

  .dm-messages::-webkit-scrollbar { width: 4px; }
  .dm-messages::-webkit-scrollbar-track { background: transparent; }
  .dm-messages::-webkit-scrollbar-thumb { background: rgba(0,247,255,0.15); border-radius: 4px; }

  .dm-sidebar::-webkit-scrollbar { width: 3px; }
  .dm-sidebar::-webkit-scrollbar-track { background: transparent; }
  .dm-sidebar::-webkit-scrollbar-thumb { background: rgba(0,247,255,0.1); border-radius: 3px; }

  .dm-thread-row { transition: background 0.15s, border-color 0.15s; }
  .dm-thread-row:hover { background: rgba(0,247,255,0.04) !important; }

  .dm-send-btn { transition: all 0.15s; }
  .dm-send-btn:not(:disabled):hover {
    background: rgba(0,247,255,0.25) !important;
    box-shadow: 0 0 20px rgba(0,247,255,0.4) !important;
    transform: scale(1.05);
  }

  .dm-bubble-mine { animation: bubbleIn 0.18s ease; }
  .dm-bubble-theirs { animation: bubbleInLeft 0.18s ease; }
  @keyframes bubbleIn {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes bubbleInLeft {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .dm-input-field:focus { outline: none; }
  .dm-input-field::placeholder { color: rgba(200,210,230,0.25); }
  .dm-search-input::placeholder { color: rgba(200,210,230,0.25); }
  .dm-search-input:focus { outline: none; }

  .dm-open-btn { transition: all 0.2s; }
  .dm-open-btn:not(:disabled):hover {
    background: rgba(0,247,255,0.2) !important;
    box-shadow: 0 0 30px rgba(0,247,255,0.3), inset 0 0 20px rgba(0,247,255,0.05) !important;
    transform: translateY(-1px);
  }

  .dm-icon-btn { transition: background 0.15s, color 0.15s; }
  .dm-icon-btn:hover { background: rgba(0,247,255,0.08) !important; color: #00f7ff !important; }
`;

export function DMPage() {
  const { publicKey, sendTransaction } = useWallet();
  const myWallet = publicKey?.toBase58() ?? '';

  const [threads, setThreads] = useState<DMThread[]>([]);
  const [activeThread, setActiveThread] = useState<DMThread | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [threadExists, setThreadExists] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<any>(null);
  const sentIdsRef = useRef<Set<string>>(new Set());

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('dm-global-css')) return;
    const el = document.createElement('style');
    el.id = 'dm-global-css';
    el.textContent = globalCSS;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (!myWallet) return;
    getMyThreads(myWallet).then(setThreads);
    const params = new URLSearchParams(window.location.search);
    const dmTarget = params.get('dm');
    if (dmTarget && dmTarget !== myWallet) {
  setPendingWallet(dmTarget);

  // ✅ ALWAYS show chat pane on mobile
  if (window.innerWidth < 768) {
    setShowSidebar(false);
  }

  getThread(myWallet, dmTarget).then(t => {
    setThreadExists(!!t);

    if (t) {
      setActiveThread(t as DMThread);
    }
  });
}
  }, [myWallet]);

  useEffect(() => {
    if (!activeThread) { setMessages([]); return; }
    getThreadMessages(activeThread.id).then(msgs => {
      setMessages(msgs as DMMessage[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
    });

    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }

    const channel = supabase
      .channel(`dm-${activeThread.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dm_messages',
        filter: `thread_id=eq.${activeThread.id}`,
      }, (payload) => {
        const incoming = payload.new as DMMessage;
        if (sentIdsRef.current.has(incoming.id)) { sentIdsRef.current.delete(incoming.id); return; }
        setMessages(prev => prev.find(m => m.id === incoming.id) ? prev : [...prev, incoming]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } };
  }, [activeThread?.id]);

  const handleOpenThread = useCallback(async () => {
  if (!pendingWallet || !myWallet || loadingOpen) return;

  setLoadingOpen(true);

  try {
    // ✅ VALIDATE WALLET (THIS FIXES _bn ERROR)
    const target = new PublicKey(pendingWallet);

    const threadId = await openDMThread(
      myWallet,
      target.toBase58(),
      sendTransaction as any
    );

    const [a, b] = canonicalPair(myWallet, target.toBase58());

    const newThread = {
      id: threadId,
      participant_a: a,
      participant_b: b,
      created_at: new Date().toISOString(),
    };

    setThreads(prev => [newThread, ...prev]);
    setActiveThread(newThread);
    setThreadExists(true);

    if (isMobile) setShowSidebar(false);

  } catch (e: any) {
    console.error(e);
    alert('Failed: ' + (e.message || 'Invalid wallet'));
  } finally {
    setLoadingOpen(false);
  }
}, [pendingWallet, myWallet, loadingOpen, sendTransaction, isMobile]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeThread || !myWallet || sending) return;
    setSending(true);
    setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      const { data, error } = await supabase
        .from('dm_messages')
        .insert({ thread_id: activeThread.id, sender: myWallet, text: trimmed })
        .select('*').single();
      if (error) throw error;
      sentIdsRef.current.add(data.id);
      setMessages(prev => [...prev, data as DMMessage]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (e: any) { setText(trimmed); alert('Send failed: ' + (e.message ?? e)); }
    finally { setSending(false); inputRef.current?.focus(); }
  }, [text, activeThread, myWallet, sending]);

  const otherWallet = (t: DMThread) => t.participant_a === myWallet ? t.participant_b : t.participant_a;

  const grouped = messages.reduce<{ date: string; msgs: DMMessage[] }[]>((acc, msg) => {
    const d = fmtDate(msg.created_at);
    const last = acc[acc.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else acc.push({ date: d, msgs: [msg] });
    return acc;
  }, []);

  const activeOther = activeThread ? otherWallet(activeThread) : null;

  /* ── no wallet ── */
  if (!myWallet) return (
    <div className="dm-root" style={{ height: 'calc(100vh - 58px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'radial-gradient(ellipse at 50% 0%, rgba(0,247,255,0.06), transparent 60%), #08111a' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🔒</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'rgba(0,247,255,0.4)', letterSpacing: 3 }}>CONNECT WALLET TO ACCESS DMs</div>
    </div>
  );

  return (
    <div className="dm-root" style={S.root}>

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      {(!isMobile || showSidebar) && (
        <aside style={S.sidebar} className="dm-sidebar">

          {/* Header */}
          <div style={S.sidebarHead}>
            <div>
              <div style={S.sidebarTitle}>Messages</div>
              <div style={S.sidebarSub}>⟁ private threads</div>
            </div>
            <button className="dm-icon-btn" style={S.iconBtn} title="New DM">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>

          {/* Search */}
          <div style={S.searchWrap}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'rgba(0,247,255,0.3)', flexShrink: 0 }}>
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input className="dm-search-input" style={S.searchInput} placeholder="Search conversations" />
          </div>

          {/* Thread list */}
          <div style={{ flex: 1, overflowY: 'auto' as const }}>
            {threads.length === 0 && (
              <div style={S.emptyThreads}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>⟁</div>
                <div>No threads yet</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.5 }}>Open one from a profile</div>
              </div>
            )}
            {threads.map(t => {
              const other = otherWallet(t);
              const active = activeThread?.id === t.id;
              return (
                <div
                  key={t.id}
                  className="dm-thread-row"
                  style={S.threadRow(active)}
                  onClick={() => { setActiveThread(t); if (isMobile) setShowSidebar(false); }}
                >
                  <div style={S.threadAvatar(active)}>{other.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={S.threadName(active)}>{short(other)}</span>
                      <span style={S.threadDate}>{new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={S.threadSub}>private · encrypted</div>
                  </div>
                  {active && <div style={S.activePip} />}
                </div>
              );
            })}
          </div>

          {/* Bottom glow line */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,247,255,0.2), transparent)' }} />
        </aside>
      )}

      {/* ═══════════════ CHAT PANE ═══════════════ */}
      {(!isMobile || !showSidebar) && (
        <div style={S.chatPane}>

          {/* ── Empty state ── */}
          {!activeThread && (
  <div
    style={{
      flex: 1,
      minHeight: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      width: '100%',
    }}
  >
    {pendingWallet && !threadExists ? (
      <div style={S.openCard}>
        {/* Glow orb */}
        <div style={S.openOrb} />

        <div
          style={{
            fontSize: 44,
            marginBottom: 16,
            position: 'relative',
            zIndex: 1,
          }}
        >
          🔒
        </div>

        <div style={S.openTitle}>Open Private Thread</div>
        <div style={S.openTarget}>{short(pendingWallet)}</div>

        <div style={S.openNote}>
          First message costs{' '}
          <span style={{ color: '#00f7ff', fontWeight: 700 }}>
            0.001 SOL
          </span>
          <br />
          Thread is free forever after that.
        </div>

        <button
          className="dm-open-btn"
          style={S.openBtn(loadingOpen)}
          onClick={handleOpenThread}
          disabled={loadingOpen}
        >
          {loadingOpen
            ? '> OPENING...'
            : '> OPEN THREAD · 0.001 SOL'}
        </button>
      </div>
    ) : (
      <div
        style={{
          textAlign: 'center',
          color: 'rgba(0,247,255,0.2)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>⟁</div>
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            letterSpacing: 3,
          }}
        >
          SELECT A THREAD
        </div>
      </div>
    )}
  </div>
)}
          {/* ── Active thread ── */}
          {activeThread && activeOther && (
            <>
              {/* Header */}
              <div style={S.chatHeader}>
                {isMobile && (
                  <button style={{ background: 'none', border: 'none', color: '#00f7ff', cursor: 'pointer', padding: '0 8px 0 0', fontSize: 18 }}
                    onClick={() => setShowSidebar(true)}>←</button>
                )}
                <div style={S.headerAvatar}>{activeOther.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={S.headerName}>{short(activeOther)}</div>
                  <div style={S.headerSub}>
                    <span style={{ color: '#00f7ff', marginRight: 4 }}>●</span>
                    private · end-to-end
                  </div>
                </div>
                <button className="dm-icon-btn" style={S.iconBtn}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                </button>
              </div>

              {/* Subtle top line accent */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,247,255,0.15), transparent)', flexShrink: 0 }} />

              {/* Messages */}
              <div className="dm-messages" style={S.messages}>

                {/* Profile top card */}
                <div style={S.profileTop}>
                  <div style={S.profileTopAvatar}>{activeOther.slice(0, 2).toUpperCase()}</div>
                  <div style={S.profileTopName}>{short(activeOther)}</div>
                  <div style={S.profileTopBadge}>🔒 ENCRYPTED THREAD</div>
                </div>

                {grouped.map(group => (
                  <div key={group.date}>
                    {/* Date divider */}
                    <div style={S.dateDivider}>
                      <div style={S.dateLine} />
                      <span style={S.dateLabel}>{group.date}</span>
                      <div style={S.dateLine} />
                    </div>

                    {group.msgs.map((m, i) => {
                      const isMine = m.sender === myWallet;
                      const prev = group.msgs[i - 1];
                      const next = group.msgs[i + 1];
                      const clusterAbove = prev?.sender === m.sender;
                      const clusterBelow = next?.sender === m.sender;
                      const isLast = !clusterBelow;

                      const br = isMine
                        ? `${clusterAbove ? 6 : 18}px 18px ${isLast ? 4 : 18}px 18px`
                        : `18px ${clusterAbove ? 6 : 18}px 18px ${isLast ? 4 : 18}px`;

                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column' as const,
                            alignItems: isMine ? 'flex-end' : 'flex-start',
                            marginBottom: clusterBelow ? 3 : 14,
                            paddingLeft: isMine ? '12%' : 0,
                            paddingRight: isMine ? 0 : '12%',
                          }}
                        >
                          {!isMine && !clusterAbove && (
                            <div style={S.senderTag}>{short(m.sender)}</div>
                          )}

                          <div
                            className={isMine ? 'dm-bubble-mine' : 'dm-bubble-theirs'}
                            style={{ ...S.bubble(isMine), borderRadius: br }}
                          >
                            {m.text}
                          </div>

                          {isLast && (
                            <div style={S.timeStamp(isMine)}>{fmtTime(m.created_at)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div ref={bottomRef} style={{ height: 20 }} />
              </div>

              {/* Input bar */}
              <div style={S.inputBar}>
                <div style={S.inputInner}>
                  <textarea
                    ref={inputRef}
                    className="dm-input-field"
                    style={S.inputField}
                    placeholder="> type a message..."
                    value={text}
                    rows={1}
                    onChange={e => {
                      setText(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                  />
                  <button
                    className="dm-send-btn"
                    style={S.sendBtn(sending || !text.trim())}
                    onClick={handleSend}
                    disabled={sending || !text.trim()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const C = {
  bg: '#08111a',
  bgCard: 'rgba(10,18,35,0.9)',
  border: 'rgba(0,247,255,0.1)',
  borderMid: 'rgba(0,247,255,0.15)',
  cyan: '#00f7ff',
  cyanDim: 'rgba(0,247,255,0.35)',
  text: '#c8d8ec',
  textDim: 'rgba(200,216,236,0.35)',
  bubbleMine: 'linear-gradient(135deg, rgba(0,200,255,0.9) 0%, rgba(0,140,220,0.95) 100%)',
  bubbleTheirs: 'rgba(14,24,44,0.95)',
  mono: "'Space Mono', 'Courier New', monospace",
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const S = {
  root: {
    display: 'flex',
    height: 'calc(100vh - 58px)',
    background: `radial-gradient(ellipse at 15% 0%, rgba(0,247,255,0.06) 0%, transparent 50%),
                 radial-gradient(ellipse at 85% 100%, rgba(124,92,255,0.05) 0%, transparent 50%),
                 ${C.bg}`,
    overflowX: 'hidden',
    overflowY: 'auto',
    position: 'relative' as const,
  } as React.CSSProperties,

  /* Sidebar */
  sidebar: {
    width: 300,
    minWidth: 300,
    borderRight: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'rgba(8,14,26,0.95)',
    backdropFilter: 'blur(20px)',
    overflowY: 'auto' as const,
  },

  sidebarHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 16px',
    borderBottom: `1px solid ${C.border}`,
  },

  sidebarTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e4eeff',
    fontFamily: C.mono,
    letterSpacing: '-0.5px',
  },

  sidebarSub: {
    fontSize: 10,
    color: C.cyanDim,
    fontFamily: C.mono,
    letterSpacing: 2,
    marginTop: 2,
  },

  iconBtn: {
    background: 'rgba(0,247,255,0.04)',
    border: `1px solid ${C.border}`,
    color: C.cyanDim,
    cursor: 'pointer',
    padding: 8,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  searchWrap: {
    margin: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(0,247,255,0.03)',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '9px 14px',
  },

  searchInput: {
    background: 'none',
    border: 'none',
    color: C.text,
    fontSize: 13,
    fontFamily: C.mono,
    width: '100%',
  } as React.CSSProperties,

  emptyThreads: {
    padding: '32px 20px',
    textAlign: 'center' as const,
    color: C.textDim,
    fontFamily: C.mono,
    fontSize: 12,
    letterSpacing: 1,
  },

  threadRow: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 16px',
    cursor: 'pointer',
    background: active ? 'rgba(0,247,255,0.05)' : 'transparent',
    borderLeft: `2px solid ${active ? C.cyan : 'transparent'}`,
    position: 'relative',
  }),

  threadAvatar: (active: boolean): React.CSSProperties => ({
    width: 42,
    height: 42,
    borderRadius: 10,
    background: active ? 'rgba(0,247,255,0.1)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(0,247,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: active ? C.cyan : 'rgba(255,255,255,0.4)',
    fontFamily: C.mono,
    flexShrink: 0,
    boxShadow: active ? '0 0 12px rgba(0,247,255,0.15)' : 'none',
  }),

  threadName: (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 700,
    color: active ? '#e4eeff' : C.text,
    fontFamily: C.mono,
  }),

  threadDate: {
    fontSize: 10,
    color: C.textDim,
    fontFamily: C.mono,
  },

  threadSub: {
    fontSize: 10,
    color: C.textDim,
    fontFamily: C.mono,
    marginTop: 2,
    letterSpacing: 1,
  },

  activePip: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: C.cyan,
    boxShadow: '0 0 6px rgba(0,247,255,0.8)',
    flexShrink: 0,
  },

  /* Chat pane */
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },

  /* Open card */
  openCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    padding: '32px 20px',
    boxSizing: 'border-box'as const,
    background: 'rgba(8,16,32,0.8)',
    border: `1px solid ${C.borderMid}`,
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    position: 'relative' as const,
    overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 0 60px rgba(0,247,255,0.05), inset 0 0 40px rgba(0,247,255,0.02)',
  },

  openOrb: {
    position: 'absolute' as const,
    top: -60,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,247,255,0.12), transparent 70%)',
    pointerEvents: 'none' as const,
  },

  openTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#e4eeff',
    fontFamily: C.mono,
    marginBottom: 6,
    position: 'relative' as const,
    zIndex: 1,
  },

  openTarget: {
    fontSize: 13,
    color: C.cyan,
    fontFamily: C.mono,
    letterSpacing: 2,
    marginBottom: 16,
    position: 'relative' as const,
    zIndex: 1,
  },

  openNote: {
    fontSize: 13,
    color: C.textDim,
    lineHeight: 1.7,
    marginBottom: 24,
    fontFamily: C.sans,
    position: 'relative' as const,
    zIndex: 1,
  },

  openBtn: (loading: boolean): React.CSSProperties => ({
    background: loading ? 'rgba(0,247,255,0.05)' : 'rgba(0,247,255,0.08)',
    border: `1px solid ${loading ? C.border : 'rgba(0,247,255,0.4)'}`,
    color: loading ? C.cyanDim : C.cyan,
    borderRadius: 10,
    padding: '13px 28px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: C.mono,
    letterSpacing: 2,
    cursor: loading ? 'not-allowed' : 'pointer',
    position: 'relative' as const,
    zIndex: 1,
    boxShadow: loading ? 'none' : '0 0 20px rgba(0,247,255,0.1)',
  }),

  /* Chat header */
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    borderBottom: `1px solid ${C.border}`,
    background: 'rgba(8,14,26,0.7)',
    backdropFilter: 'blur(16px)',
    flexShrink: 0,
  },

  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'rgba(0,247,255,0.08)',
    border: '1px solid rgba(0,247,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: C.cyan,
    fontFamily: C.mono,
    flexShrink: 0,
    boxShadow: '0 0 10px rgba(0,247,255,0.1)',
  },

  headerName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e4eeff',
    fontFamily: C.mono,
    letterSpacing: 1,
  },

  headerSub: {
    fontSize: 10,
    color: C.cyanDim,
    fontFamily: C.mono,
    letterSpacing: 1,
    marginTop: 2,
  },

  /* Messages */
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 24px',
  },

  profileTop: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '40px 0 28px',
    gap: 8,
  },

  profileTopAvatar: {
    width: 60,
    height: 60,
    borderRadius: 14,
    background: 'rgba(0,247,255,0.06)',
    border: '1px solid rgba(0,247,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: C.cyan,
    fontFamily: C.mono,
    boxShadow: '0 0 20px rgba(0,247,255,0.08)',
    marginBottom: 4,
  },

  profileTopName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e4eeff',
    fontFamily: C.mono,
    letterSpacing: 1,
  },

  profileTopBadge: {
    fontSize: 9,
    color: 'rgba(0,247,255,0.35)',
    fontFamily: C.mono,
    letterSpacing: 3,
    background: 'rgba(0,247,255,0.04)',
    border: '1px solid rgba(0,247,255,0.1)',
    borderRadius: 6,
    padding: '3px 10px',
  },

  dateDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '24px 0 18px',
  },

  dateLine: {
    flex: 1,
    height: 1,
    background: 'rgba(0,247,255,0.08)',
  },

  dateLabel: {
    fontSize: 10,
    color: 'rgba(0,247,255,0.3)',
    fontFamily: C.mono,
    letterSpacing: 2,
    whiteSpace: 'nowrap' as const,
    textTransform: 'uppercase' as const,
  },

  senderTag: {
    fontSize: 10,
    color: C.cyanDim,
    fontFamily: C.mono,
    letterSpacing: 1,
    marginBottom: 5,
    paddingLeft: 4,
  },

  bubble: (isMine: boolean): React.CSSProperties => ({
    display: 'inline-block',
    maxWidth: '100%',
    background: isMine
      ? 'linear-gradient(135deg, rgba(0,180,240,0.85), rgba(0,120,200,0.9))'
      : 'rgba(12,22,42,0.9)',
    border: isMine ? 'none' : '1px solid rgba(0,247,255,0.08)',
    padding: '11px 16px',
    fontSize: 14,
    lineHeight: 1.55,
    color: isMine ? '#fff' : C.text,
    wordBreak: 'break-word' as const,
    backdropFilter: 'blur(8px)',
    boxShadow: isMine
      ? '0 4px 24px rgba(0,160,220,0.2)'
      : '0 2px 10px rgba(0,0,0,0.3)',
  }),

  timeStamp: (isMine: boolean): React.CSSProperties => ({
    fontSize: 10,
    color: 'rgba(0,247,255,0.25)',
    fontFamily: C.mono,
    marginTop: 5,
    letterSpacing: 1,
    alignSelf: isMine ? 'flex-end' : 'flex-start',
    paddingLeft: isMine ? 0 : 4,
    paddingRight: isMine ? 4 : 0,
  }),

  /* Input */
  inputBar: {
    padding: '14px 20px',
    borderTop: `1px solid ${C.border}`,
    background: 'rgba(8,14,26,0.85)',
    backdropFilter: 'blur(16px)',
    flexShrink: 0,
  },

  inputInner: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    background: 'rgba(0,247,255,0.03)',
    border: `1px solid rgba(0,247,255,0.12)`,
    borderRadius: 12,
    padding: '10px 10px 10px 16px',
    transition: 'border-color 0.2s',
  },

  inputField: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: C.text,
    fontSize: 14,
    fontFamily: C.mono,
    resize: 'none' as const,
    lineHeight: 1.6,
    maxHeight: 120,
    padding: 0,
  } as React.CSSProperties,

  sendBtn: (disabled: boolean): React.CSSProperties => ({
    width: 38,
    height: 38,
    borderRadius: 10,
    background: disabled ? 'rgba(0,247,255,0.04)' : 'rgba(0,247,255,0.1)',
    border: `1px solid ${disabled ? 'rgba(0,247,255,0.08)' : 'rgba(0,247,255,0.3)'}`,
    color: disabled ? 'rgba(0,247,255,0.2)' : C.cyan,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: disabled ? 'none' : '0 0 12px rgba(0,247,255,0.15)',
  }),
};

