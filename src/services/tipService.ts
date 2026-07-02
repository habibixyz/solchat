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
 * First tries the standard ATA derivation, then falls back to
 * scanning all token accounts for the mint via getTokenAccountsByOwner.
 */
async function fetchBalanceFromConn(conn: Connection, walletAddress: string): Promise<number> {
  const ownerPubkey = new PublicKey(walletAddress);

  // Strategy 1: Standard ATA lookup
  try {
    const ata = getAssociatedTokenAddressSync(ANSEM_MINT, ownerPubkey);
    const balanceInfo = await conn.getTokenAccountBalance(ata);
    return balanceInfo.value.uiAmount ?? 0;
  } catch (_) {
    // ATA may not exist or derivation may not match — fall through
  }

  // Strategy 2: Scan all token accounts for this mint
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
      return total;
    }
  } catch (_) {
    // scan failed — fall through
  }

  return 0;
}

/**
 * Fetches the user's $ANSEM token balance.
 * Tries the provided connection first, then falls back to the public mainnet RPC.
 */
export async function fetchAnsemBalance(connection: Connection, walletAddress: string): Promise<number> {
  if (!walletAddress) return 0;

  // Try primary connection
  try {
    const bal = await fetchBalanceFromConn(connection, walletAddress);
    if (bal > 0) return bal;
  } catch (e) {
    console.warn('Primary RPC balance fetch failed:', e);
  }

  // Fallback to public RPC
  try {
    const fallbackConn = new Connection(FALLBACK_RPC, 'confirmed');
    return await fetchBalanceFromConn(fallbackConn, walletAddress);
  } catch (e) {
    console.error('Fallback RPC balance fetch also failed:', e);
    return 0;
  }
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
