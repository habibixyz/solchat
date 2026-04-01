import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { supabase } from '../lib/supabase';

const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL;
const CREATOR_WALLET = import.meta.env.VITE_CREATOR_WALLET; // // where DM fee goes
const DM_PRICE_SOL = 0.0001;
const DM_OPEN_FEE = Math.floor(DM_PRICE_SOL * LAMPORTS_PER_SOL);
// Canonical thread ID lookup: always order wallets alphabetically
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ── Check if a thread already exists between two wallets ──────────────────────
export async function getThread(myWallet: string, theirWallet: string) {
  const [a, b] = canonicalPair(myWallet, theirWallet);
  const { data, error } = await supabase
    .from('dm_threads')
    .select('*')
    .eq('participant_a', a)
    .eq('participant_b', b)
    .maybeSingle();

  if (error) throw error;
  return data; // null if no thread yet
}

// ── Open a new DM thread (costs 0.001 SOL, one-time) ─────────────────────────
export async function openDMThread(
  myWallet: string,
  theirWallet: string,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<string> {
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log("ENV:", import.meta.env);
  console.log("CREATOR:", import.meta.env.VITE_CREATOR_WALLET);

if (!myWallet || !theirWallet) {
  throw new Error("Invalid wallet");
}

if (!CREATOR_WALLET) {
  throw new Error("Creator wallet not set");
}

const fromPubkey = new PublicKey(myWallet);
const toPubkey = new PublicKey(CREATOR_WALLET);

const tx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: DM_OPEN_FEE,
  })
);

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(myWallet);

  const signature = await sendTransaction(tx, connection);

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');

  // Insert thread row
  const [a, b] = canonicalPair(myWallet, theirWallet);
  if (a === b) {
  throw new Error("Cannot create thread with yourself");
}
  const { data, error } = await supabase
    .from('dm_threads')
    .insert({ participant_a: a, participant_b: b, open_tx: signature })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ── Send a DM (free after thread is open) ────────────────────────────────────
export async function sendDM(
  threadId: string,
  senderWallet: string,
  text: string,
  replyToId?: string
) {
  const payload: Record<string, unknown> = {
    thread_id: threadId,
    sender: senderWallet,
    text: text.trim(),
  };
  if (replyToId) payload.reply_to_id = replyToId;

  const { error } = await supabase.from('dm_messages').insert(payload);
  if (error) throw error;
}

// ── Fetch all threads for a wallet ───────────────────────────────────────────
export async function getMyThreads(wallet: string) {
  const { data, error } = await supabase
    .from('dm_threads')
    .select('*')
    .or(`participant_a.eq.${wallet},participant_b.eq.${wallet}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ── Fetch messages for a thread ───────────────────────────────────────────────
export async function getThreadMessages(threadId: string) {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
