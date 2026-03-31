// src/pages/LaunchPage.tsx
// ⟁ SOLCHAT — Token Launch Page
// Integrates with Bags API to create + deploy Solana tokens
// To wire up real API: search for "BAGS_API" comments below

import { useState, useRef, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TokenForm {
  name: string;
  ticker: string;
  description: string;
  image: File | null;
  imagePreview: string | null;
  twitter: string;
  website: string;
}

interface LaunchResult {
  contractAddress: string;
  name: string;
  ticker: string;
  txSignature: string;
  imagePreview: string | null;
}

async function callBagsAPI(
  form: TokenForm,
  walletAddress: string
): Promise<{ transaction: string; mint: string }> {

  const formData = new FormData();
  formData.append('name', form.name);
  formData.append('symbol', form.ticker);
  formData.append('description', form.description || '');
  formData.append('twitter', form.twitter || '');
  formData.append('website', form.website || '');
  formData.append('wallet', walletAddress);

  if (form.image) {
    formData.append('file', form.image);
  }

  const res = await fetch('https://api.bags.fm/v1/token/create', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer bags_prod_wk9HuZZHjHLFZrnnh4XaS6lIsGBZnXU6kSYyPgt4-cE'
  },
  body: formData,
});

  if (!res.ok) {
    throw new Error('Bags API failed');
  }

  const data = await res.json();

  return {
    transaction: data.transaction,
    mint: data.mint || data.tokenAddress || data.ca
  };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

.lp * { box-sizing: border-box; }
.lp { font-family: 'Space Mono', 'Courier New', monospace; }
.lp ::-webkit-scrollbar { width: 4px; }
.lp ::-webkit-scrollbar-thumb { background: rgba(0,247,255,0.15); border-radius: 2px; }

.lp-input {
  width: 100%;
  background: rgba(0,247,255,0.03);
  border: 1px solid rgba(0,247,255,0.12);
  border-radius: 10px;
  color: #c8d8ec;
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  padding: 12px 16px;
  outline: none;
  transition: border-color .2s, box-shadow .2s;
  resize: none;
}
.lp-input:focus {
  border-color: rgba(0,247,255,0.35);
  box-shadow: 0 0 0 1px rgba(0,247,255,0.1);
}
.lp-input::placeholder { color: rgba(200,218,236,0.22); }

.lp-launch-btn {
  transition: all .2s;
  cursor: pointer;
}
.lp-launch-btn:not(:disabled):hover {
  background: rgba(0,247,255,0.18) !important;
  box-shadow: 0 0 30px rgba(0,247,255,0.3), 0 0 0 1px rgba(0,247,255,0.4) !important;
  transform: translateY(-1px);
}
.lp-launch-btn:not(:disabled):active { transform: scale(0.98); }

.lp-drop:hover { border-color: rgba(0,247,255,0.4) !important; background: rgba(0,247,255,0.06) !important; }

@keyframes lp-fadein { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
.lp-fadein { animation: lp-fadein .3s ease; }

@keyframes lp-spin { to { transform: rotate(360deg); } }
.lp-spin { animation: lp-spin .8s linear infinite; display: inline-block; }

@keyframes lp-success-pop {
  0%   { opacity:0; transform: scale(0.85); }
  60%  { transform: scale(1.03); }
  100% { opacity:1; transform: scale(1); }
}
.lp-success { animation: lp-success-pop .4s cubic-bezier(0.34,1.56,0.64,1); }

@keyframes lp-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
.lp-pulse { animation: lp-pulse 2s infinite; }

.lp-copy-btn { transition: all .15s; }
.lp-copy-btn:hover { background: rgba(0,247,255,0.15) !important; }

.lp-field-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  color: rgba(0,247,255,0.5);
  margin-bottom: 7px;
  display: block;
}
`;

// ─── Inject CSS ───────────────────────────────────────────────────────────────
if (!document.getElementById('lp-css')) {
  const s = document.createElement('style');
  s.id = 'lp-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PreviewCard({ form }: { form: TokenForm }) {
  const hasContent = form.name || form.ticker || form.imagePreview;

  return (
    <div style={{ background: 'rgba(7,14,28,0.9)', border: '1px solid rgba(0,247,255,0.1)', borderRadius: 16, overflow: 'hidden', position: 'sticky' as const, top: 20 }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,247,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'rgba(0,247,255,0.4)', letterSpacing: 3, fontWeight: 700 }}>LIVE PREVIEW</span>
        <span className="lp-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f7ff', display: 'inline-block', boxShadow: '0 0 6px #00f7ff', marginLeft: 'auto' }} />
      </div>

      {/* Token card preview */}
      <div style={{ padding: '24px 20px' }}>
        {/* Image */}
        <div style={{ width: 80, height: 80, borderRadius: 16, margin: '0 auto 16px', background: form.imagePreview ? 'transparent' : 'rgba(0,247,255,0.05)', border: `2px solid rgba(0,247,255,0.15)`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
          {form.imagePreview
            ? <img src={form.imagePreview} alt="token" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ opacity: .3 }}>⟁</span>
          }
        </div>

        {/* Name + ticker */}
        <div style={{ textAlign: 'center' as const, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: form.name ? '#e4eeff' : 'rgba(255,255,255,0.15)', marginBottom: 4 }}>
            {form.name || 'Token Name'}
          </div>
          <div style={{ fontSize: 12, color: form.ticker ? '#00f7ff' : 'rgba(0,247,255,0.2)', letterSpacing: 2, fontWeight: 700 }}>
            ${form.ticker || 'TICKER'}
          </div>
        </div>

        {/* Description */}
        {form.description && (
          <div style={{ fontSize: 12, color: 'rgba(200,218,236,0.5)', textAlign: 'center' as const, lineHeight: 1.5, marginBottom: 16, maxHeight: 60, overflow: 'hidden' }}>
            {form.description.slice(0, 100)}{form.description.length > 100 ? '…' : ''}
          </div>
        )}

        {/* Links */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' as const }}>
          {form.twitter && (
            <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.5)', background: 'rgba(0,247,255,0.05)', border: '1px solid rgba(0,247,255,0.12)', borderRadius: 6, padding: '3px 8px' }}>𝕏</div>
          )}
          {form.website && (
            <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.5)', background: 'rgba(0,247,255,0.05)', border: '1px solid rgba(0,247,255,0.12)', borderRadius: 6, padding: '3px 8px' }}>🌐</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(0,247,255,0.07)', margin: '16px 0' }} />

        {/* Mock market stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'SUPPLY', value: '1,000,000,000' },
            { label: 'NETWORK', value: 'Solana' },
            { label: 'DECIMALS', value: '6' },
            { label: 'PLATFORM', value: 'Bags' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(0,247,255,0.02)', border: '1px solid rgba(0,247,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 8, color: 'rgba(0,247,255,0.3)', letterSpacing: 2, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'rgba(200,218,236,0.7)', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ result, onBack }: { result: LaunchResult; onBack: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(result.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '40px 20px' }}>
      <div className="lp-success" style={{ maxWidth: 480, width: '100%', background: 'rgba(7,14,28,0.95)', border: '1px solid rgba(0,247,255,0.15)', borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(20px)', boxShadow: '0 0 60px rgba(0,247,255,0.08)' }}>

        {/* Top glow */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #00f7ff, transparent)' }} />

        <div style={{ padding: '36px 32px' }}>
          {/* Success icon */}
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px', boxShadow: '0 0 20px rgba(0,247,255,0.15)' }}>
            🚀
          </div>

          <div style={{ textAlign: 'center' as const, marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e4eeff', marginBottom: 6 }}>Token Launched!</div>
            <div style={{ fontSize: 12, color: 'rgba(0,247,255,0.4)', letterSpacing: 1 }}>
              ${result.ticker} · {result.name}
            </div>
          </div>

          {/* Token image */}
          {result.imagePreview && (
            <div style={{ width: 72, height: 72, borderRadius: 14, margin: '0 auto 24px', overflow: 'hidden', border: '2px solid rgba(0,247,255,0.2)' }}>
              <img src={result.imagePreview} alt={result.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* Contract address */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.3)', letterSpacing: 3, marginBottom: 8, fontWeight: 700 }}>CONTRACT ADDRESS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,247,255,0.03)', border: '1px solid rgba(0,247,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
              <span style={{ flex: 1, fontSize: 11, color: '#00f7ff', wordBreak: 'break-all' as const, lineHeight: 1.5 }}>
                {result.contractAddress}
              </span>
              <button
                className="lp-copy-btn"
                onClick={copy}
                style={{ background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.2)', borderRadius: 7, color: '#00f7ff', fontSize: 10, padding: '5px 10px', cursor: 'pointer', fontFamily: "'Space Mono',monospace", letterSpacing: 1, flexShrink: 0, fontWeight: 700, transition: 'all .15s' }}
              >
                {copied ? '✓' : 'COPY'}
              </button>
            </div>
          </div>

          {/* TX signature */}
          {result.txSignature !== 'MOCK_TX_BASE64' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.3)', letterSpacing: 3, marginBottom: 8, fontWeight: 700 }}>TRANSACTION</div>
              <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.4)', wordBreak: 'break-all' as const, lineHeight: 1.5, padding: '8px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                {result.txSignature.slice(0, 40)}...
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            <a
              href={`https://solscan.io/token/${result.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', textAlign: 'center' as const, padding: '12px', background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.25)', borderRadius: 10, color: '#00f7ff', fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono',monospace", letterSpacing: 1, textDecoration: 'none' }}
            >
              VIEW ON SOLSCAN ↗
            </a>
            <a
              href={`https://dexscreener.com/solana/${result.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', textAlign: 'center' as const, padding: '12px', background: 'transparent', border: '1px solid rgba(0,247,255,0.12)', borderRadius: 10, color: 'rgba(0,247,255,0.5)', fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono',monospace", letterSpacing: 1, textDecoration: 'none' }}
            >
              VIEW ON DEXSCREENER ↗
            </a>
            <button
              onClick={onBack}
              style={{ padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, color: 'rgba(200,218,236,0.4)', fontSize: 12, fontFamily: "'Space Mono',monospace", letterSpacing: 1, cursor: 'pointer', fontWeight: 700 }}
            >
              ← BACK TO SOLCHAT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main LaunchPage ──────────────────────────────────────────────────────────
export default function LaunchPage() {
  const navigate = useNavigate();
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [form, setForm] = useState<TokenForm>({
    name: '', ticker: '', description: '',
    image: null, imagePreview: null,
    twitter: '', website: '',
  });
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<'form' | 'signing' | 'confirming'>('form');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  return () => {
    if (form.imagePreview) {
      URL.revokeObjectURL(form.imagePreview);
    }
  };
}, [form.imagePreview]);

  const walletAddr = publicKey?.toBase58() ?? '';
  const canLaunch = !launching && !!publicKey && !!form.name && !!form.ticker && !!form.image;

  const handleImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
    const preview = URL.createObjectURL(file);
    setForm(f => ({ ...f, image: file, imagePreview: preview }));
    setError(null);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImage(file);
  };

  const handleLaunch = async () => {
  if (!canLaunch || !publicKey) return;

  setError(null);
  setLaunching(true);

  try {
    // 🔒 Balance check
    const balance = await connection.getBalance(publicKey);
    if (balance < 0.01 * 1e9) {
      throw new Error("Not enough SOL to launch token");
    }

    // Step 1: Call Bags API
    setStep('signing');
    const { transaction: txBase64, mint } = await callBagsAPI(form, walletAddr);

    // Step 2: Decode transaction
    const txBuffer = Buffer.from(txBase64, 'base64');

    let tx;
    try {
      tx = VersionedTransaction.deserialize(txBuffer);
    } catch {
      tx = Transaction.from(txBuffer);
    }

    // Step 3: Send transaction
    setStep('confirming');

    let signature;
    try {
      signature = await sendTransaction(tx, connection);
    } catch (err) {
      throw new Error("Transaction rejected by user");
    }

    // Step 4: Confirm
    await connection.confirmTransaction(signature, 'confirmed');

    // Step 5: Success
    setResult({
      contractAddress: mint,
      name: form.name,
      ticker: form.ticker,
      txSignature: signature,
      imagePreview: form.imagePreview,
    });

  } catch (e: any) {
    setError(e?.message || "Launch failed");
    setStep('form');
  } finally {
    setLaunching(false);
  }
};

  // ── Success screen ───────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="lp" style={{ minHeight: '100vh', background: `radial-gradient(ellipse at 50% 0%, rgba(0,247,255,0.06), transparent 50%), #05101e` }}>
        <SuccessModal result={result} onBack={() => navigate('/chat')} />
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="lp" style={{ minHeight: '100vh', background: `radial-gradient(ellipse at 20% 0%, rgba(0,247,255,0.05), transparent 45%), radial-gradient(ellipse at 80% 80%, rgba(124,92,255,0.04), transparent 45%), #05101e`, color: '#c8d8ec' }}>

      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: 0, left: '30%', width: 600, height: 400, background: 'radial-gradient(circle, rgba(0,247,255,0.04), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px', position: 'relative', zIndex: 1 }}>

        {/* Back button */}
        <button onClick={() => navigate('/chat')}
          style={{ background: 'none', border: 'none', color: 'rgba(0,247,255,0.4)', cursor: 'pointer', fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: 1, marginBottom: 24, padding: 0 }}>
          ← back to chat
        </button>

        {/* Page header */}
        <div className="lp-fadein" style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 0 14px rgba(0,247,255,0.12)' }}>🚀</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#e4eeff', letterSpacing: -0.5 }}>Launch Your Token</h1>
              <div style={{ fontSize: 11, color: 'rgba(0,247,255,0.4)', letterSpacing: 2, marginTop: 2 }}>CREATE AND DEPLOY INSTANTLY ON SOLANA</div>
            </div>
          </div>

          {/* Wallet status */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: publicKey ? 'rgba(0,247,255,0.05)' : 'rgba(255,100,100,0.05)', border: `1px solid ${publicKey ? 'rgba(0,247,255,0.15)' : 'rgba(255,100,100,0.15)'}`, borderRadius: 8, padding: '6px 14px', marginTop: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: publicKey ? '#00f7ff' : '#ff6464', boxShadow: publicKey ? '0 0 6px #00f7ff' : '0 0 6px #ff6464', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: publicKey ? 'rgba(0,247,255,0.7)' : 'rgba(255,100,100,0.7)', letterSpacing: 1 }}>
              {publicKey ? `${walletAddr.slice(0,4)}...${walletAddr.slice(-4)} connected` : 'Wallet not connected'}
            </span>
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, alignItems: 'start' }}>

          {/* ── LEFT: Form ── */}
          <div className="lp-fadein" style={{ background: 'rgba(7,14,28,0.92)', border: '1px solid rgba(0,247,255,0.09)', borderRadius: 18, overflow: 'hidden', backdropFilter: 'blur(20px)' }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(0,247,255,0.4), transparent)' }} />

            <div style={{ padding: '28px 28px' }}>
              <div style={{ fontSize: 11, color: 'rgba(0,247,255,0.3)', letterSpacing: 3, marginBottom: 24, fontWeight: 700 }}>TOKEN DETAILS</div>

              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 20 }}>

                {/* Name + Ticker row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14 }}>
                  <div>
                    <label className="lp-field-label">TOKEN NAME *</label>
                    <input
                      className="lp-input"
                      placeholder="e.g. Solana Doge"
                      value={form.name}
                      maxLength={32}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="lp-field-label">TICKER *</label>
                    <input
                      className="lp-input"
                      placeholder="SDOGE"
                      value={form.ticker}
                      maxLength={6}
                      onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                    />
                    <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.25)', marginTop: 5 }}>{form.ticker.length}/6 chars</div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="lp-field-label">DESCRIPTION</label>
                  <textarea
                    className="lp-input"
                    placeholder="Tell the world about your token..."
                    value={form.description}
                    maxLength={500}
                    rows={4}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.25)', marginTop: 5 }}>{form.description.length}/500</div>
                </div>

                {/* Image upload */}
                <div>
                  <label className="lp-field-label">TOKEN IMAGE *</label>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />

                  {form.imagePreview ? (
                    // Image preview
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'rgba(0,247,255,0.03)', border: '1px solid rgba(0,247,255,0.12)', borderRadius: 12 }}>
                      <img src={form.imagePreview} alt="preview" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(0,247,255,0.2)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#00f7ff', fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{form.image?.name}</div>
                        <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.35)' }}>{form.image ? (form.image.size / 1024).toFixed(0) + ' KB' : ''}</div>
                      </div>
                      <button onClick={() => { setForm(f => ({ ...f, image: null, imagePreview: null })); if (fileRef.current) fileRef.current.value = ''; }}
                        style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 7, color: 'rgba(255,120,120,0.8)', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>
                        ✕ remove
                      </button>
                    </div>
                  ) : (
                    // Drop zone
                    <div
                      className="lp-drop"
                      onClick={() => fileRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      style={{ border: `2px dashed ${dragOver ? 'rgba(0,247,255,0.5)' : 'rgba(0,247,255,0.15)'}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center' as const, cursor: 'pointer', background: dragOver ? 'rgba(0,247,255,0.05)' : 'transparent', transition: 'all .2s' }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 10 }}>🖼️</div>
                      <div style={{ fontSize: 13, color: 'rgba(200,218,236,0.6)', marginBottom: 4 }}>Drop image here or click to browse</div>
                      <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.3)', letterSpacing: 1 }}>PNG, JPG, GIF · MAX 5MB</div>
                    </div>
                  )}
                </div>

                {/* Optional fields */}
                <div style={{ borderTop: '1px solid rgba(0,247,255,0.06)', paddingTop: 20 }}>
                  <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.25)', letterSpacing: 3, marginBottom: 16, fontWeight: 700 }}>OPTIONAL LINKS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="lp-field-label">TWITTER / X</label>
                      <input className="lp-input" placeholder="https://x.com/..." value={form.twitter} onChange={e => setForm(f => ({ ...f, twitter: e.target.value }))} />
                    </div>
                    <div>
                      <label className="lp-field-label">WEBSITE</label>
                      <input className="lp-input" placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ padding: '12px 16px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, fontSize: 12, color: 'rgba(255,130,130,0.9)' }}>
                    ⚠ {error}
                  </div>
                )}

                {/* Launch button */}
                <button
                  className="lp-launch-btn"
                  onClick={handleLaunch}
                  disabled={!canLaunch}
                  style={{
                    width: '100%', padding: '16px',
                    background: canLaunch ? 'rgba(0,247,255,0.1)' : 'rgba(0,247,255,0.03)',
                    border: `1px solid ${canLaunch ? 'rgba(0,247,255,0.35)' : 'rgba(0,247,255,0.08)'}`,
                    borderRadius: 12,
                    color: canLaunch ? '#00f7ff' : 'rgba(0,247,255,0.25)',
                    fontSize: 14, fontWeight: 700,
                    fontFamily: "'Space Mono',monospace",
                    letterSpacing: 2,
                    cursor: canLaunch ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: canLaunch ? '0 0 20px rgba(0,247,255,0.08)' : 'none',
                    transition: 'all .2s',
                  }}
                >
                  {launching ? (
                    <>
                      <span className="lp-spin">⟁</span>
                      {step === 'signing' ? 'WAITING FOR SIGNATURE...' : 'CONFIRMING ON-CHAIN...'}
                    </>
                  ) : !publicKey ? (
                    '⚠ CONNECT WALLET FIRST'
                  ) : (
                    '🚀 LAUNCH TOKEN'
                  )}
                </button>

                {/* Disclaimer */}
                {canLaunch && (
                  <div style={{ fontSize: 10, color: 'rgba(0,247,255,0.2)', textAlign: 'center' as const, lineHeight: 1.6, letterSpacing: .5 }}>
                    Launching creates a token on Solana mainnet via Bags platform.<br />
                    This action is irreversible. Make sure all details are correct.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Preview ── */}
          <div className="lp-fadein">
            <PreviewCard form={form} />

            {/* Info card */}
            <div style={{ marginTop: 16, background: 'rgba(7,14,28,0.7)', border: '1px solid rgba(0,247,255,0.07)', borderRadius: 14, padding: '18px' }}>
              <div style={{ fontSize: 9, color: 'rgba(0,247,255,0.3)', letterSpacing: 3, marginBottom: 14, fontWeight: 700 }}>HOW IT WORKS</div>
              {[
                ['01', 'Fill in token details'],
                ['02', 'Upload token image'],
                ['03', 'Click Launch Token'],
                ['04', 'Sign with your wallet'],
                ['05', 'Token deployed on Solana'],
              ].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 9, color: '#00f7ff', fontWeight: 700, letterSpacing: 1, flexShrink: 0, marginTop: 2 }}>{n}</span>
                  <span style={{ fontSize: 11, color: 'rgba(200,218,236,0.5)', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
