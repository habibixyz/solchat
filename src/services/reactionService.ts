import { supabase } from '../lib/supabase';

export type ReactionType = 'signal';

export type ReactionCounts = {
  signal: number;
  myReactions: Set<ReactionType>;
};

export async function sendReaction(
  messageId: string,
  reactorWallet: string,
  type: ReactionType = 'signal'
): Promise<void> {
  if (!messageId) throw new Error('Missing message');
  if (!reactorWallet) throw new Error('Connect wallet first');

  const { data: existing, error: lookupError } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('reactor', reactorWallet)
    .eq('reaction_type', type)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return;

  const { error } = await supabase.from('message_reactions').insert({
    message_id: messageId,
    reactor: reactorWallet,
    reaction_type: type,
    tx_signature: `free:${reactorWallet}:${Date.now()}`,
  });

  if (error) throw error;
}

export async function fetchReactions(
  messageIds: string[],
  myWallet?: string
): Promise<Record<string, ReactionCounts>> {
  if (!messageIds.length) return {};

  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, reaction_type, reactor')
    .in('message_id', messageIds);

  if (error) throw error;

  const result: Record<string, ReactionCounts> = {};
  messageIds.forEach(id => {
    result[id] = { signal: 0, myReactions: new Set<ReactionType>() };
  });

  (data ?? []).forEach((r: any) => {
    if (!result[r.message_id]) return;
    if (r.reaction_type === 'signal') result[r.message_id].signal += 1;
    if (myWallet && r.reactor === myWallet) {
      result[r.message_id].myReactions.add(r.reaction_type as ReactionType);
    }
  });

  return result;
}

export async function fetchTrending(limit = 15) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: reactionRows, error: reactionError } = await supabase
    .from('message_reactions')
    .select('message_id')
    .eq('reaction_type', 'signal')
    .gte('created_at', since);

  if (reactionError) throw reactionError;
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

  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .in('id', topIds);

  if (messageError) throw messageError;

  return (messages ?? [])
    .map((m: any) => ({ ...m, reactionCount: counts[m.id] ?? 0 }))
    .sort((a: any, b: any) => b.reactionCount - a.reactionCount);
}
