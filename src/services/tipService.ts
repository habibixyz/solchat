import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { supabase } from '../lib/supabase';
import { createMentionNotifications } from './notificationService';

export const ANSEM_MINT = new PublicKey("9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump");
export const ANSEM_DECIMALS = 6;

const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

/**
 * Attempts to fetch $ANSEM balance from a single connection.
 * Uses getParsedTokenAccountsByOwner (mint filter) as primary strategy —
 * this handles non-standard ATAs (e.g. pump.fun tokens) in a single RPC call.
 * Falls back to standard ATA derivation as a secondary strategy.
 */
async function fetchBalanceFromConn(conn: Connection, walletAddress: string): Promise<number> {
  const ownerPubkey = new PublicKey(walletAddress);

  // Strategy 1 (primary): getParsedTokenAccountsByOwner with mint filter
  // This finds ALL token accounts for this mint regardless of how they were created
  try {
    const resp = await conn.getParsedTokenAccountsByOwner(ownerPubkey, {
      mint: ANSEM_MINT,
    });
    if (resp.value.length > 0) {
      let total = 0;
      for (const acct of resp.value) {
        const parsed = acct.account.data.parsed?.info?.tokenAmount;
        const amt = parsed?.uiAmount ?? 0;
        total += amt;
        console.log(`[ANSEM] Found token account ${acct.pubkey.toBase58()} with balance ${amt}`);
      }
      if (total > 0) return total;
    }
  } catch (e: any) {
    console.warn('[ANSEM] getParsedTokenAccountsByOwner failed:', e?.message);
  }

  // Strategy 2 (fallback): getTokenAccountsByOwner (raw, then fetch balance)
  try {
    const resp = await conn.getTokenAccountsByOwner(ownerPubkey, {
      mint: ANSEM_MINT,
    });
    if (resp.value.length > 0) {
      let total = 0;
      for (const acct of resp.value) {
        const info = await conn.getTokenAccountBalance(acct.pubkey);
        total += info.value.uiAmount ?? 0;
      }
      if (total > 0) return total;
    }
  } catch (e: any) {
    console.warn('[ANSEM] getTokenAccountsByOwner failed:', e?.message);
  }

  // Strategy 3 (last resort): Standard ATA derivation
  try {
    const ata = getAssociatedTokenAddressSync(ANSEM_MINT, ownerPubkey);
    const balanceInfo = await conn.getTokenAccountBalance(ata);
    return balanceInfo.value.uiAmount ?? 0;
  } catch (_) {
    // ATA doesn't exist or derivation doesn't match
  }

  return 0;
}

/**
 * Last-resort: direct JSON-RPC POST to fetch token accounts.
 * Bypasses @solana/web3.js entirely — more resilient to library-level failures.
 */
async function fetchBalanceViaRawRPC(rpcUrl: string, walletAddress: string): Promise<number> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTokenAccountsByOwner',
    params: [
      walletAddress,
      { mint: ANSEM_MINT.toBase58() },
      { encoding: 'jsonParsed' }
    ]
  });

  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!resp.ok) {
    console.warn(`[ANSEM] Raw RPC ${rpcUrl} returned ${resp.status}`);
    return 0;
  }

  const json = await resp.json();
  if (json.error) {
    console.warn('[ANSEM] Raw RPC error:', json.error);
    return 0;
  }

  const accounts = json.result?.value ?? [];
  let total = 0;
  for (const acct of accounts) {
    const amt = acct.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    total += amt;
  }

  console.log(`[ANSEM] Raw RPC found ${accounts.length} accounts, total balance: ${total}`);
  return total;
}

const PUBLIC_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

/**
 * Fetches the user's $ANSEM token balance.
 * Uses multiple strategies and RPC endpoints for maximum reliability.
 */
export async function fetchAnsemBalance(connection: Connection, walletAddress: string): Promise<number> {
  if (!walletAddress) return 0;

  // Strategy A: Try the wallet adapter's connection (may be Helius or any custom RPC)
  try {
    const bal = await fetchBalanceFromConn(connection, walletAddress);
    if (bal > 0) return bal;
  } catch (e) {
    console.warn('[ANSEM] Primary connection failed:', e);
  }

  // Strategy B: Try direct JSON-RPC POST to each public RPC
  // This bypasses @solana/web3.js and is more resilient to rate limiting
  for (const rpc of PUBLIC_RPCS) {
    try {
      const bal = await fetchBalanceViaRawRPC(rpc, walletAddress);
      if (bal > 0) return bal;
    } catch (e) {
      console.warn(`[ANSEM] Raw RPC ${rpc} failed:`, e);
    }
  }

  // Strategy C: @solana/web3.js with public RPC as Connection object
  for (const rpc of PUBLIC_RPCS) {
    try {
      const fallbackConn = new Connection(rpc, 'confirmed');
      const bal = await fetchBalanceFromConn(fallbackConn, walletAddress);
      if (bal > 0) return bal;
    } catch (e) {
      console.warn(`[ANSEM] Fallback connection ${rpc} failed:`, e);
    }
  }

  console.error('[ANSEM] All balance fetch strategies exhausted, returning 0');
  return 0;
}

/**
 * Constructs and signs/sends the on-chain transfer transaction for $ANSEM.
 */
export async function sendAnsemTip(
  connection: Connection,
  wallet: any,
  recipientAddress: string,
  amount: number
): Promise<string> {
  const senderPubkey = wallet.publicKey;
  if (!senderPubkey) throw new Error("Wallet not connected");

  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(recipientAddress);
  } catch (e) {
    throw new Error("Invalid recipient wallet address");
  }

  // Use helper to resolve the working connection
  let activeConn = connection;
  try {
    // Quick test if primary connection works
    await connection.getLatestBlockhash('confirmed');
  } catch (err) {
    console.warn("Primary connection failed during tip transaction preparation. Using fallback RPC.", err);
    activeConn = new Connection(FALLBACK_RPC, "confirmed");
  }

  // Resolve sender's actual token account (may differ from standard ATA for pump.fun tokens)
  let senderATA = getAssociatedTokenAddressSync(ANSEM_MINT, senderPubkey);
  try {
    const senderAccounts = await activeConn.getTokenAccountsByOwner(senderPubkey, { mint: ANSEM_MINT });
    if (senderAccounts.value.length > 0) {
      senderATA = senderAccounts.value[0].pubkey;
    }
  } catch (_) {
    // fallback to derived ATA
  }

  const recipientATA = getAssociatedTokenAddressSync(ANSEM_MINT, recipientPubkey);

  const transaction = new Transaction();

  // Check if recipient ATA exists. If not, add instruction to create it.
  const recipientAccountInfo = await activeConn.getAccountInfo(recipientATA);
  if (!recipientAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        senderPubkey,      // payer
        recipientATA,      // associated token address
        recipientPubkey,   // owner
        ANSEM_MINT         // mint
      )
    );
  }

  // Convert amount using decimals
  const baseAmount = BigInt(Math.floor(amount * Math.pow(10, ANSEM_DECIMALS)));

  // Add transfer instruction
  transaction.add(
    createTransferInstruction(
      senderATA,
      recipientATA,
      senderPubkey,
      baseAmount
    )
  );

  const { blockhash } = await activeConn.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = senderPubkey;

  const signature = await wallet.sendTransaction(transaction, activeConn);
  return signature;
}

/**
 * Broadcasts a tipping message in the global feed.
 */
export async function broadcastTipMessage(
  senderUsername: string,
  senderWallet: string,
  recipientUsername: string,
  amount: number,
  customMessage: string,
  txSignature: string
): Promise<string | null> {
  let text = `💸 Tipped @${recipientUsername.toLowerCase()} ${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} $ANSEM!`;
  if (customMessage.trim()) {
    text += ` "${customMessage.trim()}"`;
  }

  const payload: any = {
    username: senderUsername,
    wallet_address: senderWallet,
    text,
    tx_signature: txSignature
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to broadcast tip message:', error);
    return null;
  }

  // Generate mention notifications for the recipient
  await createMentionNotifications(text, senderUsername, senderWallet, data.id).catch(console.warn);

  return data.id;
}
