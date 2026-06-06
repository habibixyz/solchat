import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import * as THREE from 'three';
import '../styles/mining.css';
import '../styles/premium-chat.css';

// Web3 imports are loaded dynamically inside handlers to avoid
// Node.js module crashes that prevent React from mounting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWallet = any;


// ── RETRO SYNTH AUDIO ENGINE (WEB AUDIO API) ──
class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMusicPlaying = false;
  private currentStep = 0;
  private bpm = 110;
  private nextNoteTime = 0.0;
  private schedulerTimeout: any = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playClick(isCritical = false) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isCritical ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isCritical ? 150 : 250, now);
    osc.frequency.exponentialRampToValueAtTime(isCritical ? 700 : 500, now + 0.08);

    gain.gain.setValueAtTime(isCritical ? 0.25 : 0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + (isCritical ? 0.15 : 0.08));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + (isCritical ? 0.15 : 0.08));
  }

  playBuy() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554, now + 0.05);
    osc.frequency.setValueAtTime(659, now + 0.1);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playLevelUp() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const freqs = [261.63, 329.63, 392.00, 523.25];
    freqs.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playOverclock() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.65);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  // ── CYBERPUNK MUSIC SYNTHESIZER ──
  startMusic() {
    this.init();
    if (!this.ctx || this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const stepDuration = 60 / this.bpm / 2; // eighth notes (0.27s at 110bpm)
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime;

    // Cyberpunk bassline notes (frequencies)
    const bassline = [
      65.41, 65.41, 77.78, 77.78, // C2, C2, Eb2, Eb2
      98.00, 98.00, 87.31, 87.31, // G2, G2, F2, F2
      65.41, 65.41, 77.78, 77.78, // C2, C2, Eb2, Eb2
      98.00, 87.31, 110.0, 98.00  // G2, F2, A2, G2
    ];

    const scheduler = () => {
      if (!this.isMusicPlaying || !this.ctx) return;
      
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.scheduleStep(this.currentStep, this.nextNoteTime, bassline);
        this.nextNoteTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 16;
      }
      this.schedulerTimeout = setTimeout(scheduler, 25);
    };

    scheduler();
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.schedulerTimeout) {
      clearTimeout(this.schedulerTimeout);
      this.schedulerTimeout = null;
    }
  }

  toggleMusic() {
    if (this.isMusicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  getMusicState() {
    return this.isMusicPlaying;
  }

  private scheduleStep(step: number, time: number, bassline: number[]) {
    if (!this.ctx) return;

    // 1. Kick Drum (beats 1 & 3, i.e., steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.connect(kickGain);
      kickGain.connect(this.ctx.destination);

      kickOsc.frequency.setValueAtTime(120, time);
      kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.14);

      kickGain.gain.setValueAtTime(0.25, time);
      kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.14);

      kickOsc.start(time);
      kickOsc.stop(time + 0.15);
    }

    // 2. Cyber Snare / White Noise Clap (steps 4 & 12)
    if (step === 4 || step === 12) {
      const bufferSize = this.ctx.sampleRate * 0.12; // 120ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1100;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.07, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.11);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseNode.start(time);
      noiseNode.stop(time + 0.13);
    }

    // 3. Cyberpunk Pluck Bassline (on every step)
    const bassFreq = bassline[step];
    if (bassFreq) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Cyberpunk classic triangle-saw combo or pure saw
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassFreq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, time);
      filter.frequency.exponentialRampToValueAtTime(750, time + 0.04);
      filter.frequency.exponentialRampToValueAtTime(140, time + 0.18);

      gain.gain.setValueAtTime(0.06, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.22);
    }

    // 4. Ambient Cyber Chord Pads (slow sweeps on step 0 and 8)
    if (step === 0 || step === 8) {
      // chord freqs: C major 7th and Eb major 7th
      const chordFreqs = step === 0 
        ? [130.81, 164.81, 196.00, 246.94] // C3, E3, G3, B3
        : [155.56, 196.00, 233.08, 293.66]; // Eb3, G3, Bb3, D4
      
      chordFreqs.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, time);
        filter.frequency.linearRampToValueAtTime(800, time + 0.6);
        filter.frequency.linearRampToValueAtTime(200, time + 1.8);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.025, time + 0.5); // soft pad attack
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.9); // soft pad release

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 2.0);
      });
    }
  }
}

const sfx = new SoundEngine();

const MINING_API_URL = import.meta.env.VITE_MINING_API_URL || 'http://localhost:3000';

// ── LEADERBOARD USER INTERFACE ──
interface LeaderboardPlayer {
  username: string;
  score: number;
  hps: number;
  isMe?: boolean;
  walletAddress?: string;
}

export default function MiningPage() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileName, setProfileName] = useState('guest');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const myWallet = wallet.publicKey?.toBase58() ?? '';
  const [nameClaiming, setNameClaiming] = useState(false);

  const changeName = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      alert("Connect wallet first and make sure it supports signing messages.");
      return;
    }
    const newName = prompt('Enter new username:');
    if (!newName) return;
    const clean = newName.trim();
    if (!clean) return;
    if (clean.length < 3 || clean.length > 20) {
      alert('Username must be 3-20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      alert('Username can only contain letters, numbers, and underscores');
      return;
    }
    setNameClaiming(true);
    try {
      const { default: bs58 } = await import('bs58');
      const message = `Claim username "${clean}" for wallet ${myWallet}`;
      const encodedMsg = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(encodedMsg);
      const signature = bs58.encode(signatureBytes);

      const res = await fetch('/api/claim-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: myWallet, username: clean, signature })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim username');
      }

      setProfileName(clean);
      localStorage.setItem(`solchat_name_${myWallet}`, clean);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to claim username (might be taken)');
    } finally {
      setNameClaiming(false);
    }
  };

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const prevWalletRef = useRef('');

  useEffect(() => {
    const prevWallet = prevWalletRef.current;

    if (!myWallet) {
      if (prevWallet) {
        // Clear stale cached name for old wallet
        delete (window as any).__scNameCache?.[prevWallet];
      }
      prevWalletRef.current = '';
      setProfileName('guest');
      return;
    }

    // Wallet switched — immediately reset to prevent bleed
    if (prevWallet && prevWallet !== myWallet) {
      setProfileName('guest');
    }

    prevWalletRef.current = myWallet;
    const walletKey = `solchat_name_${myWallet}`;

    supabase
      .from('usernames')
      .select('wallet_address, username')
      .ilike('wallet_address', myWallet)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.username || localStorage.getItem(walletKey) || 'guest';
        setProfileName(name);
        if (data?.username) localStorage.setItem(walletKey, data.username);
      });
  }, [myWallet]);

  // ── LOAD STATE FROM LOCALSTORAGE ──
  const [chips, setChips] = useState<number>(() => parseFloat(localStorage.getItem('solchat_chips') || '0'));
  const [level, setLevel] = useState<number>(() => parseInt(localStorage.getItem('solchat_level') || '1'));
  const [combo, setCombo] = useState<number>(0);
  const [isOverclocked, setIsOverclocked] = useState<boolean>(false);
  const [overclockTime, setOverclockTime] = useState<number>(0);
  const [hasSigilNft, setHasSigilNft] = useState<boolean>(() => localStorage.getItem('solchat_has_sigil_nft') === 'true');
  const [chatSurgeActive, setChatSurgeActive] = useState<boolean>(false);

  // ── ACTIVE PANEL ──
  const [activeTab, setActiveTab] = useState<'upgrades' | 'leaderboard'>('upgrades');
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(() => sfx.getMusicState());


  // Upgrades state
  const [rigs, setRigs] = useState({
    cpu: parseInt(localStorage.getItem('solchat_rig_cpu') || '0'),
    gpu: parseInt(localStorage.getItem('solchat_rig_gpu') || '0'),
    asic: parseInt(localStorage.getItem('solchat_rig_asic') || '0'),
    validator: parseInt(localStorage.getItem('solchat_rig_validator') || '0'),
    quantum: parseInt(localStorage.getItem('solchat_rig_quantum') || '0'),
    ai: parseInt(localStorage.getItem('solchat_rig_ai') || '0'),
  });

  const [clicks, setClicks] = useState({
    carbon: parseInt(localStorage.getItem('solchat_click_carbon') || '0'),
    laser: parseInt(localStorage.getItem('solchat_click_laser') || '0'),
    plasma: parseInt(localStorage.getItem('solchat_click_plasma') || '0'),
    antimatter: parseInt(localStorage.getItem('solchat_click_antimatter') || '0'),
  });

  // UI state
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; x: number; y: number; text: string; isCritical: boolean }[]>([]);
  const [shake, setShake] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>(() => {
    return [{ username: 'Guest Miner', score: 0, hps: 0, isMe: true }];
  });

  // Token management states
  const [serverWallet, setServerWallet] = useState<string | null>(null);
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [rpcType, setRpcType] = useState<string>('mainnet');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [isDeployingToken, setIsDeployingToken] = useState<boolean>(false);
  const [isClaimingToken, setIsClaimingToken] = useState<boolean>(false);
  const [conversionRatio, setConversionRatio] = useState<number>(1000);
  const [gridPower, setGridPower] = useState<number>(() => {
    const saved = localStorage.getItem('solchat_grid_power');
    return saved !== null ? parseFloat(saved) : 100;
  });
  const [dailyMined, setDailyMined] = useState<number>(() => {
    const saved = localStorage.getItem('solchat_daily_mined');
    return saved !== null ? parseFloat(saved) : 0;
  });
  const [lastDailyReset, setLastDailyReset] = useState<string>(() => {
    return localStorage.getItem('solchat_last_daily_reset') || '';
  });
  const [dailyMiningCap, setDailyMiningCap] = useState<number>(50000);

  // Deploy inputs
  const [deployName, setDeployName] = useState<string>('Solchat Chips');
  const [deploySymbol, setDeploySymbol] = useState<string>('SCHIP');
  const [deploySupply, setDeploySupply] = useState<string>('100000000');
  const [claimAmount, setClaimAmount] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextTextId = useRef<number>(0);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const voxelGroupRef = useRef<THREE.Group | null>(null);
  const rigsGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number }[]>([]);

  // Rig definitions
  const rigUpgrades = useMemo(() => [
    { id: 'cpu', name: 'CPU Cluster', baseCost: 15, hps: 0.15, icon: '💻', desc: 'Virtual background process core.' },
    { id: 'gpu', name: 'GPU Mining Rig', baseCost: 120, hps: 1.2, icon: '🎮', desc: 'Overclocked mining card stack.' },
    { id: 'asic', name: 'ASIC Array', baseCost: 950, hps: 9.0, icon: '⚡', desc: 'Custom integrated hash miner.' },
    { id: 'validator', name: 'Validator Node', baseCost: 6200, hps: 65.0, icon: '🛰️', desc: 'Solana node validating block txs.' },
    { id: 'quantum', name: 'Quantum Cell', baseCost: 45000, hps: 480.0, icon: '🌌', desc: 'Superpositioned multi-threaded qubit core.' },
    { id: 'ai', name: 'AI Swarm Coordinator', baseCost: 320000, hps: 3400.0, icon: '🧠', desc: 'Autonomous neural mesh mining algorithms.' },
  ] as const, []);

  // Click upgrades definitions
  const clickUpgrades = useMemo(() => [
    { id: 'carbon', name: 'Carbon Pickaxe', baseCost: 40, clickPower: 1, icon: '⛏️', desc: 'Sturdy carbon nano-fiber pick.' },
    { id: 'laser', name: 'Laser Extractor', baseCost: 280, clickPower: 5, icon: '🔦', desc: 'Beam focus node that breaks raw code.' },
    { id: 'plasma', name: 'Plasma Disrupter', baseCost: 1800, clickPower: 25, icon: '🔥', desc: 'Fires high-temp plasma flares.' },
    { id: 'antimatter', name: 'Antimatter Beamer', baseCost: 12000, clickPower: 150, icon: '☄️', desc: 'Collides particles to vaporize blocks.' },
  ] as const, []);

  // Calculate costs helper
  const getUpgradeCost = (baseCost: number, level: number) => {
    return Math.floor(baseCost * Math.pow(1.15, level));
  };

  // ── CALCULATE STATS ──
  const baseHashRate = useMemo(() => {
    let rate = 0;
    rate += (rigs.cpu * 0.15);
    rate += (rigs.gpu * 1.2);
    rate += (rigs.asic * 9.0);
    rate += (rigs.validator * 65.0);
    rate += (rigs.quantum * 480.0);
    rate += (rigs.ai * 3400.0);
    return rate;
  }, [rigs]);

  const activeHashRate = useMemo(() => {
    let rate = baseHashRate;
    let multiplier = 1.0;
    if (isOverclocked) multiplier *= 3.0;
    if (hasSigilNft) multiplier += 0.5;
    if (chatSurgeActive) multiplier += 0.25;
    return rate * multiplier;
  }, [baseHashRate, isOverclocked, hasSigilNft, chatSurgeActive]);

  const clickPower = useMemo(() => {
    let power = 1;
    power += (clicks.carbon * 1);
    power += (clicks.laser * 5);
    power += (clicks.plasma * 25);
    power += (clicks.antimatter * 150);
    return power;
  }, [clicks]);

  // ── LEVEL TIER (display) ──
  const levelTier = useMemo(() => {
    if (level >= 50) return { label: 'QUANTUM',   color: '#a855f7', glow: 'rgba(168,85,247,0.6)' };
    if (level >= 30) return { label: 'VALIDATOR', color: '#00f0ff', glow: 'rgba(0,240,255,0.6)' };
    if (level >= 15) return { label: 'ASIC',      color: '#ef9f27', glow: 'rgba(239,159,39,0.6)' };
    if (level >= 8)  return { label: 'GPU',       color: '#64748b', glow: 'rgba(100,116,139,0.5)' };
    if (level >= 3)  return { label: 'CPU',       color: '#1D9E75', glow: 'rgba(29,158,117,0.5)' };
    return              { label: 'ROOKIE',    color: '#7f8da1', glow: 'rgba(127,141,161,0.4)' };
  }, [level]);

  // Load backend token config on mount
  useEffect(() => {
    async function loadTokenConfig() {
      try {
        const res = await fetch(`${MINING_API_URL}/api/mine/config`);
        const data = await res.json();
        if (data) {
          setServerWallet(data.serverWallet);
          setTokenMint(data.tokenMint);
          setRpcType(data.rpcUrl);
          if (data.ratio) {
            setConversionRatio(data.ratio);
          }
          if (data.dailyCap) {
            setDailyMiningCap(data.dailyCap);
          }
        }
      } catch (err) {
        console.warn("Could not load backend token config:", err);
      }
    }
    loadTokenConfig();
  }, []);

  // UTC calendar daily reset check
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (lastDailyReset !== todayStr) {
      setDailyMined(0);
      setLastDailyReset(todayStr);
      localStorage.setItem('solchat_daily_mined', '0');
      localStorage.setItem('solchat_last_daily_reset', todayStr);
    }
  }, [lastDailyReset]);

  // Check Chat surge (if sent message in last 5 minutes)
  useEffect(() => {
    const checkChatSurge = () => {
      const lastMsg = localStorage.getItem('solchat_last_message_time');
      if (lastMsg) {
        const diff = Date.now() - parseInt(lastMsg);
        if (diff < 5 * 60 * 1000) {
          setChatSurgeActive(true);
          return;
        }
      }
      setChatSurgeActive(false);
    };

    checkChatSurge();
    const interval = setInterval(checkChatSurge, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real leaderboard from backend
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${MINING_API_URL}/api/mine/leaderboard`);
      const data = await res.json();
      if (data && data.success && data.leaderboard) {
        const myName = localStorage.getItem('solchat_name') || 'Guest Miner';
        const myWallet = wallet.publicKey?.toBase58() ?? '';

        let userFound = false;
        const mappedList: LeaderboardPlayer[] = data.leaderboard.map((p: any) => {
          const isMe = (myWallet && p.walletAddress && p.walletAddress.toLowerCase() === myWallet.toLowerCase()) ||
                       (!myWallet && p.username === myName && p.username !== 'Guest Miner');
          if (isMe) {
            userFound = true;
            return {
              username: p.username,
              score: p.score,
              hps: p.hps,
              isMe: true,
              walletAddress: p.walletAddress
            };
          }
          return {
            username: p.username,
            score: p.score,
            hps: p.hps,
            walletAddress: p.walletAddress
          };
        });

        if (!userFound) {
          mappedList.push({
            username: myName,
            score: 0,
            hps: 0,
            isMe: true,
            walletAddress: myWallet
          });
        }

        setLeaderboard(mappedList.sort((a, b) => b.score - a.score));
      }
    } catch (err) {
      console.warn("Failed to fetch real leaderboard:", err);
    }
  }, [wallet.publicKey]);

  // Periodic leaderboard fetch
  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 15000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  // Sync state to local storage
  const saveGameState = useCallback(() => {
    localStorage.setItem('solchat_chips', chips.toFixed(4));
    localStorage.setItem('solchat_level', level.toString());
    localStorage.setItem('solchat_rig_cpu', rigs.cpu.toString());
    localStorage.setItem('solchat_rig_gpu', rigs.gpu.toString());
    localStorage.setItem('solchat_rig_asic', rigs.asic.toString());
    localStorage.setItem('solchat_rig_validator', rigs.validator.toString());
    localStorage.setItem('solchat_rig_quantum', rigs.quantum.toString());
    localStorage.setItem('solchat_rig_ai', rigs.ai.toString());
    localStorage.setItem('solchat_click_carbon', clicks.carbon.toString());
    localStorage.setItem('solchat_click_laser', clicks.laser.toString());
    localStorage.setItem('solchat_click_plasma', clicks.plasma.toString());
    localStorage.setItem('solchat_click_antimatter', clicks.antimatter.toString());
    localStorage.setItem('solchat_has_sigil_nft', hasSigilNft.toString());
    localStorage.setItem('solchat_grid_power', gridPower.toString());
    localStorage.setItem('solchat_daily_mined', dailyMined.toString());
    localStorage.setItem('solchat_last_daily_reset', lastDailyReset);
  }, [chips, level, rigs, clicks, hasSigilNft, gridPower, dailyMined, lastDailyReset]);

  // Trigger level up threshold — requires meaningful chip accumulation
  const nextLevelRequirement = useMemo(() => {
    return Math.floor(500 * Math.pow(level, 2.2));
  }, [level]);


  useEffect(() => {
    if (chips >= nextLevelRequirement) {
      setLevel(prev => {
        const nextLvl = prev + 1;
        sfx.playLevelUp();
        setFloatingTexts(ft => [
          ...ft,
          {
            id: nextTextId.current++,
            x: 160,
            y: 100,
            text: `LEVEL UP! RANK ${nextLvl}`,
            isCritical: true,
          },
        ]);
        return nextLvl;
      });
    }
  }, [chips, nextLevelRequirement, level]);

  // Compute current mining efficiency difficulty multiplier
  const miningEfficiency = Math.max(0, 1 - (dailyMined / dailyMiningCap));

  // ── GAME LOOP TICKER ──
  useEffect(() => {
    let lastTime = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Drain Grid Power and earn chips only if Grid Power is > 0
      let activeRateVal = activeHashRate;
      if (baseHashRate > 0) {
        setGridPower(p => {
          const nextPower = Math.max(0, p - 0.5 * delta); // Drains fully in 200s (3.3 mins)
          if (nextPower > 0) {
            const rawEarned = activeHashRate * delta;
            const scaledEarned = rawEarned * miningEfficiency;
            if (scaledEarned > 0) {
              setChips(prev => prev + scaledEarned);
              setDailyMined(dm => {
                const nextDm = Math.min(dailyMiningCap, dm + scaledEarned);
                localStorage.setItem('solchat_daily_mined', nextDm.toString());
                return nextDm;
              });
            }
          } else {
            activeRateVal = 0;
          }
          return nextPower;
        });
      }

      // Handle combo decay
      setCombo(c => {
        if (isOverclocked) return c;
        if (c > 0) {
          const decay = 8 * delta;
          return Math.max(0, c - decay);
        }
        return 0;
      });

      // Handle overclock countdown
      if (isOverclocked) {
        setOverclockTime(t => {
          const nextT = t - delta;
          if (nextT <= 0) {
            setIsOverclocked(false);
            setCombo(0);
            return 0;
          }
          return nextT;
        });
      }

      // Simulate leaderboard player ticks
      setLeaderboard(prev => {
        const myName = localStorage.getItem('solchat_name') || 'Guest Miner';
        const updated = prev.map(p => {
          if (p.isMe) {
            return { username: myName, score: chips, hps: activeRateVal * miningEfficiency, isMe: true };
          }
          return {
            ...p,
            score: p.score + p.hps * delta
          };
        });

        if (!updated.find(p => p.isMe)) {
          updated.push({ username: myName, score: chips, hps: activeRateVal * miningEfficiency, isMe: true });
        }

        return updated.sort((a, b) => b.score - a.score);
      });

    }, 100);

    return () => clearInterval(interval);
  }, [activeHashRate, baseHashRate, chips, isOverclocked, dailyMined, dailyMiningCap, miningEfficiency]);

  // Periodic LocalStorage sync (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(saveGameState, 3000);
    return () => clearInterval(interval);
  }, [saveGameState]);

  // ── THREE.JS CLUSTER SPAWNERS ──
  const generateVoxelCluster = (scene: THREE.Scene) => {
    if (voxelGroupRef.current) {
      scene.remove(voxelGroupRef.current);
      voxelGroupRef.current.children.forEach((c: any) => {
        c.geometry.dispose();
        c.material.dispose();
      });
    }

    const group = new THREE.Group();
    voxelGroupRef.current = group;

    // Cyberpunk chromic themes with metallic rocks and neon glowing ores
    const themes = [
      { name: 'Emerald', ore: '#00ff88', rock: '#637081' },
      { name: 'Ruby', ore: '#ff007f', rock: '#695f70' },
      { name: 'Sapphire', ore: '#00f0ff', rock: '#5a6b7c' },
      { name: 'Amber', ore: '#ef9f27', rock: '#70645f' },
      { name: 'Diamond', ore: '#ffffff', rock: '#7a869a' },
    ];
    const theme = themes[Math.floor(Math.random() * themes.length)];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const dist = Math.abs(x) + Math.abs(y) + Math.abs(z);
          if (dist > 2) continue;

          const isOre = Math.random() < 0.45;
          const color = isOre ? theme.ore : theme.rock;
          const geo = new THREE.BoxGeometry(0.76, 0.76, 0.76);
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            roughness: isOre ? 0.05 : 0.12,
            metalness: isOre ? 0.95 : 0.85,
            flatShading: true,
            emissive: new THREE.Color(color),
            emissiveIntensity: isOre ? 0.65 : 0.15,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x * 0.82, y * 0.82, z * 0.82);
          mesh.userData = { isVoxel: true, color: color };
          group.add(mesh);
        }
      }
    }

    scene.add(group);
  };

  // ── THREE.JS 3D CRUMBLE PARTICLES ──
  const spawn3DParticles = (pos: THREE.Vector3, colorStr: string) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const count = 12;
    const color = new THREE.Color(colorStr);

    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.3,
        pos.y + (Math.random() - 0.5) * 0.3,
        pos.z + (Math.random() - 0.5) * 0.3
      );

      const speed = 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      const vx = Math.sin(phi) * Math.cos(theta) * speed * (Math.random() * 0.5 + 0.5);
      const vy = Math.sin(phi) * Math.sin(theta) * speed * (Math.random() * 0.5 + 0.5) + 1.2;
      const vz = Math.cos(phi) * speed * (Math.random() * 0.5 + 0.5);

      scene.add(mesh);
      particlesRef.current.push({
        mesh,
        vx: vx * 0.05,
        vy: vy * 0.05,
        vz: vz * 0.05,
        life: 0,
        maxLife: Math.random() * 20 + 20,
      });
    }
  };

  // ── LEVEL-REACTIVE GLOW RING (replaces distracting orbiting rigs) ──
  const update3DRigs = (scene: THREE.Scene, rigsCount: typeof rigs) => {
    if (rigsGroupRef.current) {
      scene.remove(rigsGroupRef.current);
      rigsGroupRef.current.children.forEach((c: any) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose());
          else c.material.dispose();
        }
      });
    }

    const group = new THREE.Group();
    rigsGroupRef.current = group;

    // Total rigs gives radius and opacity of the glow ring
    const totalRigs = rigsCount.cpu + rigsCount.gpu + rigsCount.asic + rigsCount.validator + rigsCount.quantum + rigsCount.ai;

    // Dynamically adjust camera zoom/distance to keep growing rings in frame without shrinking initial voxel cluster
    if (cameraRef.current) {
      cameraRef.current.position.z = 4.8 + Math.min(totalRigs, 30) * 0.07;
    }

    if (totalRigs === 0) {
      scene.add(group);
      return;
    }

    // Color shifts from green → cyan → purple as you level up rigs
    const color = rigsCount.quantum > 0 ? 0xa855f7
      : rigsCount.validator > 0 ? 0x00f0ff
      : rigsCount.asic > 0 ? 0xef9f27
      : 0x1D9E75;

    const ringRadius = 1.6 + Math.min(totalRigs, 30) * 0.04;  // grows with upgrades
    const opacity = 0.12 + Math.min(totalRigs, 50) * 0.005;   // gently brightens

    // Outer glow ring
    const outerGeo = new THREE.RingGeometry(ringRadius, ringRadius + 0.08, 64);
    const outerMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(opacity, 0.35),
      side: THREE.DoubleSide,
    });
    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.userData = { type: 'ring', phase: 0 };
    group.add(outerRing);

    // Inner softer ring
    const innerGeo = new THREE.RingGeometry(ringRadius * 0.7, ringRadius * 0.7 + 0.04, 64);
    const innerMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(opacity * 0.5, 0.18),
      side: THREE.DoubleSide,
    });
    const innerRing = new THREE.Mesh(innerGeo, innerMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.userData = { type: 'ring', phase: Math.PI };
    group.add(innerRing);

    scene.add(group);
  };


  // ── THREE.JS LIFE CYCLE HOOK ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 25);
    camera.position.z = 4.8;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
    });
    renderer.setSize(360, 360, false);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight1.position.set(3, 4, 3);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 0.75); // neon cyan back-light
    dirLight2.position.set(-3, -3, -1);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xff007f, 0.5); // neon magenta side-light
    dirLight3.position.set(3, -2, -2);
    scene.add(dirLight3);

    generateVoxelCluster(scene);

    const selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0xffffff);
    selectionBox.visible = false;
    scene.add(selectionBox);

    update3DRigs(scene, rigs);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (e: MouseEvent) => {
      if (!voxelGroupRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.set(mx, my);

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(voxelGroupRef.current.children);
      
      if (intersects.length > 0) {
        const hitObj = intersects[0].object as THREE.Mesh;
        selectionBox.setFromObject(hitObj);
        selectionBox.visible = true;
      } else {
        selectionBox.visible = false;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    let lastTime = Date.now();
    let frameId = 0;

    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (voxelGroupRef.current) {
        voxelGroupRef.current.rotation.y += (isOverclocked ? 0.95 : 0.24) * delta;
        voxelGroupRef.current.rotation.x += (isOverclocked ? 0.45 : 0.10) * delta;
      }

      // Animate glow rings — subtle pulse
      if (rigsGroupRef.current) {
        const t = now * 0.001;
        rigsGroupRef.current.children.forEach((ring: any) => {
          const phase = ring.userData?.phase ?? 0;
          const pulse = 0.85 + 0.15 * Math.sin(t * 1.4 + phase);
          ring.scale.set(pulse, pulse, pulse);
          if (ring.material?.opacity !== undefined) {
            ring.material.opacity = ring.material.opacity * 0.98 + (ring.userData?.baseOpacity ?? 0.15) * pulse * 0.02;
          }
          ring.rotation.z += 0.12 * delta;  // very slow spin — barely noticeable
        });
      }

      particlesRef.current.forEach((p) => {
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        
        p.vy -= 1.6 * delta;
        p.life += 45 * delta;
        
        const ratio = Math.min(1, p.life / p.maxLife);
        p.mesh.scale.set(1 - ratio, 1 - ratio, 1 - ratio);
        
        if (p.mesh.material && 'opacity' in p.mesh.material) {
          (p.mesh.material as any).opacity = 1 - ratio;
        }

        if (p.life >= p.maxLife) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          if (Array.isArray(p.mesh.material)) p.mesh.material.forEach((m: any) => m.dispose());
          else p.mesh.material.dispose();
        }
      });
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      scene.clear();
      sfx.stopMusic();
    };
  }, [isOverclocked]);

  useEffect(() => {
    if (sceneRef.current) {
      update3DRigs(sceneRef.current, rigs);
    }
  }, [rigs]);

  // ── RAYCAST CLICK MINER ──
  const handleVoxelMiningClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    sfx.init();

    const canvas = canvasRef.current;
    if (!canvas || !cameraRef.current || !voxelGroupRef.current || !sceneRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const mx = (clickX / rect.width) * 2 - 1;
    const my = -(clickY / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mx, my), cameraRef.current);
    const intersects = raycaster.intersectObjects(voxelGroupRef.current.children);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object as THREE.Mesh;
      const hitColor = hitObj.userData.color;
      const hitPos = hitObj.position.clone();

      voxelGroupRef.current.remove(hitObj);
      hitObj.geometry.dispose();
      if (Array.isArray(hitObj.material)) hitObj.material.forEach((m: any) => m.dispose());
      else hitObj.material.dispose();

      spawn3DParticles(hitPos, hitColor);

      const criticalChance = 0.08 + (clicks.laser * 0.02);
      const isCritical = Math.random() < criticalChance;

      const currentMult = isOverclocked ? 3.0 : 1.0;
      const rawClickVal = clickPower * currentMult * (isCritical ? 5 : 1);
      const clickVal = rawClickVal * miningEfficiency;
      
      if (clickVal > 0) {
        setChips(prev => prev + clickVal);
        setDailyMined(dm => {
          const nextDm = Math.min(dailyMiningCap, dm + clickVal);
          localStorage.setItem('solchat_daily_mined', nextDm.toString());
          return nextDm;
        });
      }
      // Recharge Grid Power (+5.5% power per click)
      setGridPower(p => Math.min(100, p + 5.5));
      sfx.playClick(isCritical);

      if (isCritical) {
        setShake(true);
        setTimeout(() => setShake(false), 150);
      }

      const textMsg = isCritical ? `CRITICAL! +${clickVal.toFixed(1)}` : `+${clickVal.toFixed(1)}`;
      const newText = {
        id: nextTextId.current++,
        x: clickX,
        y: clickY,
        text: textMsg,
        isCritical
      };
      setFloatingTexts(ft => [...ft, newText]);
      setTimeout(() => {
        setFloatingTexts(ft => ft.filter(t => t.id !== newText.id));
      }, 800);

      if (!isOverclocked) {
        setCombo(prev => {
          const nextCombo = prev + 3;
          if (nextCombo >= 100) {
            setIsOverclocked(true);
            setOverclockTime(15);
            sfx.playOverclock();
            return 100;
          }
          return nextCombo;
        });
      }

      if (voxelGroupRef.current.children.length === 0) {
        generateVoxelCluster(sceneRef.current);
      }
    }
  };

  // ── UPGRADE TRANSACTION TRIGGERS ──
  const buyRig = (rigId: keyof typeof rigs, baseCost: number) => {
    const lvl = rigs[rigId];
    const cost = getUpgradeCost(baseCost, lvl);

    if (chips >= cost) {
      setChips(prev => prev - cost);
      setRigs(prev => {
        const next = { ...prev, [rigId]: lvl + 1 };
        localStorage.setItem(`solchat_rig_${rigId}`, (lvl + 1).toString());
        return next;
      });
      sfx.playBuy();
    }
  };

  const buyClick = (clickId: keyof typeof clicks, baseCost: number) => {
    const lvl = clicks[clickId];
    const cost = getUpgradeCost(baseCost, lvl);

    if (chips >= cost) {
      setChips(prev => prev - cost);
      setClicks(prev => {
        const next = { ...prev, [clickId]: lvl + 1 };
        localStorage.setItem(`solchat_click_${clickId}`, (lvl + 1).toString());
        return next;
      });
      sfx.playBuy();
    }
  };

  const handleMintBooster = async () => {
    if (!wallet.publicKey) {
      alert("Please connect your wallet adapter first.");
      return;
    }
    if (!serverWallet) {
      alert("Server wallet address not loaded yet. Please try again in a few seconds.");
      return;
    }
    try {
      const { mintNFT } = await import('../mint');
      const rpcUrl = rpcType === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
      
      // 1. Send 0.001 SOL payment transaction
      const signature = await mintNFT(wallet, serverWallet, rpcUrl);
      if (!signature) return;

      // 2. Call backend to verify transaction and activate Sigil
      const res = await fetch(`${MINING_API_URL}/api/mine/activate-sigil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, walletAddress: wallet.publicKey.toBase58() })
      });

      const data = await res.json();
      if (data.success) {
        setHasSigilNft(true);
        localStorage.setItem('solchat_has_sigil_nft', 'true');
        sfx.playLevelUp();
        alert("⚡ Sigil Boost successfully activated! You now have a permanent +0.5x hash rate multiplier.");
      } else {
        alert("Activation failed: " + data.error);
      }
    } catch (err: any) {
      console.error("Mint Sigil Boost failed:", err);
      alert("Mint failed: " + (err.message || err));
    }
  };

  // ── SECURE CLOUD SCORE SYNCHRONIZATION ──
  const syncScoresWithServer = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      alert("Connect wallet first and make sure it supports signing messages.");
      return;
    }

    setIsSyncing(true);
    try {
      const { default: bs58 } = await import('bs58');
      const walletStr = wallet.publicKey.toBase58();
      const message = `Sync Solchat Miner state: chips=${chips.toFixed(4)}, wallet=${walletStr}`;
      const encodedMsg = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(encodedMsg);
      const signature = bs58.encode(signatureBytes);

      const res = await fetch(`${MINING_API_URL}/api/mine/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletStr, chips, rigs, clicks, signature, dailyMined })
      });

      const data = await res.json();
      if (data.success) {
        setLastSyncTime(Date.now());
        if (data.syncedScore !== undefined) setChips(data.syncedScore);
        if (data.dailyMined !== undefined) {
          setDailyMined(data.dailyMined);
          localStorage.setItem('solchat_daily_mined', data.dailyMined.toString());
        }
        if (data.hasSigilNft !== undefined) {
          setHasSigilNft(!!data.hasSigilNft);
          localStorage.setItem('solchat_has_sigil_nft', data.hasSigilNft.toString());
        }
      } else {
        alert("Sync failed: " + data.error);
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      alert("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── DEPLOY MINT TOKEN ON SOLANA ──
  const handleDeployToken = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert("Connect wallet to deploy the token.");
      return;
    }
    if (!serverWallet) {
      alert("Server authority wallet address is not loaded from backend.");
      return;
    }
    const supply = parseFloat(deploySupply);
    if (isNaN(supply) || supply <= 0) {
      alert("Please enter a valid initial supply.");
      return;
    }

    setIsDeployingToken(true);
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, Keypair } = await import('@solana/web3.js');
      const { TOKEN_PROGRAM_ID, MINT_SIZE, createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, createSetAuthorityInstruction, AuthorityType } = await import('@solana/spl-token');

      const rpcEndpoint = rpcType === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const mintKeypair = Keypair.generate();
      const rentLamports = await getMinimumBalanceForRentExemptMint(connection);

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: rentLamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(mintKeypair.publicKey, 9, wallet.publicKey, wallet.publicKey)
      );

      const adminAta = getAssociatedTokenAddressSync(mintKeypair.publicKey, wallet.publicKey, false, TOKEN_PROGRAM_ID);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, adminAta, wallet.publicKey, mintKeypair.publicKey, TOKEN_PROGRAM_ID),
        createMintToInstruction(mintKeypair.publicKey, adminAta, wallet.publicKey, BigInt(Math.floor(supply * 1_000_000_000)), [], TOKEN_PROGRAM_ID),
        createSetAuthorityInstruction(mintKeypair.publicKey, wallet.publicKey, AuthorityType.MintTokens, new PublicKey(serverWallet!), [], TOKEN_PROGRAM_ID)
      );

      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.partialSign(mintKeypair);

      const signedTx = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');
      const deployedMintStr = mintKeypair.publicKey.toBase58();

      const res = await fetch(`${MINING_API_URL}/api/mine/set-mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintAddress: deployedMintStr })
      });
      const resData = await res.json();
      if (resData.success) {
        setTokenMint(deployedMintStr);
        alert(`Success! Token deployed at: ${deployedMintStr}. Authority set to Server.`);
      }
    } catch (err: any) {
      console.error("Token deployment failed:", err);
      alert("Token deployment failed: " + err.message);
    } finally {
      setIsDeployingToken(false);
    }
  };

  // ── CLAIM TOKEN MINTING TRANSACTION ──
  const handleClaimTokens = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signMessage) {
      alert("Connect your wallet first.");
      return;
    }
    const val = parseFloat(claimAmount);
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid amount to claim.");
      return;
    }
    if (chips < val) {
      alert("Insufficient local chips balance.");
      return;
    }

    await syncScoresWithServer();

    setIsClaimingToken(true);
    try {
      const { default: bs58 } = await import('bs58');
      const { Connection, Transaction } = await import('@solana/web3.js');

      const walletStr = wallet.publicKey.toBase58();
      const tokenVal = val / conversionRatio;
      const message = `Claim ${val.toFixed(1)} chips for ${tokenVal.toFixed(4)} SCHIP tokens to wallet ${walletStr}`;
      const encodedMsg = new TextEncoder().encode(message);
      const signatureBytes = await wallet.signMessage(encodedMsg);
      const signature = bs58.encode(signatureBytes);

      const res = await fetch(`${MINING_API_URL}/api/mine/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletStr, amount: val, signature })
      });

      const data = await res.json();
      if (!data.success) {
        alert("Claim failed: " + data.error);
        setIsClaimingToken(false);
        return;
      }

      // Deserialize with browser-native base64
      const binaryString = window.atob(data.serializedTx);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const transaction = Transaction.from(bytes);

      const signedTransaction = await wallet.signTransaction(transaction);
      const rpcEndpoint = rpcType === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcEndpoint, 'confirmed');
      const txSignature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      setChips(prev => Math.max(0, prev - val));
      sfx.playLevelUp();
      alert(`Claimed! TX: ${txSignature}`);
      await syncScoresWithServer();
    } catch (err: any) {
      console.error("Claim failed:", err);
      alert("Claim failed: " + err.message);
    } finally {
      setIsClaimingToken(false);
    }
  };

  const renderNavSidebar = () => {
    if (isMobile) return null;
    const navItems = [
      { id: 'chat', label: 'Global Feed', icon: '△', path: '/' },
      { id: 'trending', label: 'Trending', icon: '◇', path: '/trending' },
      { id: 'dms', label: 'Messages', icon: '□', path: '/dm' },
      { id: 'notifications', label: 'Notifications', icon: '●', path: '/notifications' },
    ];
    return (
      <aside className="cl-sidebar" style={{ width: 264, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(255, 255, 255, 0.055)', background: '#050507' }}>
        <div className="cl-sidebar-logo-container">
          <img src="/logo.png" alt="" className="cl-logo-badge" style={{ objectFit: 'contain', padding: '2px' }} />
          <div>
            <div className="cl-logo-text">SOLCHAT</div>
            <div className="cl-logo-subtext">social trading layer</div>
          </div>
        </div>
        <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.055)' }}>
          <div className="cl-nav-section-header">Navigate</div>
          {navItems.map(it => {
            const active = it.id === 'dms' 
              ? location.pathname.startsWith('/dm') 
              : location.pathname === it.path;
            return (
              <div key={it.id} className={`cl-nav-link-custom${active ? ' active' : ''}`} onClick={() => navigate(it.path)}>
                <span className="cl-nav-icon">{it.icon}</span>
                <span>{it.label}</span>
              </div>
            );
          })}
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
        </div>
        <div style={{ flex: 1 }} />
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
    );
  };

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    height: 'calc(100vh - 52px)',
    maxHeight: 'calc(100vh - 52px)',
    background: '#08090b',
    color: '#e7edf4',
    overflow: 'hidden',
    padding: isMobile ? '0' : '16px 0',
  };

  const wrapperStyle: React.CSSProperties = {
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
  };

  return (
    <div style={rootStyle}>
      <div style={wrapperStyle}>
        {renderNavSidebar()}
        <div ref={containerRef} className={`mine-container ${shake ? 'screen-shake' : ''}`}>
          {isOverclocked && <div className="overclock-flash" />}

      {/* ── LEFT CONTAINER ── */}
      <div className="mine-left-pane">
        <div className="mine-card mine-card--active" style={{
          flex: isMobile ? 'none' : 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: isMobile ? 'auto' : 0,
          padding: '12px 16px'
        }}>
          {/* COMPACT HUD ROW */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            marginBottom: 8,
            gap: isMobile ? 12 : 8
          }}>
            {/* Balance */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: isMobile ? 'none' : 1,
              alignItems: isMobile ? 'center' : 'flex-start',
              borderBottom: isMobile ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
              paddingBottom: isMobile ? 8 : 0
            }}>
              <span style={{ fontSize: 9, color: '#7f8da1', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>Mined Balance</span>
              <span style={{
                fontWeight: 900,
                color: '#fff',
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
                fontSize: chips >= 1_000_000 ? 18 : chips >= 100_000 ? 22 : 26,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}>
                {chips.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span style={{ fontSize: 10, color: 'var(--mine-neon-green)', fontWeight: 700 }}>CHIPS</span>
              </span>
            </div>

            {/* Other Stats Group */}
            <div style={{
              display: 'flex',
              justifyContent: isMobile ? 'space-around' : 'flex-start',
              alignItems: 'center',
              width: isMobile ? '100%' : 'auto',
              gap: isMobile ? 16 : 8,
              flexShrink: 0
            }}>
              {/* Hash Rate */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: '#7f8da1', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>Hash Rate</span>
                <span style={{ fontWeight: 900, color: 'var(--mine-neon-cyan)', fontSize: 20, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  {gridPower > 0 ? (
                    (activeHashRate * miningEfficiency) >= 1000
                      ? `${((activeHashRate * miningEfficiency) / 1000).toFixed(1)}K`
                      : (activeHashRate * miningEfficiency).toFixed(1)
                  ) : (
                    '0.0'
                  )}
                  <span style={{ fontSize: 10, color: 'var(--mine-neon-cyan)', fontWeight: 700, marginLeft: 3 }}>H/s</span>
                </span>
              </div>

              {/* Efficiency */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: '#7f8da1', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>Efficiency</span>
                <span style={{ fontWeight: 900, color: miningEfficiency <= 0.2 ? 'var(--mine-neon-pink)' : 'var(--mine-neon-green)', fontSize: 20, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  {Math.ceil(miningEfficiency * 100)}
                  <span style={{ fontSize: 10, color: miningEfficiency <= 0.2 ? 'var(--mine-neon-pink)' : 'var(--mine-neon-green)', fontWeight: 700, marginLeft: 1 }}>%</span>
                </span>
              </div>

              {/* Level Badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-end', flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: '#7f8da1', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>Level</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{
                    fontWeight: 900,
                    fontSize: 24,
                    lineHeight: 1.1,
                    color: levelTier.color,
                    textShadow: `0 0 12px ${levelTier.glow}`,
                  }}>{level}</span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: levelTier.color,
                    opacity: 0.85,
                    letterSpacing: 0.5,
                  }}>{levelTier.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* STATUS BADGES ROW */}
          {(hasSigilNft || chatSurgeActive || isOverclocked || lastSyncTime > 0 || gridPower <= 0 || dailyMined > 0) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {dailyMined > 0 && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.2)', color: 'var(--mine-neon-cyan)', fontWeight: 700 }}>
                  🔋 DAILY: {Math.floor(dailyMined).toLocaleString()} / {dailyMiningCap.toLocaleString()}
                </span>
              )}
              {gridPower <= 0 && (
                <span className="grid-offline-badge" style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,0,85,0.18)', border: '1px solid rgba(255,0,85,0.4)', color: 'var(--mine-neon-pink)', fontWeight: 800 }}>⚠️ GRID OFFLINE</span>
              )}
              {hasSigilNft && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,159,39,0.15)', border: '1px solid rgba(239,159,39,0.3)', color: 'var(--mine-neon-orange)', fontWeight: 700 }}>⚡ SIGIL +50%</span>
              )}
              {chatSurgeActive && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.3)', color: 'var(--mine-neon-green)', fontWeight: 700 }}>🔥 SURGE +25%</span>
              )}
              {isOverclocked && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,0,127,0.15)', border: '1px solid rgba(255,0,127,0.3)', color: 'var(--mine-neon-pink)', fontWeight: 700 }}>🚀 OC 3x ({Math.ceil(overclockTime)}s)</span>
              )}
              {lastSyncTime > 0 && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7f8da1' }}>☁ {Math.floor((Date.now()-lastSyncTime)/1000)}s ago</span>
              )}
            </div>
          )}

          {/* INTERACTIVE MINING NODE — fills remaining space */}
          <div className={`mine-rig-panel ${isOverclocked ? 'mine-card--overclock' : ''}`} style={{
            flex: isMobile ? 'none' : 1,
            minHeight: isMobile ? 'auto' : 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isOverclocked && <span className="overclock-alert">Hyperdrive Overclock Active!</span>}

            {/* Music Toggle Button */}
            <button
              onClick={() => {
                const nextState = sfx.toggleMusic();
                setIsMusicPlaying(nextState);
              }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                background: isMusicPlaying ? 'rgba(29, 158, 117, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: isMusicPlaying ? '1px solid var(--mine-neon-green)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isMusicPlaying ? 'var(--mine-neon-green)' : '#7f8da1',
                fontSize: 14,
                boxShadow: isMusicPlaying ? '0 0 10px rgba(29, 158, 117, 0.4)' : 'none',
                transition: 'all 0.2s',
              }}
              title="Toggle Cyberpunk Ambient Music"
            >
              {isMusicPlaying ? '🔊' : '🔇'}
            </button>

            <div className="mine-canvas-container">
              {floatingTexts.map(t => (
                <div key={t.id} className={`floating-text ${t.isCritical ? 'critical' : ''}`} style={{ left: t.x, top: t.y }}>
                  {t.text}
                </div>
              ))}
              <canvas
                ref={canvasRef}
                className="mine-canvas"
                style={{ imageRendering: 'pixelated', outline: 'none' }}
                onClick={handleVoxelMiningClick}
              />
            </div>

            {/* STATUS PANEL FOR CORE POWER & HYPERDRIVE COMBO */}
            <div className="status-bars-panel" style={{
              width: 'min(420px, 100%)',
              background: 'rgba(255, 255, 255, 0.015)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 12,
              boxSizing: 'border-box',
              flexShrink: 0
            }}>
              {/* CORE POWER */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 9, color: '#7f8da1', fontWeight: 600, marginBottom: 4 }}>
                  <span style={{ color: gridPower <= 20 ? 'var(--mine-neon-pink)' : '#7f8da1', letterSpacing: 0.5 }}>
                    {gridPower <= 0 ? '⚠️ GRID DEPLETED' : gridPower <= 20 ? '⚠️ LOW CORE POWER' : '⚡ CORE POWER'}
                  </span>
                  <span style={{ color: gridPower <= 20 ? 'var(--mine-neon-pink)' : '#fff' }}>{Math.floor(gridPower)}%</span>
                </div>
                <div className="mine-combo-bar" style={{ height: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <div 
                    className="mine-combo-fill" 
                    style={{ 
                      height: '100%',
                      width: `${gridPower}%`, 
                      background: gridPower <= 20 
                        ? 'linear-gradient(90deg, #ff0055, #ff007f)' 
                        : 'linear-gradient(90deg, #0077ff, #00f0ff)',
                      boxShadow: gridPower <= 20 
                        ? '0 0 8px rgba(255, 0, 127, 0.3)' 
                        : '0 0 8px rgba(0, 240, 255, 0.3)',
                      transition: 'width 0.1s linear'
                    }} 
                  />
                </div>
              </div>

              {/* COMBO BAR */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 9, color: '#7f8da1', fontWeight: 600, marginBottom: 4 }}>
                  <span style={{ letterSpacing: 0.5 }}>{isOverclocked ? 'OVERCLOCK ACTIVE' : 'HYPERDRIVE COMBO'}</span>
                  <span>{isOverclocked ? `${Math.ceil(overclockTime)}s` : `${Math.floor(combo)}%`}</span>
                </div>
                <div className="mine-combo-bar" style={{ height: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <div className={`mine-combo-fill ${isOverclocked ? 'overclock' : ''}`} style={{ width: `${isOverclocked ? (overclockTime/15)*100 : combo}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM ACTIONS */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexShrink: 0 }}>
            {wallet.publicKey && (
              <button onClick={syncScoresWithServer} disabled={isSyncing} className="sigil-mint-btn"
                style={{ flex: 1, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.4)', color: 'var(--mine-neon-green)', fontSize: 10 }}>
                {isSyncing ? 'SYNCING…' : '☁️ SYNC'}
              </button>
            )}
            <button onClick={handleMintBooster} disabled={hasSigilNft} className="sigil-mint-btn"
              style={{ flex: 2, background: hasSigilNft ? 'rgba(255,255,255,0.04)' : 'var(--mine-neon-orange)', color: hasSigilNft ? '#7f8da1' : '#fff', cursor: hasSigilNft ? 'default' : 'pointer', fontSize: 10 }}>
              {hasSigilNft ? '⚡ SIGIL ACTIVE' : '⚡ MINT SIGIL BOOST (0.001 SOL)'}
            </button>
          </div>

        </div>
      </div>

      {/* ── RIGHT CONTAINER: UPGRADES / LEADERBOARD TAB SYSTEM ── */}
      <div className="mine-right-pane">
        <div className="mine-card" style={{
          flex: isMobile ? 'none' : 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: isMobile ? 'auto' : 0
        }}>
          {/* TABS HEADER */}
          <div className="mine-tabs">
            <button
              className={`mine-tab-btn ${activeTab === 'upgrades' ? 'active' : ''}`}
              onClick={() => setActiveTab('upgrades')}
            >
              ⛏️ Upgrades
            </button>
            <button
              className={`mine-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('leaderboard')}
            >
              🏆 Leaderboard
            </button>
          </div>

          {/* TAB CONTENT: UPGRADES */}
          {activeTab === 'upgrades' && (
            <div className="upgrades-list">
              <div style={{ color: 'var(--mine-neon-cyan)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 800, margin: '8px 0 4px' }}>Clicking Upgrades</div>
              {clickUpgrades.map(up => {
                const lvl = clicks[up.id];
                const cost = getUpgradeCost(up.baseCost, lvl);
                const disabled = chips < cost;

                return (
                  <div
                    key={up.id}
                    className={`upgrade-item ${disabled ? 'disabled' : ''}`}
                    onClick={() => buyClick(up.id, up.baseCost)}
                  >
                    <div className="upgrade-info">
                      <div className="upgrade-icon">{up.icon}</div>
                      <div className="upgrade-details">
                        <div className="upgrade-name">{up.name}</div>
                        <div className="upgrade-benefit">+{up.clickPower} power/click</div>
                      </div>
                    </div>
                    <div className="upgrade-action">
                      <div className="upgrade-cost">
                        {cost} 🪙
                      </div>
                      <div className="upgrade-level">Lvl {lvl}</div>
                    </div>
                  </div>
                );
              })}

              <div style={{ color: 'var(--mine-neon-green)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 800, margin: '14px 0 4px' }}>Passive Mining Rigs</div>
              {rigUpgrades.map(up => {
                const lvl = rigs[up.id];
                const cost = getUpgradeCost(up.baseCost, lvl);
                const disabled = chips < cost;

                return (
                  <div
                    key={up.id}
                    className={`upgrade-item ${disabled ? 'disabled' : ''}`}
                    onClick={() => buyRig(up.id, up.baseCost)}
                  >
                    <div className="upgrade-info">
                      <div className="upgrade-icon">{up.icon}</div>
                      <div className="upgrade-details">
                        <div className="upgrade-name">{up.name}</div>
                        <div className="upgrade-benefit">+{up.hps.toFixed(2)} H/s</div>
                      </div>
                    </div>
                    <div className="upgrade-action">
                      <div className="upgrade-cost">
                        {cost} 🪙
                      </div>
                      <div className="upgrade-level">Lvl {lvl}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB CONTENT: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="leaderboard-list">
              <div style={{ fontSize: 11, color: '#7f8da1', marginBottom: 10, textAlign: 'center' }}>
                Climb the ranks by maximizing your rig output!
              </div>
              {leaderboard.slice(0, 10).map((player, idx) => (
                <div
                  key={`${player.username}-${idx}`}
                  className={`leaderboard-row ${player.isMe ? 'me' : ''}`}
                >
                  <div className="leaderboard-user">
                    <span className={`leaderboard-rank rank-${idx}`}>
                      {idx + 1}
                    </span>
                    <span className="leaderboard-avatar">
                      {player.username.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="leaderboard-name" style={{ color: player.isMe ? 'var(--mine-neon-green)' : '#fff' }}>
                      @{player.username} {player.isMe && '(You)'}
                    </span>
                  </div>
                  <div className="leaderboard-score-group">
                    <div className="leaderboard-chips">
                      {Math.floor(player.score).toLocaleString()}
                    </div>
                    <div className="leaderboard-hps">
                      {player.hps.toFixed(1)} H/s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}


        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
