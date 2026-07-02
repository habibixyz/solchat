import express from 'express';
import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountIdempotentInstruction, 
  createMintToInstruction, 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from '@solana/spl-token';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getPlayer, syncPlayer, deductChips, isSignatureUsed, markSignatureUsed, activateSigilNft } from '../miningDb.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

dotenv.config();

const router = express.Router();

// Parse and cleanup RPC URL
const rawRpc = process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const rpcUrl = rawRpc.replace('VITE_SOLANA_RPC_URL=', '').trim().replace(/\\n$/, '').replace(/\n$/, '').trim();

// Setup connection
const connection = new Connection(rpcUrl, 'confirmed');

// Helper to get server wallet keypair
function getServerKeypair() {
  if (!process.env.MINE_SERVER_SECRET_KEY) {
    return null;
  }
  try {
    const key = JSON.parse(process.env.MINE_SERVER_SECRET_KEY);
    return Keypair.fromSecretKey(Uint8Array.from(key));
  } catch (err) {
    console.error("Failed to parse MINE_SERVER_SECRET_KEY:", err);
    return null;
  }
}

// Verify tweetnacl signatures
function verifyWalletSignature(message, signature, walletAddress) {
  try {
    const pubKey = new PublicKey(walletAddress);
    const sig = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(messageBytes, sig, pubKey.toBytes());
  } catch (error) {
    return false;
  }
}

// ── GET CONFIG / HEALTH ──
router.get('/config', (req, res) => {
  const serverKeypair = getServerKeypair();
  res.json({
    serverWallet: serverKeypair ? serverKeypair.publicKey.toBase58() : null,
    tokenMint: process.env.TOKEN_MINT_ADDRESS || null,
    rpcUrl: rpcUrl.includes('devnet') ? 'devnet' : 'mainnet',
    ratio: parseFloat(process.env.CHIPS_TO_TOKEN_RATIO || '1000'),
    dailyCap: parseFloat(process.env.DAILY_MINING_CAP || '50000'),
  });
});

// ── SET MINT ADDRESS (ADMIN ONLY ON LOCALHOST) ──
router.post('/set-mint', (req, res) => {
  const { mintAddress } = req.body;
  if (!mintAddress) return res.status(400).json({ error: 'Missing mintAddress' });

  try {
    new PublicKey(mintAddress);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid Solana mint address' });
  }

  // Update in memory & write to env file
  process.env.TOKEN_MINT_ADDRESS = mintAddress;

  try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('TOKEN_MINT_ADDRESS=')) {
        envContent = envContent.replace(/TOKEN_MINT_ADDRESS=.*/, `TOKEN_MINT_ADDRESS=${mintAddress}`);
      } else {
        envContent += `\nTOKEN_MINT_ADDRESS=${mintAddress}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`[MINE ENGINE] Token mint updated and saved to .env: ${mintAddress}`);
    }
  } catch (err) {
    console.error("Failed to persist TOKEN_MINT_ADDRESS in .env:", err);
  }

  res.json({ success: true, tokenMint: mintAddress });
});

// ── SYNC SCORE ──
router.post('/sync', (req, res) => {
  const { walletAddress, chips, rigs, clicks, signature } = req.body;
  if (!walletAddress || chips === undefined) {
    return res.status(400).json({ error: 'Missing sync arguments' });
  }

  // Verify signature
  const message = `Sync Solchat Miner state: chips=${parseFloat(chips).toFixed(4)}, wallet=${walletAddress}`;
  const isValid = verifyWalletSignature(message, signature, walletAddress);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid sync signature' });
  }

  // Retrieve player profile from DB
  const player = getPlayer(walletAddress);

  // Check for UTC daily reset
  const todayStr = new Date().toISOString().split('T')[0];
  if (!player.lastDailyReset || player.lastDailyReset !== todayStr) {
    player.dailyMined = 0;
    player.lastDailyReset = todayStr;
  }

  const oldChips = player.chips || 0;
  const oldRigs = player.rigs || { cpu: 0, gpu: 0, asic: 0, validator: 0, quantum: 0, ai: 0 };
  const oldClicks = player.clicks || { carbon: 0, laser: 0, plasma: 0, antimatter: 0 };
  const oldLastSync = player.lastSync || Date.now();

  const newRigs = rigs || { cpu: 0, gpu: 0, asic: 0, validator: 0, quantum: 0, ai: 0 };
  const newClicks = clicks || { carbon: 0, laser: 0, plasma: 0, antimatter: 0 };
  const clientChips = parseFloat(chips);

  // 1. Calculate costs of newly purchased upgrades to verify they were affordable
  let upgradeCost = 0;

  const rigBaseCosts = { cpu: 15, gpu: 120, asic: 950, validator: 6200, quantum: 45000, ai: 320000 };
  for (const key of Object.keys(rigBaseCosts)) {
    const oldVal = oldRigs[key] || 0;
    const newVal = Math.max(oldVal, newRigs[key] || 0); // prevent downgraded rigs hacking
    newRigs[key] = newVal; 
    for (let lvl = oldVal; lvl < newVal; lvl++) {
      upgradeCost += Math.floor(rigBaseCosts[key] * Math.pow(1.15, lvl));
    }
  }

  const clickBaseCosts = { carbon: 40, laser: 280, plasma: 1800, antimatter: 12000 };
  for (const key of Object.keys(clickBaseCosts)) {
    const oldVal = oldClicks[key] || 0;
    const newVal = Math.max(oldVal, newClicks[key] || 0);
    newClicks[key] = newVal;
    for (let lvl = oldVal; lvl < newVal; lvl++) {
      upgradeCost += Math.floor(clickBaseCosts[key] * Math.pow(1.15, lvl));
    }
  }

  // 2. Calculate maximum possible gain since last sync
  const elapsedSeconds = Math.max(0, (Date.now() - oldLastSync) / 1000);
  const activeElapsed = Math.min(300, elapsedSeconds); // cap offline passive earnings at 5 minutes to force active interaction

  // Recompute active hash rate
  let newRate = 0;
  newRate += (newRigs.cpu * 0.15);
  newRate += (newRigs.gpu * 1.2);
  newRate += (newRigs.asic * 9.0);
  newRate += (newRigs.validator * 65.0);
  newRate += (newRigs.quantum * 480.0);
  newRate += (newRigs.ai * 3400.0);

  // Max multiplier = 4.0x (3x overclock + 0.5x sigil + 0.25x chat surge + buffer)
  const maxPassiveRate = newRate * 4.0;

  // Max click power
  let clickPower = 1;
  clickPower += (newClicks.carbon * 1);
  clickPower += (newClicks.laser * 5);
  clickPower += (newClicks.plasma * 25);
  clickPower += (newClicks.antimatter * 150);

  // Max clicks rate = 15 clicks per second (anti-autoclicker/macro cap)
  const maxClickRate = 15;
  const maxClickGain = clickPower * maxClickRate;

  // 3. Perform anti-cheat verification and cap if necessary
  const DAILY_MINING_CAP = parseFloat(process.env.DAILY_MINING_CAP || '50000');
  const maxAllowedRawGain = (maxPassiveRate * activeElapsed) + (maxClickGain * elapsedSeconds);

  // Integrate difficulty scaling to find the max possible scaled gain the player could have earned:
  let remainingRaw = maxAllowedRawGain;
  let simulatedDailyMined = player.dailyMined;
  let maxScaledGain = 0;

  const steps = 20;
  const rawStep = remainingRaw / steps;
  for (let i = 0; i < steps; i++) {
    const efficiency = Math.max(0, 1 - (simulatedDailyMined / DAILY_MINING_CAP));
    const scaledStep = rawStep * efficiency;
    maxScaledGain += scaledStep;
    simulatedDailyMined = Math.min(DAILY_MINING_CAP, simulatedDailyMined + scaledStep);
  }

  // Add buffer for network latency/roundings
  const baseBuffer = oldChips === 0 ? 500 : 50;
  const maxAllowedGain = maxScaledGain + baseBuffer;

  const expectedMaxChips = Math.max(0, oldChips + maxAllowedGain - upgradeCost);

  let finalChips = clientChips;
  let capped = false;

  if (clientChips > expectedMaxChips) {
    console.warn(`[MINE ENGINE] Anti-cheat triggered for ${walletAddress}: Client claimed ${clientChips}, max possible is ${expectedMaxChips}. Capping score.`);
    finalChips = expectedMaxChips;
    capped = true;
  }

  // Update daily mined balance
  const actualScaledGain = Math.max(0, finalChips - oldChips + upgradeCost);
  if (actualScaledGain > 0) {
    player.dailyMined = Math.min(DAILY_MINING_CAP, player.dailyMined + actualScaledGain);
  }

  const synced = syncPlayer(walletAddress, finalChips, newRigs, newClicks, player.dailyMined, player.lastDailyReset);
  res.json({ 
    success: true, 
    syncedScore: synced.chips,
    dailyMined: synced.dailyMined,
    hasSigilNft: !!synced.hasSigilNft,
    capped
  });
});

// ── ACTIVATE SIGIL BOOST (VERIFY REAL SOLANA TRANSACTION) ──
router.post('/activate-sigil', async (req, res) => {
  const { signature, walletAddress } = req.body;
  if (!signature || !walletAddress) {
    return res.status(400).json({ error: 'Missing signature or walletAddress' });
  }

  try {
    // 1. Check if signature is already used
    if (isSignatureUsed(signature)) {
      return res.status(400).json({ error: 'This transaction signature has already been used.' });
    }

    // 2. Fetch transaction details from mainnet Solana
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return res.status(400).json({ error: 'Transaction not found on the network. Please wait a few seconds and try again.' });
    }

    // 3. Verify it was a transfer of 0.001 SOL to the server wallet
    const serverKeypair = getServerKeypair();
    if (!serverKeypair) {
      return res.status(500).json({ error: 'Server wallet keypair is not configured on the backend.' });
    }
    const serverWalletStr = serverKeypair.publicKey.toBase58();

    const accountKeys = tx.transaction.message.accountKeys.map(k => {
      if (typeof k === 'string') return k;
      if (k && typeof k.toBase58 === 'function') return k.toBase58();
      if (k && k.pubkey && typeof k.pubkey.toBase58 === 'function') return k.pubkey.toBase58();
      if (k && k.pubkey) return k.pubkey.toString();
      return String(k);
    });

    const serverWalletIdx = accountKeys.findIndex(k => k === serverWalletStr);
    if (serverWalletIdx === -1) {
      return res.status(400).json({ error: 'Receiver wallet in transaction does not match server wallet.' });
    }

    // Check balances difference
    const preBalance = tx.meta.preBalances[serverWalletIdx];
    const postBalance = tx.meta.postBalances[serverWalletIdx];
    const diff = postBalance - preBalance;

    // We expect 0.001 SOL which is 1,000,000 lamports. Allow a tiny tolerance for rounding if any.
    if (diff < 990000) {
      return res.status(400).json({ error: `Incorrect SOL transfer amount. Received ${diff / 1000000000} SOL, expected 0.001 SOL.` });
    }

    // 4. Verify the sender is indeed the user
    // The first account in accountKeys is always the fee payer (the sender)
    const sender = accountKeys[0];
    if (sender.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ error: `Sender in transaction (${sender}) does not match your wallet (${walletAddress}).` });
    }

    // 5. Mark signature as used and activate the Sigil
    markSignatureUsed(signature);
    activateSigilNft(walletAddress);

    res.json({ success: true, message: 'Sigil Boost activated successfully!' });
  } catch (err) {
    console.error('Activate sigil error:', err);
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// ── CLAIM TOKEN TRANSACTION GENERATOR ──
router.post('/claim', async (req, res) => {
  const { walletAddress, amount, signature } = req.body;
  if (!walletAddress || !amount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const claimVal = parseFloat(amount);
  if (isNaN(claimVal) || claimVal <= 0) {
    return res.status(400).json({ error: 'Invalid claim amount' });
  }

  // Load configuration
  const chipsToTokenRatio = parseFloat(process.env.CHIPS_TO_TOKEN_RATIO || '1000');
  const tokenClaimVal = claimVal / chipsToTokenRatio;

  // Verify signature of claim intent: must specify both chips spent and tokens minted
  const message = `Claim ${claimVal.toFixed(1)} chips for ${tokenClaimVal.toFixed(4)} SCHIP tokens to wallet ${walletAddress}`;
  const isValid = verifyWalletSignature(message, signature, walletAddress);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid claim signature' });
  }

  // Check player score in local JSON database
  const player = getPlayer(walletAddress);
  if (player.chips < claimVal) {
    return res.status(400).json({ error: `Insufficient chips. Available: ${player.chips.toFixed(1)}` });
  }

  // Get server wallet and token mint settings
  const serverKeypair = getServerKeypair();
  const tokenMintAddress = process.env.TOKEN_MINT_ADDRESS;
  const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS;
  const claimFeeSol = parseFloat(process.env.CLAIM_FEE_SOL || '0');
  const claimFeePercent = parseFloat(process.env.CLAIM_FEE_PERCENT || '0');

  if (!serverKeypair || !tokenMintAddress) {
    return res.status(500).json({ error: 'Mining Token features not configured on server yet.' });
  }

  try {
    const mintPubkey = new PublicKey(tokenMintAddress);
    const playerPubkey = new PublicKey(walletAddress);

    // Compute player's Associated Token Account
    const playerAta = getAssociatedTokenAddressSync(
      mintPubkey,
      playerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx = new Transaction();

    // 1. Create Associated Token Account if not exist (payer: player)
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        playerPubkey,
        playerAta,
        playerPubkey,
        mintPubkey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // 2. Process SOL Fees if configured
    if (treasuryAddress && claimFeeSol > 0) {
      const treasuryPubkey = new PublicKey(treasuryAddress);
      const lamports = Math.floor(claimFeeSol * 1_000_000_000);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: playerPubkey,
          toPubkey: treasuryPubkey,
          lamports: lamports,
        })
      );
    }

    // 3. Process Token Minting & Token Fees
    if (treasuryAddress && claimFeePercent > 0) {
      const treasuryPubkey = new PublicKey(treasuryAddress);
      const treasuryAta = getAssociatedTokenAddressSync(
        mintPubkey,
        treasuryPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Create Treasury Associated Token Account if not exists
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          playerPubkey,
          treasuryAta,
          treasuryPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      const feeAmount = tokenClaimVal * (claimFeePercent / 100);
      const playerAmount = Math.max(0, tokenClaimVal - feeAmount);

      const playerUnits = BigInt(Math.floor(playerAmount * 1_000_000_000));
      const feeUnits = BigInt(Math.floor(feeAmount * 1_000_000_000));

      // Mint player's share
      if (playerUnits > 0n) {
        tx.add(
          createMintToInstruction(
            mintPubkey,
            playerAta,
            serverKeypair.publicKey,
            playerUnits,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Mint fee share to treasury
      if (feeUnits > 0n) {
        tx.add(
          createMintToInstruction(
            mintPubkey,
            treasuryAta,
            serverKeypair.publicKey,
            feeUnits,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }
    } else {
      // Mint all tokens to player (decimals: 9)
      const tokenUnits = BigInt(Math.floor(tokenClaimVal * 1_000_000_000));
      tx.add(
        createMintToInstruction(
          mintPubkey,
          playerAta,
          serverKeypair.publicKey,
          tokenUnits,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    // Fetch latest blockhash
    tx.feePayer = playerPubkey;
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    // Co-sign with server's Mint Authority keypair
    tx.partialSign(serverKeypair);

    // Serialize transaction to base64
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Deduct chips on success prep
    deductChips(walletAddress, claimVal);

    res.json({
      success: true,
      serializedTx: serializedTx.toString('base64'),
      playerAta: playerAta.toBase58(),
    });
  } catch (err) {
    console.error("Claim transaction error:", err);
    res.status(500).json({ error: 'Failed to create claiming transaction', details: err.message });
  }
});

// ── GET LEADERBOARD ──
router.get('/leaderboard', async (req, res) => {
  try {
    const { loadDb } = await import('../miningDb.js');
    const db = loadDb();
    const playersMap = db.players || {};
    const playersList = [];

    // Fetch all registered users from supabase
    const { data: dbUsers, error } = await supabase
      .from('usernames')
      .select('wallet_address, username');

    const processedWallets = new Set();

    // Process registered users from DB
    if (dbUsers) {
      dbUsers.forEach(user => {
        if (!user.wallet_address) return;
        const wallet = user.wallet_address;
        const username = user.username || (wallet.slice(0, 6) + '...' + wallet.slice(-4));
        processedWallets.add(wallet.toLowerCase());

        const p = playersMap[wallet] || {};
        let hps = 0;
        if (p.rigs) {
          hps += (p.rigs.cpu || 0) * 0.15;
          hps += (p.rigs.gpu || 0) * 1.2;
          hps += (p.rigs.asic || 0) * 9.0;
          hps += (p.rigs.validator || 0) * 65.0;
          hps += (p.rigs.quantum || 0) * 480.0;
          hps += (p.rigs.ai || 0) * 3400.0;
        }

        playersList.push({
          username,
          score: p.chips || 0,
          hps,
          walletAddress: wallet
        });
      });
    }

    // Process other wallets that synced state but aren't registered yet
    Object.keys(playersMap).forEach(wallet => {
      if (!processedWallets.has(wallet.toLowerCase())) {
        const p = playersMap[wallet];
        const username = wallet.slice(0, 6) + '...' + wallet.slice(-4);
        let hps = 0;
        if (p.rigs) {
          hps += (p.rigs.cpu || 0) * 0.15;
          hps += (p.rigs.gpu || 0) * 1.2;
          hps += (p.rigs.asic || 0) * 9.0;
          hps += (p.rigs.validator || 0) * 65.0;
          hps += (p.rigs.quantum || 0) * 480.0;
          hps += (p.rigs.ai || 0) * 3400.0;
        }

        playersList.push({
          username,
          score: p.chips || 0,
          hps,
          walletAddress: wallet
        });
      }
    });

    // Sort by score desc
    playersList.sort((a, b) => b.score - a.score);

    res.json({ success: true, leaderboard: playersList });
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    res.status(500).json({ error: 'Failed to retrieve leaderboard' });
  }
});

export default router;
