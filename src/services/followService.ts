import { supabase } from '../lib/supabase';

/**
 * Follows a user by inserting a system follow message.
 */
export async function followUser(follower: string, following: string): Promise<void> {
  if (!follower || !following) return;
  const { error } = await supabase.from('messages').insert({
    wallet_address: follower,
    username: 'system_follow',
    text: `[SYSTEM_FOLLOW]: ${following}`,
    tx_signature: `follow:${follower}:${following}:${Date.now()}`
  });
  if (error) throw error;
}

/**
 * Unfollows a user by deleting the system follow message.
 */
export async function unfollowUser(follower: string, following: string): Promise<void> {
  if (!follower || !following) return;
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('wallet_address', follower)
    .eq('text', `[SYSTEM_FOLLOW]: ${following}`);
  if (error) throw error;
}

/**
 * Checks if a follower is currently following another wallet.
 */
export async function checkIfFollowing(follower: string, following: string): Promise<boolean> {
  if (!follower || !following) return false;
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('wallet_address', follower)
    .eq('text', `[SYSTEM_FOLLOW]: ${following}`)
    .maybeSingle();
  return !error && !!data;
}

/**
 * Fetches followers and following counts for a given wallet.
 */
export async function fetchFollowCounts(wallet: string): Promise<{ followersCount: number; followingCount: number }> {
  if (!wallet) return { followersCount: 0, followingCount: 0 };
  
  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('text', `[SYSTEM_FOLLOW]: ${wallet}`),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('wallet_address', wallet)
      .like('text', '[SYSTEM_FOLLOW]:%')
  ]);

  return {
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0
  };
}

/**
 * Fetches a list of profiles that are following the given wallet.
 */
export async function fetchFollowersList(wallet: string): Promise<{ wallet_address: string; username: string; avatar_url?: string }[]> {
  if (!wallet) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('wallet_address')
    .eq('text', `[SYSTEM_FOLLOW]: ${wallet}`);
  
  if (error || !data) return [];
  const followerWallets = data.map(d => d.wallet_address).filter(Boolean);
  if (followerWallets.length === 0) return [];

  const [namesRes, usersRes] = await Promise.all([
    supabase.from('usernames').select('wallet_address, username').in('wallet_address', followerWallets),
    supabase.from('users').select('wallet_address, avatar_url').in('wallet_address', followerWallets)
  ]);

  const namesMap = new Map(namesRes.data?.map(n => [n.wallet_address.toLowerCase(), n.username]) || []);
  const avatarsMap = new Map(usersRes.data?.map(u => [u.wallet_address.toLowerCase(), u.avatar_url]) || []);

  return followerWallets.map(w => ({
    wallet_address: w,
    username: namesMap.get(w.toLowerCase()) || 'guest',
    avatar_url: avatarsMap.get(w.toLowerCase()) || undefined
  }));
}

/**
 * Fetches a list of profiles that the given wallet is following.
 */
export async function fetchFollowingList(wallet: string): Promise<{ wallet_address: string; username: string; avatar_url?: string }[]> {
  if (!wallet) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('text')
    .eq('wallet_address', wallet)
    .like('text', '[SYSTEM_FOLLOW]:%');
  
  if (error || !data) return [];
  const followedWallets = data
    .map(d => d.text.replace('[SYSTEM_FOLLOW]: ', '').trim())
    .filter(Boolean);
  
  if (followedWallets.length === 0) return [];

  const [namesRes, usersRes] = await Promise.all([
    supabase.from('usernames').select('wallet_address, username').in('wallet_address', followedWallets),
    supabase.from('users').select('wallet_address, avatar_url').in('wallet_address', followedWallets)
  ]);

  const namesMap = new Map(namesRes.data?.map(n => [n.wallet_address.toLowerCase(), n.username]) || []);
  const avatarsMap = new Map(usersRes.data?.map(u => [u.wallet_address.toLowerCase(), u.avatar_url]) || []);

  return followedWallets.map(w => ({
    wallet_address: w,
    username: namesMap.get(w.toLowerCase()) || 'guest',
    avatar_url: avatarsMap.get(w.toLowerCase()) || undefined
  }));
}
