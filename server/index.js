// ============================================================================
// SOLCHAT SECURE BACKEND - PRODUCTION READY
// Fixed and working version
// ============================================================================

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}))
// ============================================================================
// INITIALIZATION
// ============================================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const nonceStore = new Map();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many messages. Wait a minute before posting again.',
});

const nonceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many nonce requests. Try again later.',
});

app.use(generalLimiter);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Solchat backend is running' });
});

// ============================================================================
// NONCE GENERATION
// ============================================================================

app.post('/api/auth/nonce', nonceLimiter, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    try {
      new PublicKey(walletAddress);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    nonceStore.set(walletAddress, {
      nonce,
      expiresAt,
    });

    if (Math.random() < 0.1) {
      cleanupExpiredNonces();
    }

    res.json({
      nonce,
      message: `Sign this nonce to login to Solchat: ${nonce}`,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

app.post('/api/auth/verify', nonceLimiter, async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let publicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const storedData = nonceStore.get(walletAddress);
    if (!storedData) {
      return res.status(400).json({ error: 'No nonce found. Request a nonce first.' });
    }

    if (Date.now() > storedData.expiresAt) {
      nonceStore.delete(walletAddress);
      return res.status(400).json({ error: 'Nonce expired. Request a new one.' });
    }

    if (message !== `Sign this nonce to login to Solchat: ${storedData.nonce}`) {
      return res.status(400).json({ error: 'Invalid message' });
    }

    const isValid = verifySignature(message, signature, publicKey);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    nonceStore.delete(walletAddress);

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          wallet_address: walletAddress,
          last_login: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      );

    if (upsertError) {
      console.error('User upsert error:', upsertError);
      return res.status(500).json({ error: 'Failed to create user session' });
    }

    res.json({
      success: true,
      walletAddress,
      message: 'Signature verified successfully',
    });
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST MESSAGE
// ============================================================================

app.post('/api/message', messageLimiter, async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    let publicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const messageToVerify = `Post message to Solchat: ${message}`;
    const isValid = verifySignature(messageToVerify, signature, publicKey);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature. Message not posted.' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        user_id: walletAddress,
        content: message.trim(),
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Message insert error:', error);
      return res.status(500).json({ error: 'Failed to post message', details: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Message posted successfully',
      data: data[0],
    });
  } catch (error) {
    console.error('Message posting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET MESSAGES
// ============================================================================

app.get('/api/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Fetch raw messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Fetch messages error:', error);
      return res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
    }

    if (!messages || messages.length === 0) {
      return res.json({ data: [] });
    }

    // Get all unique wallet addresses
    const wallets = [...new Set(messages.map(m => m.user_id))];

    // Fetch all usernames for these wallets
    const { data: usernames, error: usernameError } = await supabase
      .from('usernames')
      .select('wallet_address, username')
      .in('wallet_address', wallets);

    if (usernameError) {
      console.error('Fetch usernames error:', usernameError);
    }

    // Create username map
    const usernameMap = {};
    (usernames || []).forEach(u => {
      usernameMap[u.wallet_address] = u.username;
    });

    // Enrich messages with usernames
    const enriched = messages.map(m => ({
      id: m.id,
      user_id: m.user_id,
      username: usernameMap[m.user_id] || `${m.user_id.slice(0, 4)}…${m.user_id.slice(-4)}`,
      content: m.content,
      created_at: m.created_at,
      reply_to_id: m.reply_to_id,
      reply_preview: m.reply_preview,
    }));

    res.json({ data: enriched });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET PROFILE
// ============================================================================

app.get('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let wallet = id;

    // Try username → wallet
    const { data: user } = await supabase
      .from('usernames')
      .select('wallet_address')
      .eq('username', id)
      .single();

    if (user?.wallet_address) {
      wallet = user.wallet_address;
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', wallet)
      .order('created_at', { ascending: false });

    res.json({
      wallet,
      username: id,
      messages: messages || []
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profile failed' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function verifySignature(message, signature, publicKey) {
  try {
    const sig = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(messageBytes, sig, publicKey.toBytes());
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function cleanupExpiredNonces() {
  const now = Date.now();
  let cleaned = 0;
  for (const [wallet, data] of nonceStore.entries()) {
    if (now > data.expiresAt) {
      nonceStore.delete(wallet);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[CLEANUP] Removed ${cleaned} expired nonces`);
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║       ✅ SOLCHAT BACKEND RUNNING               ║
╚════════════════════════════════════════════════╝

🔐 API URL:        http://localhost:${PORT}
📦 Supabase:       ${process.env.SUPABASE_URL}
🌐 Frontend URL:   ${process.env.FRONTEND_URL || 'http://localhost:5173'}
🔧 Environment:    ${process.env.NODE_ENV || 'development'}

✅ Endpoints ready:
  GET  /health                    - Health check
  POST /api/auth/nonce           - Request nonce
  POST /api/auth/verify          - Verify signature
  POST /api/message              - Post message
  GET  /api/messages             - Get all messages
  GET  /api/profile/:username    - Get user profile
  `);
});

export default app;