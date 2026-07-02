import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction 
} from '@solana/spl-token';
import { supabase } from '../lib/supabase';
import { createMentionNotifications } from './notificationService';

export const ANSEM_MINT = new PublicKey("9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump");
export const ANSEM_DECIMALS = 6;

/**
 * Fetches the user's $ANSEM token balance.
 */
export async function fetchAnsemBalance(connection: Connection, walletAddress: string): Promise<number> {
  if (!walletAddress) return 0;
  try {
    const ownerPubkey = new PublicKey(walletAddress);
    const ata = getAssociatedTokenAddressSync(ANSEM_MINT, ownerPubkey);
    const balanceInfo = await connection.getTokenAccountBalance(ata);
    return balanceInfo.value.uiAmount ?? 0;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    // If the account just doesn't exist on-chain, it means the user's balance is 0.
    if (errMsg.includes("could not find account") || errMsg.includes("Invalid param")) {
      return 0;
    }
    
    // Attempt fallback to public mainnet RPC
    try {
      console.warn("Primary RPC failed to fetch balance, trying fallback RPC...", errMsg);
      const fallbackConn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const ownerPubkey = new PublicKey(walletAddress);
      const ata = getAssociatedTokenAddressSync(ANSEM_MINT, ownerPubkey);
      const balanceInfo = await fallbackConn.getTokenAccountBalance(ata);
      return balanceInfo.value.uiAmount ?? 0;
    } catch (fallbackError: any) {
      const fallbackErrMsg = fallbackError?.message || String(fallbackError);
      if (fallbackErrMsg.includes("could not find account") || fallbackErrMsg.includes("Invalid param")) {
        return 0;
      }
      console.error("Fallback RPC also failed to fetch balance:", fallbackError);
      return 0;
    }
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
    activeConn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  }

  const senderATA = getAssociatedTokenAddressSync(ANSEM_MINT, senderPubkey);
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
