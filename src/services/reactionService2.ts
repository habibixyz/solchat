// src/services/reactionService2.ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { supabase } from '../lib/supabase';

const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL;
const CREATOR_WALLET = import.meta.env.VITE_CREATOR_WALLET;
const REACTION_FEE = Math.floor(0.0001 * LAMPORTS_PER_SOL);

export type ReactionType = 'signal';

export type ReactionCounts = {
  signal: number;
  myReactions: Set<ReactionType>;
};

export async function sendReaction(
  messageId: string,
  reactorWallet: string,
  type: ReactionType,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
): Promise<void> {
  const connection = new Connection(RPC_URL, 'confirmed');

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(reactorWallet),
      toPubkey: new PublicKey(CREATOR_WALLET),
      lamports: REACTION_FEE,
    })
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(reactorWallet);

  const sig = await sendTransaction(tx, connection);
  await connection.confirmTransaction(sig, 'confirmed');

  const { error } = await supabase.from('message_reactions').insert({
    message_id: messageId,
    reactor: reactorWallet,
    reaction_type: type,
    tx_signature: sig,
  });
  if (error) throw error;
}

export async function fetchReactions(
  messageIds: string[],
  myWallet?: string
): Promise<Record<string, ReactionCounts>> {
  if (!messageIds.length) return {};

  const { data } = await supabase
    .from('message_reactions')
    .select('message_id, reaction_type, reactor')
    .in('message_id', messageIds);

  const result: Record<string, ReactionCounts> = {};
  messageIds.forEach(id => {
    result[id] = { signal: 0, myReactions: new Set<ReactionType>() };
  });

  (data ?? []).forEach((r: any) => {
    if (!result[r.message_id]) return;
    if (r.reaction_type === 'signal') {
      result[r.message_id].signal++;
    }
    if (myWallet && r.reactor === myWallet) {
      result[r.message_id].myReactions.add(r.reaction_type as ReactionType);
    }
  });

  return result;
}

export async function fetchTrending(limit = 10) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: reactionRows } = await supabase
    .from('message_reactions')
    .select('message_id')
    .eq('reaction_type', 'signal')
    .gte('created_at', since);

  if (!reactionRows?.length) return [];

  const counts: Record<string, number> = {};
  reactionRows.forEach((r: any) => {
    counts[r.message_id] = (counts[r.message_id] ?? 0) + 1;
  });

  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (!topIds.length) return [];

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .in('id', topIds);

  return (messages ?? [])
    .map(m => ({ ...m, reactionCount: counts[m.id] ?? 0 }))
    .sort((a, b) => b.reactionCount - a.reactionCount);
}
