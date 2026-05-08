import { Connection, clusterApiUrl, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { supabase } from '../lib/supabase';

const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL;
const CREATOR_WALLET = "A3vfDdCu4y5EaVxKqnHmEKjwa2SaMhCZm9wbUQZrA8CV";
const DM_PRICE_SOL = 0.0001;
const DM_OPEN_FEE = Math.floor(DM_PRICE_SOL * LAMPORTS_PER_SOL);

// ── Canonical pair: always store wallets in original case, sorted alphabetically
export function canonicalPair(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

// ── Resolve username for a wallet address (checks usernames table) ─────────────
const usernameCache: Record<string, string> = {};
export async function resolveUsername(wallet: string): Promise<string> {
  if (!wallet) return '????';
  const key = wallet.toLowerCase();
  if (usernameCache[key]) return usernameCache[key];

  // Try both original case and lowercase since DB may store either
  const { data } = await supabase
    .from('usernames')
    .select('username')
    .ilike('wallet_address', wallet)  // case-insensitive match
    .maybeSingle();

  const name = data?.username || `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
  usernameCache[key] = name;
  return name;
}

// ── Batch resolve usernames for multiple wallets ────────────────────────────────
export async function resolveUsernames(wallets: string[]): Promise<Record<string, string>> {
  if (!wallets.length) return {};
  const unique = [...new Set(wallets.filter(Boolean))];

  // Check cache first
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const w of unique) {
    const cached = usernameCache[w.toLowerCase()];
    if (cached) result[w] = cached;
    else missing.push(w);
  }

  if (missing.length) {
    // Batch fetch all missing at once
    const { data } = await supabase
      .from('usernames')
      .select('wallet_address, username')
      .in('wallet_address', missing);

    // Also try lowercase versions
    const { data: dataLower } = await supabase
      .from('usernames')
      .select('wallet_address, username')
      .in('wallet_address', missing.map(w => w.toLowerCase()));

    const allRows = [...(data ?? []), ...(dataLower ?? [])];
    const found = new Set<string>();

    for (const row of allRows) {
      // Map back to original wallet casing
      const orig = missing.find(w => w.toLowerCase() === row.wallet_address.toLowerCase());
      if (orig && !found.has(orig.toLowerCase())) {
        found.add(orig.toLowerCase());
        usernameCache[orig.toLowerCase()] = row.username;
        result[orig] = row.username;
      }
    }

    // Fallback for anything still missing
    for (const w of missing) {
      if (!result[w]) {
        const short = `${w.slice(0, 4)}…${w.slice(-4)}`;
        usernameCache[w.toLowerCase()] = short;
        result[w] = short;
      }
    }
  }

  return result;
}

// ── Check if a thread already exists ───────────────────────────────────────────
export async function getThread(myWallet: string, theirWallet: string) {
  const [a, b] = canonicalPair(myWallet, theirWallet);
  // Try both cases
  const { data } = await supabase
    .from('dm_threads')
    .select('*')
    .or(`and(participant_a.eq.${a},participant_b.eq.${b}),and(participant_a.eq.${a.toLowerCase()},participant_b.eq.${b.toLowerCase()})`)
    .maybeSingle();
  return data;
}

// ── Open a new DM thread ────────────────────────────────────────────────────────
export async function openDMThread(
  myWallet: string,
  theirWallet: string,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<string> {
  if (!myWallet || !theirWallet) throw new Error('Invalid wallet');
  if (myWallet === theirWallet) throw new Error('Cannot DM yourself');

  const connection = new Connection(
  clusterApiUrl("mainnet-beta"),
  "confirmed"
);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(myWallet),
      toPubkey: new PublicKey(CREATOR_WALLET),
      lamports: DM_OPEN_FEE,
    })
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(myWallet);

  const signature = await sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, 'confirmed');

  const [a, b] = canonicalPair(myWallet, theirWallet);
  const { data, error } = await supabase
    .from('dm_threads')
    .insert({ participant_a: a, participant_b: b, open_tx: signature })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ── Send a DM ──────────────────────────────────────────────────────────────────
export async function sendDM(
  threadId: string,
  senderWallet: string,
  content: string,          // ✅ was `text` (undefined variable bug)
  replyToId?: string
) {
  const payload: Record<string, unknown> = {
    thread_id: threadId,
    sender: senderWallet,
    text: content.trim(),   // ✅ fixed
  };
  if (replyToId) payload.reply_to_id = replyToId;

  const { error } = await supabase.from('dm_messages').insert(payload);
  if (error) throw error;
}

// ── Fetch all threads with resolved usernames ──────────────────────────────────
export async function getMyThreads(wallet: string) {
  const { data, error } = await supabase
    .from('dm_threads')
    .select('*')
    .or(`participant_a.eq.${wallet},participant_b.eq.${wallet},participant_a.eq.${wallet.toLowerCase()},participant_b.eq.${wallet.toLowerCase()}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const threads = data ?? [];

  // Batch resolve all other-party wallets at once
  const otherWallets = threads.map(t =>
    t.participant_a.toLowerCase() === wallet.toLowerCase() ? t.participant_b : t.participant_a
  );

  const nameMap = await resolveUsernames(otherWallets);

  // Attach resolved username to each thread
  return threads.map(t => {
    const other = t.participant_a.toLowerCase() === wallet.toLowerCase() ? t.participant_b : t.participant_a;
    return { ...t, otherUsername: nameMap[other] || `${other.slice(0,4)}…${other.slice(-4)}` };
  });
}

// ── Fetch messages for a thread ────────────────────────────────────────────────
export async function getThreadMessages(threadId: string) {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}