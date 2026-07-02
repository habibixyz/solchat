// api/claim-username.js
// Vercel Serverless Function — runs server-side, has access to env secrets.
// Verifies the user signed the correct message with their Solana wallet,
// then writes to the `usernames` table using the service-role key (bypasses RLS).

import { createClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

function verifySignature(message, signatureB58, publicKey) {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureB58);
    const pubKeyBytes = publicKey.toBytes();
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — allow any origin since this is a public API called from the frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { walletAddress, username, signature } = req.body ?? {};

    if (!walletAddress || !username || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const clean = String(username).trim().toLowerCase();
    if (clean.length < 3 || clean.length > 20 || !/^[a-z0-9_]+$/.test(clean)) {
      return res.status(400).json({
        error: 'Username must be 3-20 characters (lowercase letters, numbers, underscores only)',
      });
    }

    let publicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Verify the wallet actually signed this exact message
    const expectedMessage = `Claim username "${clean}" for wallet ${walletAddress}`;
    const isValid = verifySignature(expectedMessage, signature, publicKey);
    if (!isValid) {
      return res.status(401).json({ error: 'Signature verification failed. Try again.' });
    }

    // Connect with the SERVICE ROLE key — this bypasses all RLS policies safely
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables! Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel.');
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase Service Role Key' });
    }

    // Connect with the SERVICE ROLE key — this bypasses all RLS policies safely
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if the username is already taken by a DIFFERENT wallet
    const { data: existing, error: fetchError } = await supabase
      .from('usernames')
      .select('wallet_address')
      .ilike('username', clean)
      .maybeSingle();

    if (fetchError) {
      console.error('DB fetch error:', fetchError);
      return res.status(500).json({ error: 'Database error checking username availability' });
    }

    if (existing && existing.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(409).json({ error: `Username "${clean}" is already taken` });
    }

    // Upsert — insert new or update existing row for this wallet
    const { error: upsertError } = await supabase
      .from('usernames')
      .upsert(
        { wallet_address: walletAddress, username: clean },
        { onConflict: 'wallet_address' }
      );

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return res.status(500).json({ error: 'Failed to save username. Try again.' });
    }

    return res.status(200).json({ success: true, walletAddress, username: clean });
  } catch (err) {
    console.error('claim-username error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
