import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { supabase } from '../lib/supabase';
import { publicKey } from '@metaplex-foundation/umi/serializers';

type Step = 'form' | 'launching' | 'success' | 'error';
interface Form {
  name:string; symbol:string; description:string; imageUrl:string;
  website:string; twitter:string; telegram:string; initialBuy:string;
}
const EMPTY:Form = { name:'',symbol:'',description:'',imageUrl:'',website:'',twitter:'',telegram:'',initialBuy:'0' };
const mono = 'ui-monospace,"Space Mono",monospace';

function Field({ label, hint, children }:{ label:string; hint?:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
        <label style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',fontFamily:mono,letterSpacing:2,textTransform:'uppercase' as const }}>{label}</label>
        {hint && <span style={{ fontSize:10,color:'rgba(255,255,255,0.18)',fontFamily:mono }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
const inp:React.CSSProperties = { width:'100%',background:'rgba(12,20,44,0.8)',border:'1px solid rgba(0,247,255,0.1)',borderRadius:8,color:'#fff',fontSize:14,fontFamily:mono,padding:'11px 14px',outline:'none',boxSizing:'border-box' as const };

async function deserializeAndSign(b58tx: string, signFn: (tx: any) => Promise<any>): Promise<Uint8Array> {
  const bytes = bs58.decode(b58tx);
  try {
    const tx = VersionedTransaction.deserialize(bytes);
    const signed = await signFn(tx);
    return signed.serialize();
  } catch {
    const tx = Transaction.from(bytes);
    const signed = await signFn(tx);
    return signed.serialize();
  }
}

export default function LaunchPage() {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const wallet = useWallet();
  const isMobile = window.innerWidth < 768;

  const [step, setStep]   = useState<Step>('form');
  const [form, setForm]   = useState<Form>(EMPTY);
  const [preview, setPreview] = useState('');
  const [imgB64, setImgB64]   = useState('');
  const [imgMime, setImgMime] = useState('');
  const [mintAddr, setMintAddr] = useState('');
  const [txSig, setTxSig]   = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [logs, setLogs]     = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const log = (msg: string) => setLogs(p => [...p, msg]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setImgMime(f.type);
    const r = new FileReader();
    r.onload = () => { const res = r.result as string; setPreview(res); setImgB64(res.split(',')[1]??''); };
    r.readAsDataURL(f);
  }

  function validate(): string|null {
    if (!form.name.trim())        return 'Token name required';
    if (!form.symbol.trim())      return 'Ticker symbol required';
    if (form.symbol.length > 10)  return 'Symbol max 10 chars';
    if (!form.description.trim()) return 'Description required';
    if (!preview && !form.imageUrl.trim()) return 'Token image required';
    if (!wallet.publicKey)        return 'Connect your wallet first';
    if (!wallet.signTransaction)  return 'Wallet does not support signing';
    return null;
  }

  async function handleLaunch() {
  const err = validate();
  if (err) {
    setErrMsg(err);
    return;
  }

  setErrMsg('');
  setLogs([]);
  setStep('launching');

  try {
    log('Creating token metadata...');

    // ✅ FIXED BODY
    const launchBody = {
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      imageBase64: imgB64 || undefined,
      imageMimeType: imgMime || undefined,
      website: form.website.trim() || undefined,
      twitter: form.twitter.trim() || undefined,
      telegram: form.telegram.trim() || undefined,
      initialBuyLamports: Math.round(
        parseFloat(form.initialBuy || '0') * LAMPORTS_PER_SOL
      ),
      payerPublicKey: wallet.publicKey!.toBase58(),
    };

    console.log("LAUNCH BODY:", launchBody);

    // ✅ FIXED INVOKE
    const { data, error } = await supabase.functions.invoke('bags-launch', {
      body: launchBody,
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (error) {
      console.error("SUPABASE ERROR:", error);

      try {
        const text = await error.context?.json();
        console.error("EDGE DEBUG:", text);
      } catch {
        console.error("No debug body");
      }

      throw new Error(error.message);
    }

    if (!data?.success) {
      console.error("EDGE FUNCTION ERROR:", data);
      throw new Error(data?.debug || data?.error || "Launch failed");
    }

    console.log('[Launch] Response:', data);

    // ✅ CONFIG TX (optional)
    if (data.configTransactions?.length > 0) {
      log(`Signing ${data.configTransactions.length} config tx(s)...`);
      for (const b58 of data.configTransactions) {
        const serialized = await deserializeAndSign(b58, wallet.signTransaction!);
        await connection.sendRawTransaction(serialized);
      }
    }

    // ✅ MAIN TX
    log('Sign launch transaction...');
    const serialized = await deserializeAndSign(
      data.launchTransaction,
      wallet.signTransaction!
    );

    const sig = await connection.sendRawTransaction(serialized);
    await connection.confirmTransaction(sig, 'confirmed');

    setTxSig(sig);
    setMintAddr(data.tokenMint ?? '');
    log('Token launched!');
    setStep('success');

  } catch (e: any) {
    console.error('[Launch ERROR]', e);
    setErrMsg(e?.message || 'Launch failed');
    setStep('error');
  }
}

  const card:React.CSSProperties = { background:'rgba(8,15,30,0.92)',border:'1px solid rgba(0,247,255,0.1)',borderRadius:18,backdropFilter:'blur(20px)',boxShadow:'0 0 50px rgba(0,100,255,0.07)',overflow:'hidden' };

  if (step==='launching') return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ ...card,maxWidth:400,width:'100%' }}>
        <div style={{ height:2,background:'linear-gradient(90deg,transparent,rgba(0,247,255,0.6),transparent)' }} />
        <div style={{ padding:'36px 28px',textAlign:'center' }}>
          <div style={{ fontSize:36,opacity:0.2,marginBottom:16 }}>⟁</div>
          <div style={{ fontSize:16,fontWeight:700,color:'#00f7ff',fontFamily:mono,letterSpacing:3,marginBottom:18 }}>LAUNCHING</div>
          <div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:14,textAlign:'left' as const }}>
            {logs.map((l,i) => <div key={i} style={{ fontSize:12,color:i===logs.length-1?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.2)',fontFamily:mono }}>{i===logs.length-1?'▸ ':'✓ '}{l}</div>)}
          </div>
          <div style={{ fontSize:11,color:'rgba(255,255,255,0.12)',fontFamily:mono }}>Do not close this window</div>
        </div>
      </div>
    </div>
  );

  if (step==='success') return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ ...card,maxWidth:440,width:'100%' }}>
        <div style={{ height:2,background:'linear-gradient(90deg,transparent,rgba(0,255,136,0.7),transparent)' }} />
        <div style={{ padding:'36px 28px',textAlign:'center' }}>
          <div style={{ fontSize:36,marginBottom:14 }}>⟁</div>
          <div style={{ fontSize:18,fontWeight:700,color:'#00ff88',fontFamily:mono,letterSpacing:2,marginBottom:8 }}>TOKEN LAUNCHED</div>
          <div style={{ fontSize:13,color:'rgba(255,255,255,0.3)',fontFamily:mono,marginBottom:24 }}>${form.symbol.toUpperCase()} is live on Solana</div>
          {mintAddr && (
            <div style={{ background:'rgba(0,255,136,0.04)',border:'1px solid rgba(0,255,136,0.1)',borderRadius:10,padding:'12px 14px',marginBottom:18 }}>
              <div style={{ fontSize:9,color:'rgba(0,255,136,0.4)',fontFamily:mono,letterSpacing:3,marginBottom:6 }}>MINT ADDRESS</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.4)',fontFamily:mono,wordBreak:'break-all' as const,lineHeight:1.6 }}>{mintAddr}</div>
              <button onClick={()=>navigator.clipboard.writeText(mintAddr)} style={{ marginTop:8,background:'none',border:'1px solid rgba(0,255,136,0.15)',borderRadius:6,color:'rgba(0,255,136,0.5)',fontSize:10,fontFamily:mono,padding:'3px 10px',cursor:'pointer' }}>copy</button>
            </div>
          )}
          <div style={{ display:'flex',gap:10,marginBottom:18 }}>
            {mintAddr && <a href={`https://bags.fm/token/${mintAddr}`} target="_blank" rel="noopener noreferrer" style={{ flex:1,padding:'11px',borderRadius:10,border:'1px solid rgba(0,247,255,0.3)',background:'rgba(0,247,255,0.06)',color:'#00f7ff',fontFamily:mono,fontSize:12,textDecoration:'none',textAlign:'center' as const,fontWeight:700,letterSpacing:1 }}>VIEW ON BAGS →</a>}
            {txSig && <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer" style={{ flex:1,padding:'11px',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.3)',fontFamily:mono,fontSize:12,textDecoration:'none',textAlign:'center' as const,letterSpacing:1 }}>SOLSCAN ↗</a>}
          </div>
          <button onClick={()=>{ setForm(EMPTY);setPreview('');setImgB64('');setTxSig('');setMintAddr('');setStep('form'); }} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.2)',fontFamily:mono,fontSize:12,cursor:'pointer' }}>launch another</button>
        </div>
      </div>
    </div>
  );

  if (step==='error') return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div style={{ ...card,maxWidth:400,width:'100%' }}>
        <div style={{ height:2,background:'linear-gradient(90deg,transparent,rgba(255,60,60,0.6),transparent)' }} />
        <div style={{ padding:'36px 28px',textAlign:'center' }}>
          <div style={{ fontSize:16,fontWeight:700,color:'#ff5555',fontFamily:mono,letterSpacing:2,marginBottom:14 }}>LAUNCH FAILED</div>
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.3)',fontFamily:mono,marginBottom:24,lineHeight:1.6 }}>{errMsg}</div>
          <button onClick={()=>setStep('form')} style={{ padding:'11px 24px',borderRadius:10,border:'1px solid rgba(255,85,85,0.3)',background:'rgba(255,85,85,0.06)',color:'#ff7777',fontFamily:mono,fontSize:13,cursor:'pointer',letterSpacing:2,fontWeight:700 }}>TRY AGAIN</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh',padding:isMobile?'18px 14px 80px':'28px 20px 80px',position:'relative' }}>
      <div style={{ position:'fixed',top:0,left:'20%',width:600,height:400,background:'radial-gradient(circle,rgba(0,247,255,0.04) 0%,transparent 70%)',pointerEvents:'none',zIndex:0 }} />
      <div style={{ position:'fixed',bottom:0,right:'10%',width:500,height:400,background:'radial-gradient(circle,rgba(124,92,255,0.04) 0%,transparent 70%)',pointerEvents:'none',zIndex:0 }} />

      <div style={{ maxWidth:600,margin:'0 auto',position:'relative',zIndex:1 }}>
        <button onClick={()=>navigate('/chat')} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.2)',cursor:'pointer',fontFamily:mono,fontSize:12,letterSpacing:1,marginBottom:24,padding:0 }}>← back</button>

        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:9,color:'rgba(0,247,255,0.4)',fontFamily:mono,letterSpacing:5,marginBottom:8 }}>POWERED BY BAGS.FM</div>
          <div style={{ fontSize:isMobile?22:28,fontWeight:700,color:'#fff',fontFamily:mono,letterSpacing:-1,textShadow:'0 0 30px rgba(0,247,255,0.12)',marginBottom:6 }}>Launch a Token</div>
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.2)',fontFamily:mono }}>Deploy on Solana · min ~0.025 SOL</div>
        </div>

        <div style={card}>
          <div style={{ height:2,background:'linear-gradient(90deg,transparent,rgba(0,247,255,0.45),transparent)' }} />
          <div style={{ padding:isMobile?'20px 18px 28px':'26px 28px 34px',display:'flex',flexDirection:'column',gap:18 }}>

            {/* Image + Name + Symbol */}
            <div style={{ display:'flex',gap:16,alignItems:'flex-start',flexDirection:isMobile?'column':'row' }}>
              <div style={{ flexShrink:0 }}>
                <div style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',fontFamily:mono,letterSpacing:2,textTransform:'uppercase',marginBottom:6 }}>Image</div>
                <div onClick={()=>fileRef.current?.click()} style={{ width:88,height:88,borderRadius:14,border:preview?'1px solid rgba(0,247,255,0.3)':'2px dashed rgba(0,247,255,0.15)',background:'rgba(0,247,255,0.02)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden' }}>
                  {preview ? <img src={preview} style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : <div style={{ textAlign:'center' }}><div style={{ fontSize:20,opacity:0.15 }}>+</div><div style={{ fontSize:9,color:'rgba(255,255,255,0.15)',fontFamily:mono }}>upload</div></div>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile} />
              </div>
              <div style={{ flex:1,display:'flex',flexDirection:'column',gap:12,width:isMobile?'100%':'auto' }}>
                <Field label="Token Name"><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="My Awesome Token" style={inp} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>
                <Field label="Ticker" hint="max 10 chars"><input value={form.symbol} onChange={e=>set('symbol',e.target.value.toUpperCase())} placeholder="TOKEN" maxLength={10} style={inp} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>
              </div>
            </div>

            <Field label="Image URL" hint="optional if uploaded above"><input value={form.imageUrl} onChange={e=>{set('imageUrl',e.target.value);if(e.target.value&&!imgB64)setPreview(e.target.value);}} placeholder="https://..." style={inp} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>

            <Field label="Description"><textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What is this token about?" rows={3} style={{ ...inp,resize:'vertical' as const,minHeight:80,lineHeight:1.6 }} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>

            <div style={{ display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:12 }}>
              <Field label="Website" hint="optional"><input value={form.website} onChange={e=>set('website',e.target.value)} placeholder="https://..." style={inp} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>
              <Field label="Twitter" hint="optional"><input value={form.twitter} onChange={e=>set('twitter',e.target.value)} placeholder="@handle" style={inp} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>
              <Field label="Telegram" hint="optional"><input value={form.telegram} onChange={e=>set('telegram',e.target.value)} placeholder="@group" style={inp} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} /></Field>
            </div>

            <Field label="Initial Buy" hint="optional — 0 = free">
              <div style={{ position:'relative' }}>
                <input type="number" min="0" step="0.01" value={form.initialBuy} onChange={e=>set('initialBuy',e.target.value)} placeholder="0" style={{ ...inp,paddingRight:52 }} onFocus={e=>e.target.style.borderColor='rgba(0,247,255,0.35)'} onBlur={e=>e.target.style.borderColor='rgba(0,247,255,0.1)'} />
                <span style={{ position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.2)',fontFamily:mono,fontSize:13 }}>SOL</span>
              </div>
            </Field>

            <div style={{ background:'rgba(0,247,255,0.02)',border:'1px solid rgba(0,247,255,0.06)',borderRadius:10,padding:'12px 16px',display:'flex',gap:20,alignItems:'center' }}>
              <div><div style={{ fontSize:20,fontWeight:700,color:'#00f7ff',fontFamily:mono }}>95%</div><div style={{ fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:mono }}>you</div></div>
              <div><div style={{ fontSize:20,fontWeight:700,color:'#7c5cff',fontFamily:mono }}>5%</div><div style={{ fontSize:10,color:'rgba(255,255,255,0.2)',fontFamily:mono }}>SolChat</div></div>
              <div style={{ marginLeft:'auto',fontSize:10,color:'rgba(255,255,255,0.15)',fontFamily:mono,textAlign:'right' as const,lineHeight:1.6 }}>min ~0.025 SOL<br/>on every trade forever</div>
            </div>

            {errMsg && <div style={{ fontSize:12,color:'#ff6666',fontFamily:mono,background:'rgba(255,68,68,0.05)',border:'1px solid rgba(255,68,68,0.12)',borderRadius:8,padding:'10px 14px' }}>⚠ {errMsg}</div>}
            {!wallet.publicKey && <div style={{ fontSize:12,color:'rgba(255,170,0,0.6)',fontFamily:mono,background:'rgba(255,170,0,0.03)',border:'1px solid rgba(255,170,0,0.1)',borderRadius:8,padding:'10px 14px' }}>Connect your wallet to launch</div>}

            <button onClick={handleLaunch} disabled={!wallet.publicKey}
              style={{ width:'100%',padding:'15px',borderRadius:12,border:`1px solid ${wallet.publicKey?'rgba(0,247,255,0.4)':'rgba(255,255,255,0.05)'}`,background:wallet.publicKey?'rgba(0,247,255,0.07)':'rgba(255,255,255,0.02)',color:wallet.publicKey?'#00f7ff':'rgba(255,255,255,0.15)',fontFamily:mono,fontSize:14,fontWeight:700,letterSpacing:4,cursor:wallet.publicKey?'pointer':'not-allowed',textTransform:'uppercase' as const,transition:'all 0.2s' }}
              onMouseOver={e=>{ if(wallet.publicKey)(e.currentTarget as HTMLButtonElement).style.background='rgba(0,247,255,0.12)'; }}
              onMouseOut={e=>{ if(wallet.publicKey)(e.currentTarget as HTMLButtonElement).style.background='rgba(0,247,255,0.07)'; }}
            >LAUNCH TOKEN ON BAGS ◎</button>

          </div>
        </div>
      </div>
    </div>
  );
}
